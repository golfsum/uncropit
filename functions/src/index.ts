/**
 * Cloud Functions for UnCrop It.
 *
 *  - Auth trigger to provision user profiles + maintain a user count.
 *  - Admin-only callables: list users, enable/disable, send password reset,
 *    list/answer support tickets, grant admin.
 *  - User callable: reply to own ticket.
 *  - AI proxy callables (see ai.ts): aiUncrop, aiAnimate.
 *
 * Security model: every privileged callable checks `request.auth.token.admin`.
 * The very first admin is granted via bootstrapAdmin() using BOOTSTRAP_SECRET.
 */
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { auth as authTrigger } from "firebase-functions/v1";
import { logger } from "firebase-functions/v2";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { auth, db, storage } from "./admin";
import { PLAN_CREDITS, PlanId, normalizePlan, nextRenewal } from "./plans";

const RETENTION_DAYS = 30;

/** Delete a Storage object given its Firebase download URL (token URL). */
async function deleteStorageUrl(url?: string | null): Promise<void> {
  if (!url) return;
  const m = url.match(/\/o\/([^?]+)/);
  if (!m) return;
  const path = decodeURIComponent(m[1]);
  if (!path.startsWith("users/")) return;
  await storage.bucket().file(path).delete().catch(() => undefined);
}

export { aiUncrop, aiAnimate } from "./ai";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertAdmin(request: CallableRequest): string {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  if (request.auth.token.admin !== true) {
    throw new HttpsError("permission-denied", "Admin privileges required.");
  }
  return request.auth.uid;
}

// ---------------------------------------------------------------------------
// User provisioning
// ---------------------------------------------------------------------------

export const onUserCreate = authTrigger.user().onCreate(async (user) => {
  const profile = {
    uid: user.uid,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    photoURL: user.photoURL ?? null,
    providers: user.providerData.map((p) => p.providerId),
    isAnonymous: user.providerData.length === 0,
    disabled: false,
    role: "user",
    createdAt: FieldValue.serverTimestamp(),
    lastSeenAt: FieldValue.serverTimestamp(),
  };
  await db.collection("users").doc(user.uid).set(profile, { merge: true });
  await db.doc("stats/global").set(
    { userCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
  logger.info("Provisioned user profile", { uid: user.uid });
});

export const onUserDelete = authTrigger.user().onDelete(async (user) => {
  await db.collection("users").doc(user.uid).delete().catch(() => undefined);
  await db.doc("stats/global").set(
    { userCount: FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );
});

// ---------------------------------------------------------------------------
// Admin bootstrap + claim management
// ---------------------------------------------------------------------------

/** One-time: grant the first admin. Protected by BOOTSTRAP_SECRET, not by an admin check. */
export const bootstrapAdmin = onCall(async (request) => {
  const { uid, secret } = request.data ?? {};
  const expected = process.env.BOOTSTRAP_SECRET;
  if (!expected || expected === "change-me-to-a-long-random-string") {
    throw new HttpsError("failed-precondition", "BOOTSTRAP_SECRET is not configured.");
  }
  if (secret !== expected) {
    throw new HttpsError("permission-denied", "Bad bootstrap secret.");
  }
  if (!uid || typeof uid !== "string") {
    throw new HttpsError("invalid-argument", "uid is required.");
  }
  await auth.setCustomUserClaims(uid, { admin: true });
  await db.collection("users").doc(uid).set({ role: "admin" }, { merge: true });
  return { ok: true, uid };
});

/** Admin-only: grant or revoke admin for another user. */
export const setAdminClaim = onCall(async (request) => {
  assertAdmin(request);
  const { uid, admin } = request.data ?? {};
  if (!uid) throw new HttpsError("invalid-argument", "uid is required.");
  await auth.setCustomUserClaims(uid, { admin: admin === true });
  await db.collection("users").doc(uid).set(
    { role: admin === true ? "admin" : "user" },
    { merge: true }
  );
  return { ok: true };
});

/**
 * Self-service: a signed-in user whose UID is listed in the ADMIN_UIDS env var
 * (comma-separated) gets the admin claim. Grant-only — removal is via the
 * dashboard's "Revoke admin". The web app calls this on login.
 */
export const syncAdminClaim = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const uid = request.auth.uid;
  const allow = (process.env.ADMIN_UIDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const alreadyAdmin = request.auth.token.admin === true;
  if (allow.includes(uid) && !alreadyAdmin) {
    await auth.setCustomUserClaims(uid, { admin: true });
    await db.collection("users").doc(uid).set({ role: "admin" }, { merge: true });
    return { admin: true, changed: true };
  }
  return { admin: allow.includes(uid) || alreadyAdmin, changed: false };
});

// ---------------------------------------------------------------------------
// Subscriptions: map a verified RevenueCat entitlement to a Firestore plan.
// ---------------------------------------------------------------------------

/** Active RevenueCat entitlement (studio > pro) for an app user, or "free". */
async function fetchRevenueCatPlan(uid: string): Promise<PlanId | null> {
  const secret = process.env.REVENUECAT_SECRET_KEY;
  if (!secret) return null; // Not configured — caller falls back to client claim.
  const res = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!res.ok) {
    logger.error("RevenueCat lookup failed", { status: res.status });
    return "free";
  }
  const body = (await res.json()) as {
    subscriber?: { entitlements?: Record<string, { expires_date?: string | null }> };
  };
  const ents = body.subscriber?.entitlements ?? {};
  const active = (id: string) => {
    const e = ents[id];
    if (!e) return false;
    return e.expires_date == null || new Date(e.expires_date).getTime() > Date.now();
  };
  if (active("studio")) return "studio";
  if (active("pro")) return "pro";
  return "free";
}

/**
 * Called by the app/web after a purchase or on launch. Determines the user's
 * plan (verified against RevenueCat when REVENUECAT_SECRET_KEY is set, otherwise
 * trusting the client's reported entitlement for dev), and updates Firestore —
 * seeding the monthly credit balance whenever the plan changes.
 */
export const syncSubscription = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const uid = request.auth.uid;

  const verified = await fetchRevenueCatPlan(uid);
  const claimed = normalizePlan(request.data?.plan);
  const plan: PlanId = verified ?? claimed; // verified wins when RC is configured

  const ref = db.collection("users").doc(uid);
  await db.runTransaction(async (tx) => {
    const u = (await tx.get(ref)).data() || {};
    if (u.role === "admin") return; // never downgrade an admin
    const current = normalizePlan(u.plan);
    if (current === plan) {
      tx.set(ref, { plan }, { merge: true });
      return;
    }
    // Plan changed: set the new allotment and start a fresh 30-day cycle.
    tx.set(
      ref,
      {
        plan,
        credits: PLAN_CREDITS[plan],
        creditsRenewAt: Timestamp.fromDate(nextRenewal()),
        planUpdatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });

  return { plan, credits: PLAN_CREDITS[plan] };
});

// ---------------------------------------------------------------------------
// Admin: user monitoring
// ---------------------------------------------------------------------------

/** List Auth users (paged) merged with their Firestore profiles. */
export const adminListUsers = onCall(async (request) => {
  assertAdmin(request);
  const { pageToken, max } = request.data ?? {};
  const result = await auth.listUsers(Math.min(max ?? 100, 1000), pageToken || undefined);

  // Pull each user's Firestore profile for plan / usage / platform insight.
  const profileSnaps = await Promise.all(
    result.users.map((u) => db.collection("users").doc(u.uid).get().catch(() => null))
  );
  const profileByUid: Record<string, FirebaseFirestore.DocumentData> = {};
  profileSnaps.forEach((s) => {
    if (s && s.exists) profileByUid[s.id] = s.data() as FirebaseFirestore.DocumentData;
  });

  const freeDaily = parseInt(process.env.FREE_DAILY || "3", 10);
  const today = new Date().toISOString().slice(0, 10);

  const users = result.users.map((u) => {
    const p = profileByUid[u.uid] || {};
    const isAdmin = u.customClaims?.admin === true;
    const plan = isAdmin ? "admin" : normalizePlan(p.plan);
    return {
      uid: u.uid,
      email: u.email ?? null,
      displayName: u.displayName ?? null,
      photoURL: u.photoURL ?? null,
      disabled: u.disabled,
      emailVerified: u.emailVerified,
      isAnonymous: u.providerData.length === 0,
      providers: u.providerData.map((pr) => pr.providerId),
      admin: isAdmin,
      createdAt: u.metadata.creationTime,
      lastSignInAt: u.metadata.lastSignInTime,
      // Plan / usage / platform (from the Firestore profile):
      plan, // "free" | "pro" | "studio" | "admin"
      credits: plan === "pro" || plan === "studio" ? p.credits ?? 0 : null,
      freeUsedToday: p.freeDate === today ? p.freeUsed ?? 0 : 0,
      platforms: p.platforms || {}, // { web: true, ios: true }
      lastPlatform: p.lastPlatform ?? null,
    };
  });

  return { users, freeDaily, nextPageToken: result.pageToken ?? null };
});

/** Enable / disable a user account. */
export const adminSetDisabled = onCall(async (request) => {
  assertAdmin(request);
  const { uid, disabled } = request.data ?? {};
  if (!uid) throw new HttpsError("invalid-argument", "uid is required.");
  await auth.updateUser(uid, { disabled: disabled === true });
  await db.collection("users").doc(uid).set({ disabled: disabled === true }, { merge: true });
  return { ok: true };
});

/**
 * Admin: permanently delete a user — auth account, profile, AI history, tickets,
 * and all stored images. (onUserDelete keeps the global user count in sync.)
 */
export const adminDeleteUser = onCall(async (request) => {
  const callerUid = assertAdmin(request);
  const { uid } = request.data ?? {};
  if (!uid) throw new HttpsError("invalid-argument", "uid is required.");
  if (uid === callerUid) {
    throw new HttpsError("failed-precondition", "You cannot delete your own account from here.");
  }

  // Firestore: profile, tickets (+ messages), AI job records.
  await db.collection("users").doc(uid).delete().catch(() => undefined);

  const tickets = await db.collection("tickets").where("uid", "==", uid).get();
  for (const t of tickets.docs) await db.recursiveDelete(t.ref).catch(() => undefined);

  const jobs = await db.collection("jobs").where("uid", "==", uid).get();
  for (const j of jobs.docs) await j.ref.delete().catch(() => undefined);

  // Storage: everything under the user's folder.
  await storage.bucket().deleteFiles({ prefix: `users/${uid}/` }).catch(() => undefined);

  // The auth account last (fires onUserDelete, which decrements the user count).
  await auth.deleteUser(uid).catch((e) => {
    logger.error("adminDeleteUser: auth delete failed", e);
    throw new HttpsError("internal", "Could not delete the auth account.");
  });

  return { ok: true };
});

/**
 * Admin: a single user's AI history as metadata only (no image URLs) — e.g.
 * "Un-cropped test.jpg". Used by the dashboard's per-user history view.
 */
export const adminListUserJobs = onCall(async (request) => {
  assertAdmin(request);
  const { uid, max } = request.data ?? {};
  if (!uid) throw new HttpsError("invalid-argument", "uid is required.");
  const snap = await db
    .collection("jobs")
    .where("uid", "==", uid)
    .orderBy("createdAt", "desc")
    .limit(Math.min(max ?? 100, 500))
    .get();
  const jobs = snap.docs.map((d) => {
    const j = d.data();
    const ts = j.createdAt as Timestamp | undefined;
    return {
      id: d.id,
      type: j.type ?? null,
      fileName: j.fileName ?? null,
      aspectRatio: j.aspectRatio ?? null,
      status: j.status ?? null,
      platform: j.platform ?? null,
      expired: j.expired === true,
      hadImage: j.resultUrl != null || j.expired === true,
      createdAt: ts && typeof ts.toDate === "function" ? ts.toDate().toISOString() : null,
    };
  });
  return { jobs };
});

/** Generate a password-reset link for a user with an email/password account. */
export const adminSendPasswordReset = onCall(async (request) => {
  assertAdmin(request);
  const { email } = request.data ?? {};
  if (!email) throw new HttpsError("invalid-argument", "email is required.");
  try {
    // Returns the link so the dashboard can show/copy it. Firebase also emails
    // the user automatically if the default reset template is enabled.
    const link = await auth.generatePasswordResetLink(email);
    return { ok: true, link };
  } catch (e) {
    logger.error("password reset failed", e);
    throw new HttpsError("not-found", "No account with that email, or it is not a password account.");
  }
});

// ---------------------------------------------------------------------------
// Support tickets
// ---------------------------------------------------------------------------

/** Admin: list tickets, optionally filtered by status. */
export const adminListTickets = onCall(async (request) => {
  assertAdmin(request);
  const { status, max } = request.data ?? {};
  let q = db.collection("tickets").orderBy("updatedAt", "desc").limit(Math.min(max ?? 100, 500));
  if (status && status !== "all") {
    q = db
      .collection("tickets")
      .where("status", "==", status)
      .orderBy("updatedAt", "desc")
      .limit(Math.min(max ?? 100, 500));
  }
  const snap = await q.get();
  const tickets = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return { tickets };
});

/** Admin: change a ticket's status (open / pending / closed). */
export const adminUpdateTicket = onCall(async (request) => {
  assertAdmin(request);
  const { ticketId, status } = request.data ?? {};
  if (!ticketId || !["open", "pending", "closed"].includes(status)) {
    throw new HttpsError("invalid-argument", "ticketId and a valid status are required.");
  }
  await db.collection("tickets").doc(ticketId).update({
    status,
    updatedAt: FieldValue.serverTimestamp(),
  });
  return { ok: true };
});

/**
 * Post a reply to a ticket. Usable by an admin (any ticket) or the ticket owner
 * (their own ticket). Keeps the parent ticket's status/updatedAt in sync.
 */
export const addTicketReply = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const { ticketId, body } = request.data ?? {};
  if (!ticketId || !body || typeof body !== "string") {
    throw new HttpsError("invalid-argument", "ticketId and body are required.");
  }
  const ref = db.collection("tickets").doc(ticketId);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError("not-found", "Ticket not found.");

  const isAdmin = request.auth.token.admin === true;
  const isOwner = snap.data()?.uid === request.auth.uid;
  if (!isAdmin && !isOwner) {
    throw new HttpsError("permission-denied", "Not your ticket.");
  }

  await ref.collection("messages").add({
    body: body.slice(0, 4000),
    authorUid: request.auth.uid,
    authorRole: isAdmin ? "admin" : "user",
    createdAt: FieldValue.serverTimestamp(),
  });

  await ref.update({
    status: isAdmin ? "pending" : "open",
    lastReplyRole: isAdmin ? "admin" : "user",
    updatedAt: FieldValue.serverTimestamp(),
  });

  return { ok: true };
});

// ---------------------------------------------------------------------------
// Account deletion (user-initiated). Removes the user's data everywhere, then
// the auth account itself. Runs as Admin SDK so it isn't blocked by the
// "requires recent login" rule a client-side delete would hit.
// ---------------------------------------------------------------------------

export const deleteMyAccount = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const uid = request.auth.uid;

  // Firestore: profile, tickets (+ their messages), AI job records.
  await db.collection("users").doc(uid).delete().catch(() => undefined);

  const tickets = await db.collection("tickets").where("uid", "==", uid).get();
  for (const t of tickets.docs) {
    await db.recursiveDelete(t.ref).catch(() => undefined);
  }

  const jobs = await db.collection("jobs").where("uid", "==", uid).get();
  for (const j of jobs.docs) {
    await j.ref.delete().catch(() => undefined);
  }

  // Storage: everything under the user's folder.
  await storage
    .bucket()
    .deleteFiles({ prefix: `users/${uid}/` })
    .catch(() => undefined);

  await db.doc("stats/global").set(
    { userCount: FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() },
    { merge: true }
  );

  // The auth account last (also fires onUserDelete, which is now a no-op).
  await auth.deleteUser(uid);

  return { ok: true };
});

/**
 * Delete the user's DATA (uploaded photos, saved results, and un-crop history)
 * but KEEP their account and subscription. For the "Delete my data" action.
 */
export const deleteMyData = onCall(async (request) => {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  const uid = request.auth.uid;

  // Stored images (uploads + results).
  await storage.bucket().deleteFiles({ prefix: `users/${uid}/` }).catch(() => undefined);

  // Un-crop history records.
  const jobs = await db.collection("jobs").where("uid", "==", uid).get();
  for (const j of jobs.docs) await j.ref.delete().catch(() => undefined);

  return { ok: true };
});

/**
 * Daily: after RETENTION_DAYS, delete the saved result image but KEEP the job
 * record (so history still shows "Un-cropped photo.jpg" with no preview).
 */
export const cleanupExpiredResults = onSchedule("every 24 hours", async () => {
  const cutoff = Timestamp.fromMillis(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const snap = await db
    .collection("jobs")
    .where("expired", "==", false)
    .where("createdAt", "<", cutoff)
    .orderBy("createdAt", "asc")
    .limit(500)
    .get();

  let cleaned = 0;
  for (const d of snap.docs) {
    await deleteStorageUrl(d.data().resultUrl);
    await d.ref.update({ expired: true, resultUrl: null });
    cleaned++;
  }
  logger.info("cleanupExpiredResults", { scanned: snap.size, cleaned });
});

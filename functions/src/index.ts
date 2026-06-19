/**
 * Cloud Functions for Expand AI.
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
import { auth as authTrigger } from "firebase-functions/v1";
import { logger } from "firebase-functions/v2";
import { FieldValue } from "firebase-admin/firestore";
import { auth, db, storage } from "./admin";

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

// ---------------------------------------------------------------------------
// Admin: user monitoring
// ---------------------------------------------------------------------------

/** List Auth users (paged) merged with their Firestore profiles. */
export const adminListUsers = onCall(async (request) => {
  assertAdmin(request);
  const { pageToken, max } = request.data ?? {};
  const result = await auth.listUsers(Math.min(max ?? 100, 1000), pageToken || undefined);

  const users = result.users.map((u) => ({
    uid: u.uid,
    email: u.email ?? null,
    displayName: u.displayName ?? null,
    photoURL: u.photoURL ?? null,
    disabled: u.disabled,
    emailVerified: u.emailVerified,
    isAnonymous: u.providerData.length === 0,
    providers: u.providerData.map((p) => p.providerId),
    admin: u.customClaims?.admin === true,
    createdAt: u.metadata.creationTime,
    lastSignInAt: u.metadata.lastSignInTime,
  }));

  return { users, nextPageToken: result.pageToken ?? null };
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

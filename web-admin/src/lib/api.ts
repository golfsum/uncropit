import { httpsCallable } from "firebase/functions";
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { functions, db, storage, auth } from "./firebase";

const call = <T = any>(name: string) => httpsCallable<any, T>(functions, name);

/** Stable per-browser id so the free daily quota can't be farmed via new accounts. */
function deviceId(): string {
  try {
    const k = "uncropit.deviceId";
    const existing = localStorage.getItem(k);
    if (existing) return existing;
    const fresh: string =
      (crypto as any)?.randomUUID?.() ?? `web-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    localStorage.setItem(k, fresh);
    return fresh;
  } catch {
    return "web-unknown";
  }
}

// ---- Un-crop (regular users) ----
export interface AiResult {
  ok: boolean;
  jobId: string;
  resultUrl: string;
}

/** Upload a browser File to the signed-in user's Storage folder; return a URL. */
export async function uploadUserImage(file: File): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Sign in to upload.");
  const ext = file.name.split(".").pop() || "jpg";
  const r = ref(storage, `users/${uid}/uploads/${Date.now()}.${ext}`);
  await uploadBytes(r, file, { contentType: file.type || "image/jpeg" });
  return getDownloadURL(r);
}

export async function uncropImage(params: {
  imageUrl: string;
  aspectRatio?: string;
  fileName?: string;
}): Promise<AiResult> {
  const res = await call<AiResult>("aiUncrop")({ ...params, platform: "web", deviceId: deviceId() });
  return res.data;
}

export interface JobRecord {
  id: string;
  type: string;
  fileName: string | null;
  aspectRatio: string | null;
  resultUrl: string | null;
  expired: boolean;
  status: string;
  createdAt?: { seconds: number };
}

/** The signed-in user's un-crop history (newest first). */
export async function listMyJobs(): Promise<JobRecord[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  const q = query(collection(db, "jobs"), where("uid", "==", uid), orderBy("createdAt", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

/** Delete the user's data (images + history) but keep their account. */
export async function deleteMyData(): Promise<void> {
  await call("deleteMyData")({});
}

export interface MyUsage {
  plan: "free" | "pro" | "studio" | "admin";
  credits: number | null; // remaining monthly credits (paid only)
  freeUsedToday: number; // free un-crops used today
  resizeUsedToday: number; // free resizes used today
}

/** Read the signed-in user's server-side plan + usage. */
export async function getMyUsage(): Promise<MyUsage> {
  const uid = auth.currentUser?.uid;
  if (!uid) return { plan: "free", credits: null, freeUsedToday: 0, resizeUsedToday: 0 };
  const snap = await getDoc(doc(db, "users", uid));
  const d = snap.data() || {};
  const plan = d.role === "admin" ? "admin" : d.plan === "pro" || d.plan === "studio" ? d.plan : "free";
  const today = new Date().toISOString().slice(0, 10);
  return {
    plan,
    credits: plan === "pro" || plan === "studio" ? d.credits ?? 0 : null,
    freeUsedToday: d.freeDate === today ? d.freeUsed || 0 : 0,
    resizeUsedToday: d.resizeFreeDate === today ? d.resizeFreeUsed || 0 : 0,
  };
}

/** Re-sync the signed-in user's plan from their RevenueCat entitlement. */
export const syncSubscription = () => call("syncSubscription")({}).then((r) => r.data);

/** Reserve one resize export (free daily quota or 1 credit). Throws if over the limit. */
export const recordResize = () =>
  call("recordResize")({ platform: "web", deviceId: deviceId() }).then((r) => r.data);

/** Permanently delete the signed-in user's account, data, and uploads. */
export async function deleteAccount(): Promise<void> {
  await call("deleteMyAccount")({});
}

/** Submit a support ticket (visible in the admin dashboard). */
export async function createTicket(input: { subject: string; category: string; message: string }): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Sign in to contact support.");
  const ticket = await addDoc(collection(db, "tickets"), {
    uid,
    email: auth.currentUser?.email ?? null,
    subject: input.subject.slice(0, 200),
    category: input.category,
    status: "open",
    lastReplyRole: "user",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await addDoc(collection(db, "tickets", ticket.id, "messages"), {
    body: input.message.slice(0, 4000),
    authorUid: uid,
    authorRole: "user",
    createdAt: serverTimestamp(),
  });
}

export interface AdminUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  disabled: boolean;
  emailVerified: boolean;
  isAnonymous: boolean;
  providers: string[];
  admin: boolean;
  createdAt: string;
  lastSignInAt: string;
  // Plan / usage / platform (from the Firestore profile).
  plan: "free" | "pro" | "studio" | "admin";
  credits: number | null; // remaining monthly credits (paid tiers only)
  freeUsedToday: number; // free un-crops used today
  resizeUsedToday: number; // free resizes used today
  platforms: Record<string, boolean>; // { web: true, ios: true }
  lastPlatform: string | null;
}

export const listUsers = (pageToken?: string) =>
  call<{ users: AdminUser[]; freeDaily: number; nextPageToken: string | null }>("adminListUsers")({
    pageToken,
    max: 200,
  }).then((r) => r.data);

export const setDisabled = (uid: string, disabled: boolean) =>
  call("adminSetDisabled")({ uid, disabled }).then((r) => r.data);

/** Permanently delete a user (auth account + all their data). Admin-only. */
export const deleteUser = (uid: string) =>
  call("adminDeleteUser")({ uid }).then((r) => r.data);

export interface AdminJob {
  id: string;
  type: string | null;
  fileName: string | null;
  aspectRatio: string | null;
  status: string | null;
  platform: string | null;
  expired: boolean;
  hadImage: boolean;
  createdAt: string | null;
}

/** A user's AI history as metadata only (no images). Admin-only. */
export const listUserJobs = (uid: string) =>
  call<{ jobs: AdminJob[] }>("adminListUserJobs")({ uid, max: 200 }).then((r) => r.data.jobs);

export const setAdmin = (uid: string, admin: boolean) =>
  call("setAdminClaim")({ uid, admin }).then((r) => r.data);

/** Grant the admin claim if this user's UID is in the ADMIN_UIDS env allowlist. */
export const syncAdminClaim = () => call("syncAdminClaim")({}).then((r) => r.data);

export const sendPasswordReset = (email: string) =>
  call<{ ok: boolean; link: string }>("adminSendPasswordReset")({ email }).then((r) => r.data);

export interface AdminTicket {
  id: string;
  uid: string;
  email: string | null;
  subject: string;
  category: string;
  status: "open" | "pending" | "closed";
  lastReplyRole?: string;
}

export const listTickets = (status: string) =>
  call<{ tickets: AdminTicket[] }>("adminListTickets")({ status, max: 200 }).then((r) => r.data.tickets);

export const updateTicket = (ticketId: string, status: string) =>
  call("adminUpdateTicket")({ ticketId, status }).then((r) => r.data);

export const replyTicket = (ticketId: string, body: string) =>
  call("addTicketReply")({ ticketId, body }).then((r) => r.data);

export interface TicketMessage {
  id: string;
  body: string;
  authorRole: string;
  createdAt?: any;
}

export async function getTicketMessages(ticketId: string): Promise<TicketMessage[]> {
  const q = query(collection(db, "tickets", ticketId, "messages"), orderBy("createdAt", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

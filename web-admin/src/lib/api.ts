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
  const res = await call<AiResult>("aiUncrop")(params);
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

/** Read the signed-in user's server-side usage (free un-crops used). */
export async function getMyUsage(): Promise<{ used: number; pro: boolean }> {
  const uid = auth.currentUser?.uid;
  if (!uid) return { used: 0, pro: false };
  const snap = await getDoc(doc(db, "users", uid));
  const d = snap.data() || {};
  return { used: d.uncropsUsed || 0, pro: d.pro === true || d.role === "admin" };
}

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
}

export const listUsers = (pageToken?: string) =>
  call<{ users: AdminUser[]; nextPageToken: string | null }>("adminListUsers")({ pageToken, max: 200 }).then(
    (r) => r.data
  );

export const setDisabled = (uid: string, disabled: boolean) =>
  call("adminSetDisabled")({ uid, disabled }).then((r) => r.data);

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

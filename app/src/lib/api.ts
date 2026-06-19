import { Platform } from "react-native";
import { httpsCallable } from "firebase/functions";
import {
  addDoc,
  collection,
  serverTimestamp,
  query,
  where,
  orderBy,
  getDocs,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { functions, db, storage, auth } from "./firebase";
import { getDeviceId } from "./device";

// ---- AI proxy callables ----
const _uncrop = httpsCallable(functions, "aiUncrop");
const _reply = httpsCallable(functions, "addTicketReply");
const _deleteAccount = httpsCallable(functions, "deleteMyAccount");
const _deleteData = httpsCallable(functions, "deleteMyData");
const _syncSubscription = httpsCallable(functions, "syncSubscription");
const _recordResize = httpsCallable(functions, "recordResize");

/** Reserve one resize export (free daily quota or 1 credit). Throws if over the limit. */
export async function recordResize(): Promise<void> {
  const deviceId = await getDeviceId();
  await _recordResize({ platform: Platform.OS, deviceId });
}

/** Re-sync this account's plan from its RevenueCat entitlement (server-verified). */
export async function syncSubscription(plan?: string): Promise<{ plan: string; credits: number }> {
  const res = await _syncSubscription(plan ? { plan } : {});
  return res.data as { plan: string; credits: number };
}

/** Permanently delete the signed-in user's account, data, and uploads. */
export async function deleteAccount(): Promise<void> {
  await _deleteAccount({});
}

/** Delete the user's data (images + history) but keep their account. */
export async function deleteMyData(): Promise<void> {
  await _deleteData({});
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

export interface AiResult {
  ok: boolean;
  jobId: string;
  resultUrl: string;
}

/** Upload a local file URI to the signed-in user's Storage folder; returns a download URL. */
export async function uploadUserImage(localUri: string): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in.");
  const res = await fetch(localUri);
  const blob = await res.blob();
  const ext = localUri.split(".").pop()?.split("?")[0] || "jpg";
  const path = `users/${uid}/uploads/${Date.now()}.${ext}`;
  const r = ref(storage, path);
  await uploadBytes(r, blob, { contentType: blob.type || "image/jpeg" });
  return getDownloadURL(r);
}

export async function uncropImage(params: {
  imageUrl: string;
  prompt?: string;
  aspectRatio?: string; // e.g. "16:9", "1:1", "4:5", "9:16"
  fileName?: string;
}): Promise<AiResult> {
  const deviceId = await getDeviceId();
  const res = await _uncrop({ ...params, platform: Platform.OS, deviceId });
  return res.data as AiResult;
}

// ---- Support tickets ----
export interface Ticket {
  id: string;
  subject: string;
  category: string;
  status: "open" | "pending" | "closed";
  updatedAt?: any;
}

export async function createTicket(input: {
  subject: string;
  category: string;
  message: string;
}): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Not signed in.");

  const docRef = await addDoc(collection(db, "tickets"), {
    uid,
    email: auth.currentUser?.email ?? null,
    subject: input.subject.slice(0, 200),
    category: input.category,
    status: "open",
    lastReplyRole: "user",
    appVersion: "1.0.0",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  // First message lives in the subcollection.
  await addDoc(collection(db, "tickets", docRef.id, "messages"), {
    body: input.message.slice(0, 4000),
    authorUid: uid,
    authorRole: "user",
    createdAt: serverTimestamp(),
  });

  return docRef.id;
}

export async function listMyTickets(): Promise<Ticket[]> {
  const uid = auth.currentUser?.uid;
  if (!uid) return [];
  const q = query(
    collection(db, "tickets"),
    where("uid", "==", uid),
    orderBy("updatedAt", "desc")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function replyToTicket(ticketId: string, body: string): Promise<void> {
  await _reply({ ticketId, body });
}

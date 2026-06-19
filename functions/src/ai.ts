/**
 * AI inference proxy.
 *
 * The iOS app NEVER holds the inference API key. It calls these callables with
 * an image (and parameters); we run the job on a cloud provider, persist a job
 * record, and return the result URL.
 *
 * Default provider: Replicate. Swap the `runReplicate` body to use Fal, Modal,
 * your own GPU box, etc. When you later add on-device CoreML, the app's useAi()
 * hook can bypass these entirely — the contract (image in, image/video out)
 * stays the same.
 */
import { onCall, HttpsError, CallableRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { randomUUID } from "crypto";
import { db, storage } from "./admin";
import {
  FREE_DAILY,
  PLAN_CREDITS,
  isPaidPlan,
  normalizePlan,
  dayKey,
  nextRenewal,
} from "./plans";

// Copy an (ephemeral) result image into the user's Storage and return a durable
// Firebase download URL (token-protected). Used for Pro history.
async function persistResult(uid: string, srcUrl: string): Promise<string> {
  const res = await fetch(srcUrl);
  if (!res.ok) throw new Error("could not fetch result for storage");
  const buf = Buffer.from(await res.arrayBuffer());
  const path = `users/${uid}/results/${Date.now()}.jpg`;
  const token = randomUUID();
  await storage.bucket().file(path).save(buf, {
    contentType: "image/jpeg",
    metadata: { metadata: { firebaseStorageDownloadTokens: token } },
  });
  const bucket = storage.bucket().name;
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}

// Delete a transient source upload once processing is done (parsed from its URL).
async function deleteSource(url: string): Promise<void> {
  const m = url.match(/\/o\/([^?]+)/);
  if (!m) return;
  const path = decodeURIComponent(m[1]);
  if (!path.startsWith("users/")) return;
  await storage.bucket().file(path).delete().catch(() => undefined);
}

interface AiInput {
  imageUrl: string; // public/download URL of the user's source image (in Storage)
  prompt?: string;
  // Uncrop target aspect ratio, e.g. "16:9", "1:1", "4:5", "9:16".
  aspectRatio?: string;
  // Original file name, kept for the history label ("Un-cropped photo.jpg").
  fileName?: string;
  // Where the request came from: "web" | "ios" | "android" (for admin insight).
  platform?: string;
  // Stable device id (keychain/localStorage UUID) — free quota is shared across
  // all accounts on the same device to stop trial farming.
  deviceId?: string;
  // Animate: optional per-request driving video URL (overrides the env default).
  drivingVideoUrl?: string;
  template?: string;
}

function requireAuth(request: CallableRequest): string {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  return request.auth.uid;
}

/** Fields recording which platform the account is active on (for the dashboard). */
function platformPatch(platform: string | null): Record<string, unknown> {
  if (!platform) return {};
  return {
    lastPlatform: platform,
    platforms: { [platform]: true },
    lastActiveAt: FieldValue.serverTimestamp(),
  };
}

async function runReplicate(model: string, input: Record<string, unknown>): Promise<string> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) {
    throw new HttpsError(
      "failed-precondition",
      "AI provider is not configured. Set REPLICATE_API_TOKEN in functions/.env."
    );
  }
  if (!model) {
    throw new HttpsError("failed-precondition", "No model configured for this operation.");
  }

  logger.info("Replicate request", { model, input });

  // Kick off a prediction against an official model, asking Replicate to wait.
  const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait",
    },
    body: JSON.stringify({ input }),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error("Replicate error", { status: res.status, text });
    throw new HttpsError("internal", `Inference provider error (${res.status}).`);
  }

  let prediction = (await res.json()) as {
    id: string;
    status: string;
    output: unknown;
    urls?: { get?: string };
    error?: string;
  };

  // Poll if still running (Prefer: wait covers most cases, but guard anyway).
  let tries = 0;
  while (["starting", "processing"].includes(prediction.status) && tries < 60) {
    await new Promise((r) => setTimeout(r, 2000));
    const poll = await fetch(prediction.urls!.get!, {
      headers: { Authorization: `Bearer ${token}` },
    });
    prediction = (await poll.json()) as typeof prediction;
    tries++;
  }

  if (prediction.status !== "succeeded") {
    throw new HttpsError("internal", prediction.error || `Inference failed (${prediction.status}).`);
  }

  const out = prediction.output;
  const url = Array.isArray(out) ? out[out.length - 1] : out;
  logger.info("Replicate output", { model, rawOutput: out, resultUrl: url });
  if (typeof url !== "string") {
    throw new HttpsError("internal", "Provider returned no output URL.");
  }
  return url;
}

async function recordJob(
  uid: string,
  type: "uncrop" | "animate",
  input: AiInput,
  status: string,
  resultUrl?: string,
  error?: string
) {
  const ref = await db.collection("jobs").add({
    uid,
    type,
    fileName: input.fileName ?? null,
    aspectRatio: input.aspectRatio ?? null,
    platform: input.platform ?? null,
    status,
    resultUrl: resultUrl ?? null,
    expired: false, // set true by the 30-day cleanup once the image is deleted
    error: error ?? null,
    createdAt: FieldValue.serverTimestamp(),
  });
  return ref.id;
}

// Map the app's aspect ratios to Ideogram V3's supported resolution enum.
const IDEOGRAM_RES: Record<string, string> = {
  "1:1": "1024x1024",
  "4:5": "896x1152",
  "3:2": "1216x832",
  "16:9": "1344x768",
  "9:16": "768x1344",
};

/**
 * Ideogram V3 Reframe — outpaints a single image to a target resolution with
 * no mask. Cheapest at rendering_speed=TURBO. The image is sent as a multipart
 * file upload; the API key goes in the Api-Key header (never in the client).
 */
async function runIdeogramReframe(imageUrl: string, resolution: string): Promise<string> {
  const key = process.env.IDEOGRAM_API_KEY;
  if (!key) {
    throw new HttpsError(
      "failed-precondition",
      "Ideogram is not configured. Set IDEOGRAM_API_KEY in functions/.env."
    );
  }

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new HttpsError("internal", "Could not read the source image.");
  const bytes = await imgRes.arrayBuffer();
  const contentType = imgRes.headers.get("content-type") || "image/jpeg";

  const form = new FormData();
  form.append("image", new Blob([bytes], { type: contentType }), "image.jpg");
  form.append("resolution", resolution);
  form.append("rendering_speed", process.env.IDEOGRAM_RENDERING_SPEED || "TURBO");

  logger.info("Ideogram reframe request", { resolution });

  const res = await fetch("https://api.ideogram.ai/v1/ideogram-v3/reframe", {
    method: "POST",
    headers: { "Api-Key": key },
    body: form as any,
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error("Ideogram error", { status: res.status, text });
    throw new HttpsError("internal", `Ideogram error (${res.status}).`);
  }

  const data = (await res.json()) as { data?: { url?: string }[] };
  const url = data?.data?.[0]?.url;
  logger.info("Ideogram output", { resultUrl: url });
  if (!url) throw new HttpsError("internal", "Ideogram returned no image URL.");
  return url;
}

export const aiUncrop = onCall({ timeoutSeconds: 300, memory: "512MiB" }, async (request) => {
  const uid = requireAuth(request);
  const input = (request.data ?? {}) as AiInput;
  if (!input.imageUrl) throw new HttpsError("invalid-argument", "imageUrl is required.");

  const provider = (process.env.AI_PROVIDER || "ideogram").toLowerCase();
  const aspect = input.aspectRatio || process.env.REPLICATE_UNCROP_ASPECT || "16:9";

  // --- Server-side usage gate (un-bypassable via cache/incognito) ---
  // Paid tiers spend monthly credits; free tier gets FREE_DAILY un-crops per UTC
  // day, counted against BOTH the account and the device (so making new accounts
  // on the same device can't farm extra free credits).
  const platform = typeof input.platform === "string" ? input.platform : null;
  const deviceId =
    typeof input.deviceId === "string" && input.deviceId.length >= 8
      ? input.deviceId.slice(0, 128)
      : null;
  const today = dayKey();

  const userRef = db.collection("users").doc(uid);
  const deviceRef = deviceId ? db.collection("devices").doc(deviceId) : null;
  const isAdmin = request.auth!.token.admin === true;

  // `reserved` is the kind of slot we took, so we can refund it if the run fails.
  let reserved: "credit" | "free" | null = null;
  // Paid tiers (and admins) get a durable saved copy of the result for history.
  let keepResult = false;

  await db.runTransaction(async (tx) => {
    const u = (await tx.get(userRef)).data() || {};
    const dev = deviceRef ? (await tx.get(deviceRef)).data() || {} : {};

    // Admins are unlimited and never charged.
    if (isAdmin || u.role === "admin") {
      keepResult = true;
      tx.set(userRef, platformPatch(platform), { merge: true });
      return;
    }

    const plan = normalizePlan(u.plan);

    if (isPaidPlan(plan)) {
      // Lazy monthly refill: top up to the plan allotment once the period rolls.
      const renewAt: Timestamp | undefined = u.creditsRenewAt;
      const due = !renewAt || renewAt.toMillis() <= Date.now();
      let credits = due ? PLAN_CREDITS[plan] : u.credits ?? 0;
      const patch: Record<string, unknown> = { ...platformPatch(platform) };
      if (due) patch.creditsRenewAt = Timestamp.fromDate(nextRenewal());

      if (credits <= 0) {
        const when = renewAt ? renewAt.toDate().toLocaleDateString() : "next cycle";
        throw new HttpsError(
          "resource-exhausted",
          `You're out of credits. They renew on ${when}, or upgrade to Studio for more.`
        );
      }
      patch.credits = credits - 1;
      tx.set(userRef, patch, { merge: true });
      reserved = "credit";
      keepResult = true;
      return;
    }

    // --- Free tier: per-account daily count ---
    const accUsed = u.freeDate === today ? u.freeUsed ?? 0 : 0;
    if (accUsed >= FREE_DAILY) {
      throw new HttpsError(
        "resource-exhausted",
        `You've used all ${FREE_DAILY} free un-crops for today. They reset tomorrow, or upgrade for more.`
      );
    }

    // --- Free tier: per-device daily count (shared across accounts) ---
    if (deviceRef) {
      const devUsed = dev.date === today ? dev.used ?? 0 : 0;
      if (devUsed >= FREE_DAILY) {
        throw new HttpsError(
          "resource-exhausted",
          `This device has used all ${FREE_DAILY} free un-crops for today. They reset tomorrow, or upgrade for more.`
        );
      }
      tx.set(
        deviceRef,
        { date: today, used: devUsed + 1, uids: FieldValue.arrayUnion(uid), updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    }

    tx.set(
      userRef,
      { freeDate: today, freeUsed: accUsed + 1, ...platformPatch(platform) },
      { merge: true }
    );
    reserved = "free";
  });

  try {
    let resultUrl: string;

    if (provider === "ideogram") {
      const resolution = IDEOGRAM_RES[aspect] || IDEOGRAM_RES["16:9"];
      resultUrl = await runIdeogramReframe(input.imageUrl, resolution);
    } else {
      // Replicate / bria fallback (set AI_PROVIDER=replicate to use this).
      const model = process.env.REPLICATE_UNCROP_MODEL || "bria/expand-image";
      const imageField = process.env.REPLICATE_UNCROP_IMAGE_FIELD || "image_url";
      const ratioField = process.env.REPLICATE_UNCROP_RATIO_FIELD || "aspect_ratio";
      resultUrl = await runReplicate(model, {
        [imageField]: input.imageUrl,
        [ratioField]: aspect,
        prompt: input.prompt || "extend the scene naturally with a seamless, photorealistic background",
      });
    }

    // Paid/admin users get a durable saved copy for history; free users get the
    // ephemeral provider URL (download-only).
    const finalUrl = keepResult ? await persistResult(uid, resultUrl).catch(() => resultUrl) : resultUrl;
    const jobId = await recordJob(uid, "uncrop", input, "succeeded", finalUrl);
    return { ok: true, jobId, resultUrl: finalUrl };
  } catch (e) {
    // Refund whatever we reserved if the run itself failed.
    if (reserved === "credit") {
      await userRef.set({ credits: FieldValue.increment(1) }, { merge: true }).catch(() => undefined);
    } else if (reserved === "free") {
      await userRef
        .set({ freeUsed: FieldValue.increment(-1) }, { merge: true })
        .catch(() => undefined);
      if (deviceRef) {
        await deviceRef.set({ used: FieldValue.increment(-1) }, { merge: true }).catch(() => undefined);
      }
    }
    await recordJob(uid, "uncrop", input, "failed", undefined, String((e as Error).message));
    throw e;
  } finally {
    // The source upload is transient — delete it once processing is done.
    await deleteSource(input.imageUrl).catch(() => undefined);
  }
});

export const aiAnimate = onCall({ timeoutSeconds: 300, memory: "512MiB" }, async (request) => {
  const uid = requireAuth(request);
  const input = (request.data ?? {}) as AiInput;
  if (!input.imageUrl) throw new HttpsError("invalid-argument", "imageUrl is required.");

  // LivePortrait maps motion from a DRIVING VIDEO onto the still photo, so it
  // needs two inputs: the user's photo + a short clip of facial motion. Supply
  // one canned clip via REPLICATE_DRIVING_VIDEO_URL (or per-request override).
  const drivingVideoUrl = input.drivingVideoUrl || process.env.REPLICATE_DRIVING_VIDEO_URL;
  if (!drivingVideoUrl) {
    throw new HttpsError(
      "failed-precondition",
      "No driving video configured. Set REPLICATE_DRIVING_VIDEO_URL in functions/.env to a short clip of facial motion."
    );
  }

  // Field names vary between LivePortrait builds — confirm them on the model's
  // API tab and override via env if they differ from these defaults.
  const sourceField = process.env.REPLICATE_ANIMATE_IMAGE_FIELD || "image";
  const drivingField = process.env.REPLICATE_ANIMATE_VIDEO_FIELD || "driving_video";

  try {
    const resultUrl = await runReplicate(process.env.REPLICATE_ANIMATE_MODEL || "", {
      [sourceField]: input.imageUrl,
      [drivingField]: drivingVideoUrl,
    });
    const jobId = await recordJob(uid, "animate", input, "succeeded", resultUrl);
    return { ok: true, jobId, resultUrl };
  } catch (e) {
    await recordJob(uid, "animate", input, "failed", undefined, String((e as Error).message));
    throw e;
  }
});

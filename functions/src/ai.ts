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
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./admin";

interface AiInput {
  imageUrl: string; // public/download URL of the user's source image (in Storage)
  prompt?: string;
  // Uncrop target aspect ratio, e.g. "16:9", "1:1", "4:5", "9:16".
  aspectRatio?: string;
  // Animate: optional per-request driving video URL (overrides the env default).
  drivingVideoUrl?: string;
  template?: string;
}

function requireAuth(request: CallableRequest): string {
  if (!request.auth) throw new HttpsError("unauthenticated", "Sign in required.");
  return request.auth.uid;
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
    input,
    status,
    resultUrl: resultUrl ?? null,
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

  // --- Server-side free-usage limit (un-bypassable via cache/incognito) ---
  // The count lives on the user's account, checked + reserved atomically here.
  const FREE_LIMIT = parseInt(process.env.FREE_UNCROPS || "3", 10);
  const userRef = db.collection("users").doc(uid);
  const reserved = await db.runTransaction(async (tx) => {
    const u = (await tx.get(userRef)).data() || {};
    const isPro =
      request.auth!.token.admin === true || u.pro === true || u.role === "admin";
    if (isPro) return false; // Pro / admin → unlimited, nothing to reserve.
    const used = u.uncropsUsed || 0;
    if (used >= FREE_LIMIT) {
      throw new HttpsError(
        "resource-exhausted",
        `You've used all ${FREE_LIMIT} free un-crops. Upgrade to Pro to continue.`
      );
    }
    tx.set(userRef, { uncropsUsed: used + 1 }, { merge: true });
    return true; // Reserved one free slot.
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

    const jobId = await recordJob(uid, "uncrop", input, "succeeded", resultUrl);
    return { ok: true, jobId, resultUrl };
  } catch (e) {
    // Refund the reserved free slot if the run itself failed.
    if (reserved) {
      await userRef
        .set({ uncropsUsed: FieldValue.increment(-1) }, { merge: true })
        .catch(() => undefined);
    }
    await recordJob(uid, "uncrop", input, "failed", undefined, String((e as Error).message));
    throw e;
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

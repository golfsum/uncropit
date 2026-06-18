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
  // Uncrop target aspect / padding, in pixels relative to source.
  expand?: { left?: number; right?: number; top?: number; bottom?: number };
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

export const aiUncrop = onCall({ timeoutSeconds: 300, memory: "512MiB" }, async (request) => {
  const uid = requireAuth(request);
  const input = (request.data ?? {}) as AiInput;
  if (!input.imageUrl) throw new HttpsError("invalid-argument", "imageUrl is required.");

  try {
    const resultUrl = await runReplicate(process.env.REPLICATE_UNCROP_MODEL || "", {
      image: input.imageUrl,
      prompt: input.prompt || "extend the scene naturally, photorealistic, seamless background",
      // Most outpaint models take a mask; for a turnkey scaffold we pass the
      // expand hints through and let the chosen model interpret them.
      ...input.expand,
    });
    const jobId = await recordJob(uid, "uncrop", input, "succeeded", resultUrl);
    return { ok: true, jobId, resultUrl };
  } catch (e) {
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

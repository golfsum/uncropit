/**
 * Subscription plans + credit economics. Every number is env-overridable so the
 * pricing/allotments can be tuned without a code change (set these in
 * functions/.env, then redeploy functions).
 *
 *   COGS is ~$0.04 per un-crop (Ideogram). Keep `*_CREDITS` low enough that even
 *   a fully-utilised subscriber stays profitable after the 15-30% store cut.
 */
export type PlanId = "free" | "pro" | "studio";

function num(v: string | undefined, fallback: number): number {
  const x = parseInt(v ?? "", 10);
  return Number.isFinite(x) ? x : fallback;
}

/** Free un-crops per rolling day (UTC), enforced per account AND per device. */
export const FREE_DAILY = num(process.env.FREE_DAILY, 3);

/** Monthly credit allotments for the paid tiers (1 credit = 1 un-crop). */
export const PLAN_CREDITS: Record<PlanId, number> = {
  free: 0,
  pro: num(process.env.PRO_CREDITS, 100),
  studio: num(process.env.STUDIO_CREDITS, 400),
};

export function isPaidPlan(plan?: string | null): plan is "pro" | "studio" {
  return plan === "pro" || plan === "studio";
}

export function normalizePlan(plan?: string | null): PlanId {
  return plan === "pro" || plan === "studio" ? plan : "free";
}

/** UTC day key, e.g. "2026-06-19", for the daily free counter. */
export function dayKey(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Monthly credit-renewal instant, 30 days from `from`. */
export function nextRenewal(from: Date = new Date()): Date {
  return new Date(from.getTime() + 30 * 24 * 60 * 60 * 1000);
}

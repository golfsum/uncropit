import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { doc, onSnapshot } from "firebase/firestore";
import Constants from "expo-constants";
import { db } from "./firebase";
import { useAuth } from "./auth";
import { initPurchases, getActivePlan } from "./purchases";
import { syncSubscription } from "./api";

/** Free un-crops per day (mirrors functions/src/plans.ts FREE_DAILY). */
export const FREE_DAILY = 3;
/** Free resize exports per day (mirrors functions/src/plans.ts RESIZE_FREE_DAILY). */
export const RESIZE_FREE_DAILY = 3;

export type Plan = "free" | "pro" | "studio" | "admin";
export type AccessStatus = "loading" | Plan;

interface EntitlementState {
  status: AccessStatus;
  plan: Plan;
  isPaid: boolean; // pro or studio
  credits: number | null; // remaining monthly credits (paid tiers)
  freeUsedToday: number;
  freeRemaining: number;
  resizeUsedToday: number;
  resizeRemaining: number;
  refresh: () => Promise<void>;
}

const Ctx = createContext<EntitlementState | undefined>(undefined);

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export function EntitlementProvider({ children }: { children: React.ReactNode }) {
  const { user, initializing } = useAuth();
  const [plan, setPlan] = useState<Plan>("free");
  const [credits, setCredits] = useState<number | null>(null);
  const [freeUsedToday, setFreeUsedToday] = useState(0);
  const [resizeUsedToday, setResizeUsedToday] = useState(0);
  const [ready, setReady] = useState(false);
  const syncedFor = useRef<string | null>(null);

  const rcKey = (Constants.expoConfig?.extra as any)?.revenueCatIosKey || undefined;

  // Verify the RevenueCat entitlement and push it to the server, which sets the
  // Firestore plan + seeds credits. The onSnapshot below then reflects it.
  const refresh = useCallback(async () => {
    if (!user) {
      setReady(true);
      return;
    }
    try {
      await initPurchases(rcKey, user.uid);
      const rcPlan = await getActivePlan();
      await syncSubscription(rcPlan).catch(() => undefined);
    } catch {
      // ignore — free tier still works
    } finally {
      setReady(true);
    }
  }, [rcKey, user?.uid]);

  // Run the subscription sync once auth resolves / the user changes.
  useEffect(() => {
    if (initializing) return;
    if (user && syncedFor.current !== user.uid) {
      syncedFor.current = user.uid;
      refresh();
    } else if (!user) {
      setReady(true);
    }
  }, [initializing, user?.uid, refresh]);

  // Live-read the user's plan / credits / daily usage from Firestore.
  useEffect(() => {
    if (!user) {
      setPlan("free");
      setCredits(null);
      setFreeUsedToday(0);
      setResizeUsedToday(0);
      return;
    }
    const unsub = onSnapshot(
      doc(db, "users", user.uid),
      (snap) => {
        const d = snap.data() || {};
        const p: Plan =
          d.role === "admin" ? "admin" : d.plan === "pro" || d.plan === "studio" ? d.plan : "free";
        const today = todayKey();
        setPlan(p);
        setCredits(p === "pro" || p === "studio" ? d.credits ?? 0 : null);
        setFreeUsedToday(d.freeDate === today ? d.freeUsed ?? 0 : 0);
        setResizeUsedToday(d.resizeFreeDate === today ? d.resizeFreeUsed ?? 0 : 0);
        setReady(true);
      },
      () => setReady(true)
    );
    return unsub;
  }, [user?.uid]);

  const isPaid = plan === "pro" || plan === "studio";
  const freeRemaining = Math.max(0, FREE_DAILY - freeUsedToday);
  const resizeRemaining = Math.max(0, RESIZE_FREE_DAILY - resizeUsedToday);

  const status: AccessStatus = useMemo(() => {
    if (!ready) return "loading";
    return plan;
  }, [ready, plan]);

  const value = useMemo<EntitlementState>(
    () => ({ status, plan, isPaid, credits, freeUsedToday, freeRemaining, resizeUsedToday, resizeRemaining, refresh }),
    [status, plan, isPaid, credits, freeUsedToday, freeRemaining, resizeUsedToday, resizeRemaining, refresh]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEntitlement() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useEntitlement must be used within <EntitlementProvider>");
  return ctx;
}

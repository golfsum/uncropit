import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { useAuth } from "./auth";
import { initPurchases, getIsPro } from "./purchases";

const TRIAL_DAYS = 3;
const TRIAL_KEY = "uncropit.trialStartAt";
const DAY_MS = 24 * 60 * 60 * 1000;

export type AccessStatus = "loading" | "trial" | "trialExpired" | "pro";

interface EntitlementState {
  status: AccessStatus;
  isPro: boolean;
  trialDaysLeft: number;
  trialEndsAt: number | null;
  refresh: () => Promise<void>;
}

const Ctx = createContext<EntitlementState | undefined>(undefined);

export function EntitlementProvider({ children }: { children: React.ReactNode }) {
  const { user, initializing } = useAuth();
  const [trialStart, setTrialStart] = useState<number | null>(null);
  const [isPro, setIsPro] = useState(false);
  const [ready, setReady] = useState(false);

  const rcKey = (Constants.expoConfig?.extra as any)?.revenueCatIosKey || undefined;

  // Establish the device-local trial start on first launch.
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(TRIAL_KEY);
        if (stored) {
          setTrialStart(parseInt(stored, 10));
        } else {
          const now = Date.now();
          await AsyncStorage.setItem(TRIAL_KEY, String(now));
          setTrialStart(now);
        }
      } catch {
        setTrialStart(Date.now());
      }
    })();
  }, []);

  const refresh = useCallback(async () => {
    await initPurchases(rcKey, user?.uid ?? null);
    setIsPro(await getIsPro());
    setReady(true);
  }, [rcKey, user?.uid]);

  // (Re)check entitlements whenever auth resolves or the user changes.
  useEffect(() => {
    if (!initializing) refresh();
  }, [initializing, refresh]);

  const trialEndsAt = trialStart != null ? trialStart + TRIAL_DAYS * DAY_MS : null;
  const trialDaysLeft =
    trialEndsAt != null ? Math.max(0, Math.ceil((trialEndsAt - Date.now()) / DAY_MS)) : 0;

  const status: AccessStatus = useMemo(() => {
    if (!ready || trialStart == null) return "loading";
    if (isPro) return "pro";
    if (trialEndsAt != null && Date.now() < trialEndsAt) return "trial";
    return "trialExpired";
  }, [ready, trialStart, isPro, trialEndsAt]);

  const value = useMemo<EntitlementState>(
    () => ({ status, isPro, trialDaysLeft, trialEndsAt, refresh }),
    [status, isPro, trialDaysLeft, trialEndsAt, refresh]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useEntitlement() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useEntitlement must be used within <EntitlementProvider>");
  return ctx;
}

// Exposed for display elsewhere.
export const TRIAL_LENGTH_DAYS = TRIAL_DAYS;

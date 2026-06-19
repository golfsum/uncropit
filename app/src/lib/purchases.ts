/**
 * Thin wrapper around RevenueCat (react-native-purchases).
 *
 * Everything is guarded so the app still runs where the native module isn't
 * available or isn't configured (Expo Go, missing API key): purchases simply
 * report "free" and the server-side free daily quota stays in charge.
 *
 * Real subscriptions require:
 *   - A paid Apple Developer account + App Store Connect with FOUR auto-renewable
 *     subscription products in one group:
 *       Pro:    uncropit_pro_monthly ($9.99),  uncropit_pro_yearly ($99.99)
 *       Studio: uncropit_studio_monthly ($29.99), uncropit_studio_yearly ($299.99)
 *   - A RevenueCat project with TWO entitlements, "pro" (attached to the Pro
 *     products) and "studio" (attached to the Studio products), and the iOS
 *     public API key in EXPO_PUBLIC_REVENUECAT_IOS_KEY.
 *   - A dev/standalone build (not Expo Go).
 *
 * The credit allotments live server-side (functions/src/plans.ts) and are granted
 * by syncSubscription() once a purchase is verified, so they can't be faked.
 */
import type { PurchasesPackage, CustomerInfo } from "react-native-purchases";

export type PlanTier = "free" | "pro" | "studio";

// RevenueCat entitlement identifiers.
export const ENTITLEMENTS = { pro: "pro", studio: "studio" } as const;

// Product identifiers to create in App Store Connect / RevenueCat.
export const PRODUCT_IDS = {
  proMonthly: "uncropit_pro_monthly",
  proYearly: "uncropit_pro_yearly",
  studioMonthly: "uncropit_studio_monthly",
  studioYearly: "uncropit_studio_yearly",
};

// Display fallbacks used when RevenueCat isn't returning live prices yet.
export const PRICE_FALLBACK = {
  pro: { monthly: "$9.99", yearly: "$99.99" },
  studio: { monthly: "$29.99", yearly: "$299.99" },
};

// Monthly credits per tier (mirrors functions/src/plans.ts for display only).
export const TIER_CREDITS = { pro: 100, studio: 300 };

let configured = false;

function mod(): any | null {
  try {
    // Lazy require so importing this file never crashes Expo Go.
    return require("react-native-purchases").default;
  } catch {
    return null;
  }
}

export function purchasesAvailable(): boolean {
  return mod() != null;
}

export async function initPurchases(apiKey?: string, appUserId?: string | null): Promise<boolean> {
  const P = mod();
  if (!P || !apiKey) return false;
  try {
    if (!configured) {
      P.configure({ apiKey, appUserID: appUserId ?? undefined });
      configured = true;
    } else if (appUserId) {
      await P.logIn(appUserId).catch(() => undefined);
    }
    return true;
  } catch {
    return false;
  }
}

/** The highest active entitlement (studio > pro) for the current customer. */
function planFrom(info: CustomerInfo | undefined): PlanTier {
  const active = info?.entitlements?.active ?? {};
  if (active[ENTITLEMENTS.studio]) return "studio";
  if (active[ENTITLEMENTS.pro]) return "pro";
  return "free";
}

export async function getActivePlan(): Promise<PlanTier> {
  const P = mod();
  if (!P || !configured) return "free";
  try {
    return planFrom(await P.getCustomerInfo());
  } catch {
    return "free";
  }
}

export async function getPackages(): Promise<PurchasesPackage[]> {
  const P = mod();
  if (!P || !configured) return [];
  try {
    const offerings = await P.getOfferings();
    return offerings?.current?.availablePackages ?? [];
  } catch {
    return [];
  }
}

export async function purchase(pkg: PurchasesPackage): Promise<PlanTier> {
  const P = mod();
  if (!P || !configured) return "free";
  const { customerInfo } = await P.purchasePackage(pkg);
  return planFrom(customerInfo);
}

export async function restore(): Promise<PlanTier> {
  const P = mod();
  if (!P || !configured) return "free";
  try {
    return planFrom(await P.restorePurchases());
  } catch {
    return "free";
  }
}

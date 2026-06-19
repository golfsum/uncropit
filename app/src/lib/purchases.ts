/**
 * Thin wrapper around RevenueCat (react-native-purchases).
 *
 * Everything is guarded so the app still runs where the native module isn't
 * available or isn't configured (Expo Go, missing API key): purchases simply
 * report "not available" and the trial logic stays in charge.
 *
 * Real subscriptions require:
 *   - A paid Apple Developer account + App Store Connect with two auto-renewable
 *     subscription products (monthly $3.99, yearly $39.99) sharing a group, with
 *     a 3-day free trial as an introductory offer.
 *   - A RevenueCat project with an entitlement named "pro" attached to both, and
 *     the iOS public API key in EXPO_PUBLIC_REVENUECAT_IOS_KEY.
 *   - A dev/standalone build (not Expo Go).
 */
import type { PurchasesPackage, CustomerInfo } from "react-native-purchases";

export const PRO_ENTITLEMENT = "pro";

// Product identifiers to create in App Store Connect / RevenueCat.
export const PRODUCT_IDS = {
  monthly: "uncropit_pro_monthly",
  yearly: "uncropit_pro_yearly",
};

// Display fallbacks used when RevenueCat isn't returning live prices yet.
export const PRICE_FALLBACK = {
  monthly: "$3.99",
  yearly: "$39.99",
};

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

function hasPro(info: CustomerInfo | undefined): boolean {
  return !!info?.entitlements?.active?.[PRO_ENTITLEMENT];
}

export async function getIsPro(): Promise<boolean> {
  const P = mod();
  if (!P || !configured) return false;
  try {
    return hasPro(await P.getCustomerInfo());
  } catch {
    return false;
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

export async function purchase(pkg: PurchasesPackage): Promise<boolean> {
  const P = mod();
  if (!P || !configured) return false;
  const { customerInfo } = await P.purchasePackage(pkg);
  return hasPro(customerInfo);
}

export async function restore(): Promise<boolean> {
  const P = mod();
  if (!P || !configured) return false;
  try {
    return hasPro(await P.restorePurchases());
  } catch {
    return false;
  }
}

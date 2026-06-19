import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, ActivityIndicator, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as AppleAuthentication from "expo-apple-authentication";
import type { PurchasesPackage } from "react-native-purchases";
import { useAuth } from "../src/lib/auth";
import { useEntitlement } from "../src/lib/entitlements";
import { getPackages, purchase, restore, PRICE_FALLBACK } from "../src/lib/purchases";
import { theme } from "../src/theme";

const BENEFITS = [
  "Unlimited AI un-crop",
  "Export for every platform + App Store",
  "Favicon (PNG & SVG) export",
  "No watermarks, priority processing",
];

type Plan = "yearly" | "monthly";

export default function Paywall() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signInGoogle, signInApple } = useAuth();
  const { refresh, trialDaysLeft, status } = useEntitlement();

  const signedIn = !!user && !user.isAnonymous;
  const [plan, setPlan] = useState<Plan>("yearly");
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getPackages().then(setPackages);
  }, []);

  // Live price from RevenueCat if available, else the configured fallback.
  function priceFor(p: Plan): string {
    const pkg = packages.find((x) =>
      p === "yearly" ? x.packageType === "ANNUAL" : x.packageType === "MONTHLY"
    );
    return pkg?.product.priceString ?? PRICE_FALLBACK[p];
  }

  async function doSignIn(kind: "google" | "apple") {
    try {
      setBusy(kind);
      await (kind === "google" ? signInGoogle() : signInApple());
      await refresh();
    } catch (e: any) {
      if (e?.code !== "ERR_REQUEST_CANCELED") Alert.alert("Sign-in failed", e?.message ?? "Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function subscribe() {
    const pkg = packages.find((x) =>
      plan === "yearly" ? x.packageType === "ANNUAL" : x.packageType === "MONTHLY"
    );
    if (!pkg) {
      Alert.alert(
        "Not available yet",
        "In-app purchases aren't configured in this build. Build a dev/standalone app and set up the subscription products in App Store Connect + RevenueCat to enable upgrading."
      );
      return;
    }
    try {
      setBusy("buy");
      const ok = await purchase(pkg);
      await refresh();
      if (ok) {
        Alert.alert("You're Pro ✓", "Thanks for subscribing!");
        router.replace("/(app)");
      }
    } catch (e: any) {
      if (e?.userCancelled !== true) Alert.alert("Purchase failed", e?.message ?? "Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function doRestore() {
    try {
      setBusy("restore");
      const ok = await restore();
      await refresh();
      Alert.alert(ok ? "Restored ✓" : "Nothing to restore", ok ? "Your Pro access is active." : "No previous purchase found.");
      if (ok) router.replace("/(app)");
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
    >
      <Ionicons name="sparkles" size={40} color={theme.primary} style={{ alignSelf: "center" }} />
      <Text style={styles.title}>
        {status === "trialExpired" ? "Your free trial has ended" : "Go Pro"}
      </Text>
      <Text style={styles.subtitle}>
        {status === "trialExpired"
          ? "Sign in and subscribe to keep using Uncrop it AI."
          : trialDaysLeft > 0
          ? `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left in your free trial.`
          : "Unlock everything."}
      </Text>

      <View style={styles.benefits}>
        {BENEFITS.map((b) => (
          <View key={b} style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={20} color={theme.accent} />
            <Text style={styles.benefitTxt}>{b}</Text>
          </View>
        ))}
      </View>

      {/* Plans */}
      <Pressable onPress={() => setPlan("yearly")} style={[styles.plan, plan === "yearly" && styles.planActive]}>
        <View style={styles.badge}><Text style={styles.badgeTxt}>BEST VALUE · SAVE 16%</Text></View>
        <View style={styles.planRow}>
          <View>
            <Text style={styles.planName}>Yearly</Text>
            <Text style={styles.planSub}>{priceFor("yearly")} / year</Text>
          </View>
          <Ionicons
            name={plan === "yearly" ? "radio-button-on" : "radio-button-off"}
            size={24}
            color={plan === "yearly" ? theme.primary : theme.textDim}
          />
        </View>
      </Pressable>

      <Pressable onPress={() => setPlan("monthly")} style={[styles.plan, plan === "monthly" && styles.planActive]}>
        <View style={styles.planRow}>
          <View>
            <Text style={styles.planName}>Monthly</Text>
            <Text style={styles.planSub}>{priceFor("monthly")} / month</Text>
          </View>
          <Ionicons
            name={plan === "monthly" ? "radio-button-on" : "radio-button-off"}
            size={24}
            color={plan === "monthly" ? theme.primary : theme.textDim}
          />
        </View>
      </Pressable>

      {/* Primary action: sign in first (required), then subscribe. */}
      {!signedIn ? (
        <View style={{ gap: 10, marginTop: 18 }}>
          <Text style={styles.note}>Sign in to continue — your subscription is tied to your account.</Text>
          {Platform.OS === "ios" && (
            <Pressable style={[styles.cta, styles.ctaApple]} onPress={() => doSignIn("apple")} disabled={!!busy}>
              {busy === "apple" ? <ActivityIndicator /> : <Text style={styles.ctaAppleTxt}> Continue with Apple</Text>}
            </Pressable>
          )}
          <Pressable style={[styles.cta, styles.ctaGhost]} onPress={() => doSignIn("google")} disabled={!!busy}>
            {busy === "google" ? <ActivityIndicator color={theme.text} /> : <Text style={styles.ctaGhostTxt}>Continue with Google</Text>}
          </Pressable>
        </View>
      ) : (
        <Pressable style={[styles.cta, styles.ctaPrimary]} onPress={subscribe} disabled={!!busy}>
          {busy === "buy" ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.ctaPrimaryTxt}>
              Subscribe — {priceFor(plan)}{plan === "yearly" ? "/yr" : "/mo"}
            </Text>
          )}
        </Pressable>
      )}

      <Pressable onPress={doRestore} disabled={!!busy} style={{ marginTop: 16, alignSelf: "center" }}>
        <Text style={styles.restore}>{busy === "restore" ? "Restoring…" : "Restore purchases"}</Text>
      </Pressable>

      {status !== "trialExpired" && (
        <Pressable onPress={() => router.back()} style={{ marginTop: 20, alignSelf: "center" }}>
          <Text style={styles.maybeLater}>Maybe later</Text>
        </Pressable>
      )}

      <Text style={styles.legal}>
        Subscriptions auto-renew until cancelled. Manage or cancel anytime in your App Store account settings.
        A 3-day free trial applies to new subscribers. Terms & Privacy apply.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  container: { paddingHorizontal: 22 },
  title: { color: theme.text, fontSize: 26, fontWeight: "800", textAlign: "center", marginTop: 12 },
  subtitle: { color: theme.textDim, fontSize: 15, textAlign: "center", marginTop: 6 },
  benefits: { marginVertical: 22, gap: 12 },
  benefitRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  benefitTxt: { color: theme.text, fontSize: 15 },
  plan: {
    backgroundColor: theme.surface,
    borderWidth: 2,
    borderColor: theme.border,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  planActive: { borderColor: theme.primary },
  planRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  planName: { color: theme.text, fontSize: 18, fontWeight: "700" },
  planSub: { color: theme.textDim, fontSize: 14, marginTop: 2 },
  badge: { position: "absolute", top: -10, left: 16, backgroundColor: theme.primary, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999 },
  badgeTxt: { color: "#fff", fontSize: 10, fontWeight: "800" },
  cta: { minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  ctaPrimary: { backgroundColor: theme.primary, marginTop: 18 },
  ctaPrimaryTxt: { color: "#fff", fontSize: 17, fontWeight: "800" },
  ctaApple: { backgroundColor: "#fff" },
  ctaAppleTxt: { color: "#000", fontSize: 16, fontWeight: "700" },
  ctaGhost: { backgroundColor: theme.surfaceAlt },
  ctaGhostTxt: { color: theme.text, fontSize: 16, fontWeight: "700" },
  note: { color: theme.textDim, fontSize: 13, textAlign: "center", marginBottom: 4 },
  restore: { color: theme.primary, fontSize: 15, fontWeight: "600" },
  maybeLater: { color: theme.textDim, fontSize: 15 },
  legal: { color: theme.textDim, fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 24 },
});

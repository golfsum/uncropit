import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, Alert, ScrollView, ActivityIndicator, Platform } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { PurchasesPackage } from "react-native-purchases";
import { useAuth } from "../src/lib/auth";
import { useEntitlement } from "../src/lib/entitlements";
import { getPackages, purchase, restore, PRODUCT_IDS, PRICE_FALLBACK, TIER_CREDITS } from "../src/lib/purchases";
import { theme } from "../src/theme";

type Tier = "pro" | "studio";
type Period = "yearly" | "monthly";

const TIERS: {
  id: Tier;
  name: string;
  credits: number;
  benefits: string[];
}[] = [
  {
    id: "pro",
    name: "Pro",
    credits: TIER_CREDITS.pro,
    benefits: [
      `${TIER_CREDITS.pro} credits / month`,
      "Fast TURBO processing",
      "No watermarks",
      "Saved history (30 days)",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    credits: TIER_CREDITS.studio,
    benefits: [
      `${TIER_CREDITS.studio} credits / month`,
      "Everything in Pro",
      "Batch editing",
      "Early access to new features",
    ],
  },
];

export default function Paywall() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, signInGoogle, signInApple } = useAuth();
  const { refresh, freeRemaining } = useEntitlement();

  const signedIn = !!user && !user.isAnonymous;
  const [tier, setTier] = useState<Tier>("pro");
  const [period, setPeriod] = useState<Period>("yearly");
  const [packages, setPackages] = useState<PurchasesPackage[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getPackages().then(setPackages);
  }, []);

  function productId(t: Tier, p: Period): string {
    if (t === "pro") return p === "yearly" ? PRODUCT_IDS.proYearly : PRODUCT_IDS.proMonthly;
    return p === "yearly" ? PRODUCT_IDS.studioYearly : PRODUCT_IDS.studioMonthly;
  }

  function pkgFor(t: Tier, p: Period): PurchasesPackage | undefined {
    const id = productId(t, p);
    return packages.find((x) => x.product.identifier === id);
  }

  function priceFor(t: Tier, p: Period): string {
    return pkgFor(t, p)?.product.priceString ?? PRICE_FALLBACK[t][p];
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
    const pkg = pkgFor(tier, period);
    if (!pkg) {
      Alert.alert(
        "Not available yet",
        "In-app purchases aren't configured in this build. Build a dev/standalone app and set up the subscription products in App Store Connect + RevenueCat to enable upgrading."
      );
      return;
    }
    try {
      setBusy("buy");
      const newPlan = await purchase(pkg);
      await refresh();
      if (newPlan !== "free") {
        Alert.alert(`You're ${newPlan === "studio" ? "Studio" : "Pro"} ✓`, "Thanks for subscribing!");
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
      const plan = await restore();
      await refresh();
      Alert.alert(
        plan !== "free" ? "Restored ✓" : "Nothing to restore",
        plan !== "free" ? `Your ${plan === "studio" ? "Studio" : "Pro"} access is active.` : "No previous purchase found."
      );
      if (plan !== "free") router.replace("/(app)");
    } finally {
      setBusy(null);
    }
  }

  const selected = TIERS.find((t) => t.id === tier)!;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
    >
      <Ionicons name="sparkles" size={40} color={theme.primary} style={{ alignSelf: "center" }} />
      <Text style={styles.title}>Upgrade UnCrop It</Text>
      <Text style={styles.subtitle}>
        You have {freeRemaining} free un-crop{freeRemaining === 1 ? "" : "s"} left today. Subscribe for monthly credits.
      </Text>

      {/* Tier picker */}
      <View style={styles.segment}>
        {TIERS.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setTier(t.id)}
            style={[styles.segBtn, tier === t.id && styles.segBtnActive]}
          >
            <Text style={[styles.segTxt, tier === t.id && styles.segTxtActive]}>{t.name}</Text>
          </Pressable>
        ))}
      </View>

      {/* Benefits for the selected tier */}
      <View style={styles.benefits}>
        {selected.benefits.map((b) => (
          <View key={b} style={styles.benefitRow}>
            <Ionicons name="checkmark-circle" size={20} color={theme.accent} />
            <Text style={styles.benefitTxt}>{b}</Text>
          </View>
        ))}
      </View>

      {/* Period */}
      <Pressable onPress={() => setPeriod("yearly")} style={[styles.plan, period === "yearly" && styles.planActive]}>
        <View style={styles.badge}><Text style={styles.badgeTxt}>BEST VALUE</Text></View>
        <View style={styles.planRow}>
          <View>
            <Text style={styles.planName}>Yearly</Text>
            <Text style={styles.planSub}>{priceFor(tier, "yearly")} / year</Text>
          </View>
          <Ionicons
            name={period === "yearly" ? "radio-button-on" : "radio-button-off"}
            size={24}
            color={period === "yearly" ? theme.primary : theme.textDim}
          />
        </View>
      </Pressable>

      <Pressable onPress={() => setPeriod("monthly")} style={[styles.plan, period === "monthly" && styles.planActive]}>
        <View style={styles.planRow}>
          <View>
            <Text style={styles.planName}>Monthly</Text>
            <Text style={styles.planSub}>{priceFor(tier, "monthly")} / month</Text>
          </View>
          <Ionicons
            name={period === "monthly" ? "radio-button-on" : "radio-button-off"}
            size={24}
            color={period === "monthly" ? theme.primary : theme.textDim}
          />
        </View>
      </Pressable>

      {/* Sign in first (required), then subscribe. */}
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
              Get {selected.name} — {priceFor(tier, period)}{period === "yearly" ? "/yr" : "/mo"}
            </Text>
          )}
        </Pressable>
      )}

      <Pressable onPress={doRestore} disabled={!!busy} style={{ marginTop: 16, alignSelf: "center" }}>
        <Text style={styles.restore}>{busy === "restore" ? "Restoring…" : "Restore purchases"}</Text>
      </Pressable>

      <Pressable onPress={() => router.back()} style={{ marginTop: 20, alignSelf: "center" }}>
        <Text style={styles.maybeLater}>Maybe later</Text>
      </Pressable>

      <Text style={styles.legal}>
        Subscriptions auto-renew until cancelled. Manage or cancel anytime in your App Store account settings.
        Unused monthly credits do not roll over. Terms & Privacy apply.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  container: { paddingHorizontal: 22 },
  title: { color: theme.text, fontSize: 26, fontWeight: "800", textAlign: "center", marginTop: 12 },
  subtitle: { color: theme.textDim, fontSize: 15, textAlign: "center", marginTop: 6 },
  segment: {
    flexDirection: "row",
    backgroundColor: theme.surfaceAlt,
    borderRadius: 12,
    padding: 4,
    marginTop: 20,
  },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
  segBtnActive: { backgroundColor: theme.primary },
  segTxt: { color: theme.textDim, fontSize: 15, fontWeight: "700" },
  segTxtActive: { color: "#fff" },
  benefits: { marginVertical: 20, gap: 12 },
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

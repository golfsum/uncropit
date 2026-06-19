import React from "react";
import { View, Text, Image, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { theme } from "../theme";
import { useEntitlement } from "../lib/entitlements";

// App logo (assets/icon.png) shown next to the title.
const LOGO = require("../../assets/icon.png");

/** The app's brand title — defined once, used by every screen header. */
export const APP_TITLE = "Uncrop it AI: Photo Extender & Resizer";

/** Compact, tappable usage pill — credits for subscribers, free-left otherwise. */
function UsagePill({ kind }: { kind: "uncrop" | "resize" }) {
  const router = useRouter();
  const { plan, isPaid, credits, freeRemaining, resizeRemaining } = useEntitlement();

  const freeLeft = kind === "resize" ? resizeRemaining : freeRemaining;
  const freeLabel = kind === "resize" ? `${freeLeft} resizes today` : `${freeLeft} free today`;
  const label =
    plan === "admin" ? "Admin" : isPaid ? `${credits ?? 0} credits` : freeLabel;

  const low = (isPaid && (credits ?? 0) <= 5) || (!isPaid && freeLeft <= 0);

  return (
    <Pressable
      onPress={() => router.push("/paywall")}
      style={[styles.pill, low && styles.pillLow]}
      hitSlop={8}
    >
      <Text style={[styles.pillTxt, low && styles.pillTxtLow]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Shared screen header: the brand title moved tight to the top, with an
 * optional subtitle and a right-aligned action (e.g. the Photo button).
 * Handles the top safe-area inset itself. Shows a usage/credits pill by default.
 */
export function ScreenHeader({
  subtitle,
  right,
  showUsage = true,
  usageKind = "uncrop",
}: {
  subtitle?: string;
  right?: React.ReactNode;
  showUsage?: boolean;
  usageKind?: "uncrop" | "resize";
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
      <View style={styles.titleRow}>
        <Image source={LOGO} style={styles.logo} />
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {APP_TITLE}
        </Text>
        {showUsage && <UsagePill kind={usageKind} />}
      </View>
      {(subtitle || right) && (
        <View style={styles.row}>
          {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : <View style={{ flex: 1 }} />}
          {right}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingBottom: 8, gap: 6, backgroundColor: theme.bg },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 30, height: 30, borderRadius: 7 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  title: { color: theme.text, fontSize: 21, fontWeight: "800", lineHeight: 26, flex: 1 },
  sub: { color: theme.textDim, fontSize: 13, flex: 1 },
  pill: {
    backgroundColor: theme.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: theme.border,
  },
  pillLow: { backgroundColor: "rgba(255,92,114,0.15)", borderColor: theme.danger },
  pillTxt: { color: theme.text, fontSize: 12, fontWeight: "700" },
  pillTxtLow: { color: theme.danger },
});

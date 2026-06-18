import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { theme } from "../theme";

// App logo (assets/icon.png) shown next to the title.
const LOGO = require("../../assets/icon.png");

/** The app's brand title — defined once, used by every screen header. */
export const APP_TITLE = "Uncrop it AI: Photo Extender & Resizer";

/**
 * Shared screen header: the brand title moved tight to the top, with an
 * optional subtitle and a right-aligned action (e.g. the Photo button).
 * Handles the top safe-area inset itself.
 */
export function ScreenHeader({
  subtitle,
  right,
}: {
  subtitle?: string;
  right?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 4 }]}>
      <View style={styles.titleRow}>
        <Image source={LOGO} style={styles.logo} />
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
          {APP_TITLE}
        </Text>
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
});

import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "../theme";

export type LimitReason = "OUT_OF_FREE_DAILY" | "OUT_OF_CREDITS" | "GENERIC";

/**
 * Shown when an un-crop is blocked server-side (resource-exhausted): the free
 * daily quota is spent, or a subscriber is out of monthly credits.
 */
export default function OutOfCreditsModal({
  open,
  reason,
  message,
  onClose,
  onUpgrade,
}: {
  open: boolean;
  reason: LimitReason;
  message?: string;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  const isCredits = reason === "OUT_OF_CREDITS";
  const title = isCredits ? "You're out of credits" : "You've hit today's limit";
  const body =
    message ||
    (isCredits
      ? "You've used all your monthly credits. Upgrade to Studio for 300 credits a month, or wait for your next cycle."
      : "You've used your 3 free un-crops for today. Upgrade for 100+ monthly un-crops, batch editing, and no daily limit.");

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={() => {}}>
          <View style={styles.iconWrap}>
            <Ionicons name="sparkles" size={26} color={theme.primary} />
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.body}>{body}</Text>
          <Pressable style={[styles.cta, styles.ctaPrimary]} onPress={onUpgrade}>
            <Text style={styles.ctaPrimaryTxt}>{isCredits ? "Upgrade to Studio" : "View plans"}</Text>
          </Pressable>
          <Pressable style={[styles.cta, styles.ctaGhost]} onPress={onClose}>
            <Text style={styles.ctaGhostTxt}>Maybe later</Text>
          </Pressable>
          <Text style={styles.fine}>Cancel anytime. No hidden fees.</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: theme.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 28,
    alignItems: "center",
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: "rgba(124,92,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  title: { color: theme.text, fontSize: 22, fontWeight: "800", textAlign: "center" },
  body: { color: theme.textDim, fontSize: 14, lineHeight: 21, textAlign: "center", marginTop: 12 },
  cta: { width: "100%", minHeight: 50, borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 12 },
  ctaPrimary: { backgroundColor: theme.primary },
  ctaPrimaryTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },
  ctaGhost: { backgroundColor: theme.surfaceAlt },
  ctaGhostTxt: { color: theme.text, fontSize: 15, fontWeight: "600" },
  fine: { color: theme.textDim, fontSize: 12, marginTop: 14 },
});

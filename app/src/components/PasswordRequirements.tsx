import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { checkPassword } from "../lib/password";
import { theme } from "../theme";

/** Live checklist that ticks each rule green as the password satisfies it. */
export function PasswordRequirements({ password }: { password: string }) {
  const checks = checkPassword(password);
  return (
    <View style={styles.box}>
      <Text style={styles.heading}>Password must include:</Text>
      {checks.map((c) => (
        <View key={c.id} style={styles.row}>
          <Ionicons
            name={c.met ? "checkmark-circle" : "ellipse-outline"}
            size={16}
            color={c.met ? theme.accent : theme.textDim}
          />
          <Text style={[styles.label, c.met ? styles.met : styles.unmet]}>{c.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: theme.surfaceAlt, borderRadius: 12, padding: 12, gap: 6 },
  heading: { color: theme.textDim, fontSize: 12, fontWeight: "600", marginBottom: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontSize: 13 },
  met: { color: theme.text },
  unmet: { color: theme.textDim },
});

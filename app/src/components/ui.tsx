import React from "react";
import {
  Text,
  TextProps,
  Pressable,
  PressableProps,
  ActivityIndicator,
  View,
  StyleSheet,
} from "react-native";
import { theme } from "../theme";

export function Title(props: TextProps) {
  return <Text {...props} style={[styles.title, props.style]} />;
}
export function Subtitle(props: TextProps) {
  return <Text {...props} style={[styles.subtitle, props.style]} />;
}
export function Body(props: TextProps) {
  return <Text {...props} style={[styles.body, props.style]} />;
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({
  label,
  onPress,
  loading,
  variant = "primary",
  icon,
  ...rest
}: {
  label: string;
  onPress?: () => void;
  loading?: boolean;
  variant?: "primary" | "outline" | "ghost" | "apple";
  icon?: React.ReactNode;
} & PressableProps) {
  const v = styles[`btn_${variant}` as const];
  const t = styles[`btnText_${variant}` as const];
  return (
    <Pressable
      onPress={onPress}
      disabled={loading || rest.disabled}
      style={({ pressed }) => [
        styles.btn,
        v,
        (pressed || rest.disabled) && { opacity: 0.7 },
      ]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#fff" : theme.text} />
      ) : (
        <View style={styles.btnRow}>
          {icon}
          <Text style={[styles.btnText, t]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  title: { color: theme.text, fontSize: 26, fontWeight: "800" },
  subtitle: { color: theme.text, fontSize: 18, fontWeight: "700" },
  body: { color: theme.textDim, fontSize: 15, lineHeight: 21 },
  card: {
    backgroundColor: theme.surface,
    borderRadius: theme.radius,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 18,
  },
  btn: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  btnRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  btnText: { fontSize: 16, fontWeight: "700" },
  btn_primary: { backgroundColor: theme.primary },
  btnText_primary: { color: "#fff" },
  btn_outline: { backgroundColor: "transparent", borderWidth: 1, borderColor: theme.border },
  btnText_outline: { color: theme.text },
  btn_ghost: { backgroundColor: theme.surfaceAlt },
  btnText_ghost: { color: theme.text },
  btn_apple: { backgroundColor: "#fff" },
  btnText_apple: { color: "#000" },
});

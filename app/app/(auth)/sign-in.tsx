import { useState } from "react";
import { View, StyleSheet, Platform, Alert, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/lib/auth";
import { Button, Title, Body } from "../../src/components/ui";
import { theme } from "../../src/theme";

export default function SignIn() {
  const { signInAnon, signInGoogle, signInApple } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<string | null>(null);

  async function run(kind: string, fn: () => Promise<void>) {
    try {
      setBusy(kind);
      await fn();
      router.replace("/(app)");
    } catch (e: any) {
      if (e?.code !== "ERR_REQUEST_CANCELED") {
        Alert.alert("Sign-in failed", e?.message ?? "Please try again.");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 32 }]}
    >
      <View style={styles.logo}>
        <Title style={{ fontSize: 40, textAlign: "center" }}>Expand AI</Title>
        <Body style={{ textAlign: "center", marginTop: 8 }}>
          Un-crop photos to widescreen and bring them to life — powered by AI.
        </Body>
      </View>

      <View style={styles.actions}>
        {Platform.OS === "ios" && (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
            cornerRadius={14}
            style={styles.appleBtn}
            onPress={() => run("apple", signInApple)}
          />
        )}

        <Button
          label="Continue with Google"
          variant="ghost"
          loading={busy === "google"}
          onPress={() => run("google", signInGoogle)}
        />

        <Button
          label="Continue as Guest"
          variant="outline"
          loading={busy === "anon"}
          onPress={() => run("anon", signInAnon)}
        />
      </View>

      <Body style={styles.legal}>
        By continuing you agree to our Terms of Service and Privacy Policy.
      </Body>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 24, justifyContent: "space-between" },
  logo: { marginTop: 40 },
  actions: { gap: 14, marginVertical: 40 },
  appleBtn: { height: 52, width: "100%" },
  legal: { fontSize: 12, textAlign: "center", color: theme.textDim },
});

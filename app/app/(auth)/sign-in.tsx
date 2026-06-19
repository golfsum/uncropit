import { useState } from "react";
import {
  View,
  StyleSheet,
  Platform,
  Alert,
  ScrollView,
  TextInput,
  Pressable,
  Text,
} from "react-native";
import { useRouter } from "expo-router";
import * as AppleAuthentication from "expo-apple-authentication";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/lib/auth";
import { Button, Title, Body } from "../../src/components/ui";
import { PasswordRequirements } from "../../src/components/PasswordRequirements";
import { passwordValid, missingCriteria } from "../../src/lib/password";
import { theme } from "../../src/theme";

type Mode = "signin" | "signup";

export default function SignIn() {
  const { signInGoogle, signInApple, signUpEmail, signInEmail } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<string | null>(null);

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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

  async function submitEmail() {
    if (!email.includes("@")) return Alert.alert("Enter your email", "Please enter a valid email address.");
    if (mode === "signup" && !passwordValid(password)) {
      return Alert.alert("Password doesn't meet the policy", "Still needed:\n• " + missingCriteria(password).join("\n• "));
    }
    await run("email", () => (mode === "signup" ? signUpEmail(email, password) : signInEmail(email, password)));
  }

  const canSubmitEmail = email.length > 0 && password.length > 0 && (mode === "signin" || passwordValid(password));

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.container, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 32 }]}
    >
      <View style={styles.logo}>
        <Title style={{ fontSize: 34, textAlign: "center" }}>Uncrop it AI</Title>
        <Body style={{ textAlign: "center", marginTop: 8 }}>
          Un-crop photos to widescreen and resize for any platform.
        </Body>
      </View>

      {/* Email / password */}
      <View style={styles.emailBox}>
        <View style={styles.tabs}>
          {(["signin", "signup"] as Mode[]).map((m) => (
            <Pressable key={m} onPress={() => setMode(m)} style={[styles.tab, mode === m && styles.tabActive]}>
              <Text style={[styles.tabTxt, mode === m && styles.tabTxtActive]}>
                {m === "signin" ? "Sign in" : "Create account"}
              </Text>
            </Pressable>
          ))}
        </View>

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={theme.textDim}
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          style={styles.input}
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={theme.textDim}
          secureTextEntry
          autoCapitalize="none"
          style={styles.input}
        />

        {mode === "signup" && <PasswordRequirements password={password} />}

        <Button
          label={mode === "signup" ? "Create account" : "Sign in"}
          loading={busy === "email"}
          disabled={!canSubmitEmail}
          onPress={submitEmail}
        />
      </View>

      <View style={styles.divider}>
        <View style={styles.line} />
        <Text style={styles.or}>or</Text>
        <View style={styles.line} />
      </View>

      {/* Social sign-in (a real account is required to use the app) */}
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
        <Button label="Continue with Google" variant="ghost" loading={busy === "google"} onPress={() => run("google", signInGoogle)} />
      </View>

      <Body style={styles.legal}>By continuing you agree to our Terms of Service and Privacy Policy.</Body>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: 24, gap: 8 },
  logo: { marginTop: 12, marginBottom: 16 },
  emailBox: { gap: 12 },
  tabs: { flexDirection: "row", backgroundColor: theme.surfaceAlt, borderRadius: 12, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: "center" },
  tabActive: { backgroundColor: theme.primary },
  tabTxt: { color: theme.textDim, fontWeight: "700" },
  tabTxtActive: { color: "#fff" },
  input: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: theme.text,
    fontSize: 16,
  },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 18 },
  line: { flex: 1, height: 1, backgroundColor: theme.border },
  or: { color: theme.textDim, fontSize: 13 },
  actions: { gap: 14 },
  appleBtn: { height: 52, width: "100%" },
  legal: { fontSize: 12, textAlign: "center", color: theme.textDim, marginTop: 24 },
});

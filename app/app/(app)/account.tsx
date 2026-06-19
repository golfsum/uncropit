import { useState } from "react";
import { View, Text, StyleSheet, ScrollView, Alert, Pressable, Linking } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, Card, Body, Subtitle } from "../../src/components/ui";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { useAuth } from "../../src/lib/auth";
import { useEntitlement } from "../../src/lib/entitlements";
import { deleteAccount } from "../../src/lib/api";
import { theme } from "../../src/theme";

const TERMS_URL = "https://www.ndsoft.dev/apps/uncrop-it/terms";
const PRIVACY_URL = "https://www.ndsoft.dev/apps/uncrop-it/privacy";
const MANAGE_SUBS_URL = "https://apps.apple.com/account/subscriptions";

function providerLabel(user: ReturnType<typeof useAuth>["user"]): string {
  if (!user || user.isAnonymous) return "Guest";
  const map: Record<string, string> = {
    "google.com": "Google",
    "apple.com": "Apple",
    password: "Email",
  };
  const labels = user.providerData.map((p) => map[p.providerId]).filter(Boolean);
  return labels.length ? labels.join(", ") : "Email";
}

export default function AccountScreen() {
  const { user, signOut, signInGoogle, signInApple } = useAuth();
  const { status, isPro, trialDaysLeft } = useEntitlement();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  const isAnon = user?.isAnonymous;

  function confirmDelete() {
    Alert.alert(
      "Delete account & data?",
      "This permanently deletes your account, support tickets, and uploaded photos. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setBusy("delete");
              await deleteAccount();
              await signOut();
            } catch (e: any) {
              Alert.alert("Couldn't delete", e?.message ?? "Please try again.");
            } finally {
              setBusy(null);
            }
          },
        },
      ]
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader subtitle="Manage your account." />
      <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
        {/* Subscription status — whole card is tappable when not Pro */}
        {!isPro ? (
          <Pressable onPress={() => router.push("/paywall")} style={{ marginTop: 4, marginBottom: 14 }}>
            <Card>
              <View style={styles.planRow}>
                <View style={{ flex: 1 }}>
                  <Subtitle>Free trial</Subtitle>
                  <Body style={{ marginTop: 4 }}>
                    {status === "trialExpired"
                      ? "Your trial has ended."
                      : `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left in your free trial.`}
                  </Body>
                  <Text style={styles.upgrade}>Tap to upgrade to Pro →</Text>
                </View>
                <Ionicons name="chevron-forward" size={22} color={theme.textDim} />
              </View>
            </Card>
          </Pressable>
        ) : (
          <Card style={{ marginTop: 4, marginBottom: 14, borderColor: theme.accent }}>
            <View style={styles.planRow}>
              <View style={{ flex: 1 }}>
                <Subtitle>Pro ✓</Subtitle>
                <Body style={{ marginTop: 4 }}>Thanks for subscribing — everything's unlocked.</Body>
              </View>
              <Ionicons name="star" size={26} color={theme.accent} />
            </View>
            <Pressable onPress={() => Linking.openURL(MANAGE_SUBS_URL)} style={{ marginTop: 14 }}>
              <Text style={styles.link}>Manage or cancel subscription</Text>
            </Pressable>
          </Card>
        )}

        {/* Account info */}
        <Card>
          <Subtitle>{user?.displayName || (isAnon ? "Guest" : "Signed in")}</Subtitle>
          <Body style={{ marginTop: 4 }}>{user?.email || "No email on file"}</Body>
          <View style={styles.metaRow}>
            <Ionicons name="key-outline" size={14} color={theme.textDim} />
            <Body style={styles.meta}>Signed in with {providerLabel(user)}</Body>
          </View>
          <Body style={{ marginTop: 6, fontSize: 12 }}>UID: {user?.uid}</Body>

          {isAnon && (
            <View style={{ marginTop: 16, gap: 10 }}>
              <Body>Link a permanent account so you never lose your work:</Body>
              <Button label="Link Google" variant="ghost" onPress={() => signInGoogle().catch(noop)} />
              <Button label="Link Apple" variant="ghost" onPress={() => signInApple().catch(noop)} />
            </View>
          )}
        </Card>

        {/* Help & About */}
        <Subtitle style={{ marginTop: 24, marginBottom: 8 }}>Help & About</Subtitle>
        <Card>
          <Pressable style={styles.aboutRow} onPress={() => router.push("/support")}>
            <View style={styles.rowLeft}>
              <Ionicons name="chatbubbles-outline" size={18} color={theme.text} />
              <Body style={styles.aboutTxt}>Support & feedback</Body>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textDim} />
          </Pressable>
          <View style={styles.sep} />
          <Pressable style={styles.aboutRow} onPress={() => Linking.openURL(TERMS_URL)}>
            <Body style={styles.aboutTxt}>Terms of Service</Body>
            <Ionicons name="open-outline" size={18} color={theme.textDim} />
          </Pressable>
          <View style={styles.sep} />
          <Pressable style={styles.aboutRow} onPress={() => Linking.openURL(PRIVACY_URL)}>
            <Body style={styles.aboutTxt}>Privacy Policy</Body>
            <Ionicons name="open-outline" size={18} color={theme.textDim} />
          </Pressable>
        </Card>

        {/* Sign out + delete, pinned to the bottom */}
        <Button
          label="Sign out"
          variant="ghost"
          style={{ marginTop: 32 }}
          onPress={() =>
            Alert.alert("Sign out?", "You can sign back in anytime.", [
              { text: "Cancel", style: "cancel" },
              { text: "Sign out", style: "destructive", onPress: () => signOut() },
            ])
          }
        />

        <Pressable onPress={confirmDelete} disabled={busy === "delete"} style={styles.deleteBtn}>
          <Ionicons name="trash-outline" size={18} color={theme.danger} />
          <Text style={styles.deleteTxt}>{busy === "delete" ? "Deleting…" : "Delete account & data"}</Text>
        </Pressable>

        <Body style={styles.version}>UnCrop It v1.0.0</Body>
      </ScrollView>
    </View>
  );
}

const noop = () => {};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  screen: { flex: 1, backgroundColor: theme.bg },
  container: { padding: 20, flexGrow: 1, backgroundColor: theme.bg },
  planRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  upgrade: { color: theme.primary, fontWeight: "700", marginTop: 10 },
  link: { color: theme.primary, fontWeight: "600", fontSize: 15 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  meta: { fontSize: 13 },
  deleteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 12, paddingVertical: 14 },
  deleteTxt: { color: theme.danger, fontWeight: "700", fontSize: 15 },
  aboutRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 12 },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  aboutTxt: { color: theme.text, fontSize: 15 },
  sep: { height: 1, backgroundColor: theme.border },
  version: { textAlign: "center", marginTop: 30, fontSize: 12, color: theme.textDim },
});

import { View, StyleSheet, ScrollView, Alert } from "react-native";
import { Button, Card, Body, Subtitle } from "../../src/components/ui";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { useAuth } from "../../src/lib/auth";
import { theme } from "../../src/theme";

export default function AccountScreen() {
  const { user, signOut, signInGoogle, signInApple } = useAuth();

  const isAnon = user?.isAnonymous;

  return (
    <View style={styles.root}>
      <ScreenHeader subtitle="Manage your account." />
      <ScrollView style={styles.screen} contentContainerStyle={styles.container}>
        <Card style={{ marginTop: 4 }}>
        <Subtitle>{user?.displayName || (isAnon ? "Guest" : "Signed in")}</Subtitle>
        <Body style={{ marginTop: 4 }}>{user?.email || "No email on file"}</Body>
        <Body style={{ marginTop: 8, fontSize: 12 }}>UID: {user?.uid}</Body>

        {isAnon && (
          <View style={{ marginTop: 16, gap: 10 }}>
            <Body>Link a permanent account so you never lose your work:</Body>
            <Button label="Link Google" variant="ghost" onPress={() => signInGoogle().catch(noop)} />
            <Button label="Link Apple" variant="ghost" onPress={() => signInApple().catch(noop)} />
          </View>
        )}
      </Card>

      <Button
        label="Sign out"
        variant="outline"
        style={{ marginTop: 24 }}
        onPress={() =>
          Alert.alert("Sign out?", "You can sign back in anytime.", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign out", style: "destructive", onPress: () => signOut() },
          ])
        }
      />

        <Body style={styles.version}>Uncrop it AI v1.0.0</Body>
      </ScrollView>
    </View>
  );
}

const noop = () => {};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  screen: { flex: 1, backgroundColor: theme.bg },
  container: { padding: 20, flexGrow: 1, backgroundColor: theme.bg },
  version: { textAlign: "center", marginTop: 30, fontSize: 12, color: theme.textDim },
});

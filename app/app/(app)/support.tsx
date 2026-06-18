import { useEffect, useState, useCallback } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  ScrollView,
  Alert,
  RefreshControl,
  Pressable,
} from "react-native";
import { Button, Card, Body, Subtitle } from "../../src/components/ui";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { theme } from "../../src/theme";
import { createTicket, listMyTickets, Ticket } from "../../src/lib/api";

const CATEGORIES = ["Bug", "Billing", "Feature request", "Other"];

export default function SupportScreen() {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      setTickets(await listMyTickets());
    } catch {
      /* index may still be building; ignore */
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function submit() {
    if (subject.trim().length < 3 || message.trim().length < 5) {
      Alert.alert("Add a bit more", "Please enter a subject and a description.");
      return;
    }
    try {
      setSubmitting(true);
      await createTicket({ subject, category, message });
      setSubject("");
      setMessage("");
      Alert.alert("Sent", "Our team will get back to you shortly.");
      refresh();
    } catch (e: any) {
      Alert.alert("Could not send", e?.message ?? "Try again later.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.root}>
      <ScreenHeader subtitle="Get help & track your support tickets." />
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.container}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}
      >
        <Card>
        <Subtitle>New ticket</Subtitle>

        <Body style={styles.label}>Subject</Body>
        <TextInput
          value={subject}
          onChangeText={setSubject}
          placeholder="Briefly, what's up?"
          placeholderTextColor={theme.textDim}
          style={styles.input}
        />

        <Body style={styles.label}>Category</Body>
        <View style={styles.chips}>
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              onPress={() => setCategory(c)}
              style={[styles.chip, category === c && styles.chipActive]}
            >
              <Body style={category === c ? styles.chipTextActive : styles.chipText}>{c}</Body>
            </Pressable>
          ))}
        </View>

        <Body style={styles.label}>Message</Body>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Tell us what happened…"
          placeholderTextColor={theme.textDim}
          multiline
          style={[styles.input, styles.textarea]}
        />

        <Button label="Submit ticket" loading={submitting} onPress={submit} style={{ marginTop: 14 }} />
      </Card>

      <Subtitle style={{ marginTop: 24, marginBottom: 10 }}>Your tickets</Subtitle>
      {tickets.length === 0 ? (
        <Body>No tickets yet.</Body>
      ) : (
        tickets.map((t) => (
          <Card key={t.id} style={{ marginBottom: 10 }}>
            <View style={styles.ticketRow}>
              <Body style={{ color: theme.text, fontWeight: "700", flex: 1 }}>{t.subject}</Body>
              <View style={[styles.status, statusStyle(t.status)]}>
                <Body style={styles.statusText}>{t.status}</Body>
              </View>
            </View>
            <Body style={{ marginTop: 4 }}>{t.category}</Body>
          </Card>
        ))
      )}
      </ScrollView>
    </View>
  );
}

function statusStyle(s: string) {
  if (s === "closed") return { backgroundColor: theme.surfaceAlt };
  if (s === "pending") return { backgroundColor: theme.primaryDim };
  return { backgroundColor: theme.accent };
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  screen: { flex: 1, backgroundColor: theme.bg },
  container: { padding: 20, paddingBottom: 60, flexGrow: 1, backgroundColor: theme.bg },
  label: { marginTop: 14, marginBottom: 6, color: theme.text, fontWeight: "600" },
  input: {
    backgroundColor: theme.surfaceAlt,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: theme.text,
    borderWidth: 1,
    borderColor: theme.border,
  },
  textarea: { minHeight: 110, textAlignVertical: "top" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  chipText: { color: theme.textDim },
  chipTextActive: { color: "#fff", fontWeight: "700" },
  ticketRow: { flexDirection: "row", alignItems: "center" },
  status: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  statusText: { color: "#0B0B12", fontSize: 12, fontWeight: "800", textTransform: "capitalize" },
});

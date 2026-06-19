import { useEffect, useState } from "react";
import { View, Text, Image, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { theme } from "../../src/theme";
import { listMyJobs, JobRecord } from "../../src/lib/api";

function fmtDate(ts?: { seconds: number }) {
  if (!ts) return "";
  return new Date(ts.seconds * 1000).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function HistoryScreen() {
  const [jobs, setJobs] = useState<JobRecord[] | null>(null);

  useEffect(() => {
    listMyJobs().then(setJobs).catch(() => setJobs([]));
  }, []);

  return (
    <View style={styles.root}>
      <ScreenHeader subtitle="Your un-crops are kept for 30 days." />
      <ScrollView contentContainerStyle={styles.container}>
        {jobs === null ? (
          <ActivityIndicator color={theme.primary} style={{ marginTop: 40 }} />
        ) : jobs.length === 0 ? (
          <Text style={styles.empty}>No un-crops yet.</Text>
        ) : (
          jobs.map((j) => (
            <View key={j.id} style={styles.item}>
              {j.resultUrl && !j.expired ? (
                <Image source={{ uri: j.resultUrl }} style={styles.thumb} resizeMode="cover" />
              ) : (
                <View style={[styles.thumb, styles.gone]}>
                  <Text style={styles.goneTxt}>Removed</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>Un-cropped {j.fileName || "photo"}</Text>
                <Text style={styles.meta}>
                  {fmtDate(j.createdAt)}
                  {j.aspectRatio ? ` · ${j.aspectRatio}` : ""}
                  {j.status === "failed" ? " · failed" : ""}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  container: { padding: 16, gap: 10 },
  empty: { color: theme.textDim, textAlign: "center", marginTop: 40 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 10 },
  thumb: { width: 96, height: 60, borderRadius: 8, backgroundColor: theme.surfaceAlt },
  gone: { alignItems: "center", justifyContent: "center" },
  goneTxt: { color: theme.textDim, fontSize: 11 },
  name: { color: theme.text, fontWeight: "700" },
  meta: { color: theme.textDim, fontSize: 12, marginTop: 2 },
});

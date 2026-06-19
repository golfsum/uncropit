import { useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { File, Paths } from "expo-file-system";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { useEntitlement } from "../../src/lib/entitlements";
import { uploadUserImage, uncropImage } from "../../src/lib/api";
import OutOfCreditsModal, { LimitReason } from "../../src/components/OutOfCreditsModal";
import { theme } from "../../src/theme";

const ASPECTS = ["1:1", "4:5", "3:2", "16:9", "9:16"];

type Status = "pending" | "processing" | "done" | "error" | "skipped";
interface Item {
  uri: string;
  fileName: string;
  status: Status;
  resultUrl?: string;
  error?: string;
}

export default function BatchScreen() {
  const router = useRouter();
  const { plan, credits } = useEntitlement();
  const isStudio = plan === "studio" || plan === "admin";

  const [aspect, setAspect] = useState("16:9");
  const [items, setItems] = useState<Item[]>([]);
  const [running, setRunning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [limit, setLimit] = useState<{ open: boolean; reason: LimitReason }>({ open: false, reason: "OUT_OF_CREDITS" });

  function update(i: number, patch: Partial<Item>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  async function pick() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Permission needed", "Allow photo access to choose images.");
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 50,
      quality: 1,
    });
    if (!res.canceled) {
      setItems(
        res.assets.map((a, i) => ({
          uri: a.uri,
          fileName: a.fileName ?? `photo-${i + 1}.jpg`,
          status: "pending" as Status,
        }))
      );
    }
  }

  async function run() {
    if (!items.length || running) return;

    // Pre-flight credit check (admins are unlimited). Only process what the user
    // can afford; confirm before skipping the overflow.
    const unlimited = plan === "admin";
    const remaining = credits ?? 0;
    const pending = items.filter((i) => i.status !== "done").length;
    let toProcess = items.length;

    if (!unlimited) {
      if (remaining <= 0) {
        setLimit({ open: true, reason: "OUT_OF_CREDITS" });
        return;
      }
      if (pending > remaining) {
        const ok = await new Promise<boolean>((resolve) => {
          Alert.alert(
            "Not enough credits",
            `You have ${remaining} credit${remaining === 1 ? "" : "s"} left but ${pending} photo${
              pending === 1 ? " is" : "s are"
            } queued.\n\nProcess the first ${remaining} now? The rest will be skipped.`,
            [
              { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
              { text: `Process ${remaining}`, onPress: () => resolve(true) },
            ]
          );
        });
        if (!ok) return;
        toProcess = remaining;
      }
    }

    setRunning(true);
    let processed = 0;
    // Snapshot the list length; process sequentially.
    for (let i = 0; i < items.length; i++) {
      if (items[i].status === "done") continue;
      if (!unlimited && processed >= toProcess) {
        update(i, { status: "skipped", error: "Skipped — out of credits" });
        continue;
      }
      processed++;
      update(i, { status: "processing", error: undefined });
      try {
        const current = items[i];
        const imageUrl = await uploadUserImage(current.uri);
        const out = await uncropImage({ imageUrl, aspectRatio: aspect, fileName: current.fileName });
        update(i, { status: "done", resultUrl: out.resultUrl });
      } catch (e: any) {
        const code = e?.code as string | undefined;
        const reason = e?.details?.reason as string | undefined;
        update(i, { status: "error", error: e?.message ?? "Failed" });
        if (code === "functions/resource-exhausted" || reason === "OUT_OF_CREDITS" || reason === "OUT_OF_FREE_DAILY") {
          setLimit({ open: true, reason: reason === "OUT_OF_FREE_DAILY" ? "OUT_OF_FREE_DAILY" : "OUT_OF_CREDITS" });
          break;
        }
      }
    }
    setRunning(false);
  }

  async function saveAll() {
    const done = items.filter((i) => i.status === "done" && i.resultUrl);
    if (!done.length) return;
    try {
      setSaving(true);
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) return Alert.alert("Permission needed", "Allow photo access to save.");
      for (const it of done) {
        const ext = (it.resultUrl!.split("?")[0].split(".").pop() || "jpg").slice(0, 4);
        const dest = new File(Paths.cache, `uncrop-${Date.now()}-${Math.round(Math.random() * 1e4)}.${ext}`);
        const file = await File.downloadFileAsync(it.resultUrl!, dest);
        await MediaLibrary.saveToLibraryAsync(file.uri);
      }
      Alert.alert("Saved ✓", `${done.length} photo${done.length === 1 ? "" : "s"} saved to your Photos.`);
    } catch (e: any) {
      Alert.alert("Couldn't save", e?.message ?? "Try again.");
    } finally {
      setSaving(false);
    }
  }

  const doneCount = items.filter((i) => i.status === "done").length;
  const pendingCount = items.filter((i) => i.status !== "done").length;

  // --- Upsell for non-Studio users ---
  if (!isStudio) {
    return (
      <View style={styles.root}>
        <ScreenHeader subtitle="Un-crop many photos at once." />
        <ScrollView contentContainerStyle={styles.upsellWrap}>
          <View style={styles.upsellCard}>
            <Ionicons name="albums-outline" size={40} color={theme.primary} />
            <Text style={styles.upsellTitle}>A Studio feature</Text>
            <Text style={styles.upsellBody}>
              Un-crop many photos at once with the same aspect ratio. Batch editing is included with the
              Studio plan (300 credits a month).
            </Text>
            <Pressable style={styles.cta} onPress={() => router.push("/paywall")}>
              <Text style={styles.ctaTxt}>See Studio plan</Text>
            </Pressable>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        subtitle="Un-crop many photos at once."
        right={
          <Pressable onPress={pick} style={styles.headerBtn} disabled={running}>
            <Ionicons name="images-outline" size={18} color={theme.text} />
            <Text style={styles.headerBtnTxt}>{items.length ? "Change" : "Photos"}</Text>
          </Pressable>
        }
      />

      <ScrollView contentContainerStyle={styles.body}>
        {!items.length ? (
          <Pressable onPress={pick} style={styles.empty}>
            <Ionicons name="albums-outline" size={52} color={theme.textDim} />
            <Text style={styles.emptyTxt}>Select multiple photos to un-crop them all</Text>
          </Pressable>
        ) : (
          <>
            <Text style={styles.label}>Expand all to</Text>
            <View style={styles.ratios}>
              {ASPECTS.map((a) => (
                <Pressable
                  key={a}
                  onPress={() => setAspect(a)}
                  disabled={running}
                  style={[styles.chip, aspect === a && styles.chipOn]}
                >
                  <Text style={[styles.chipTxt, aspect === a && styles.chipTxtOn]}>{a}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              style={[styles.cta, (running || doneCount === items.length) && styles.ctaDisabled]}
              onPress={run}
              disabled={running || doneCount === items.length}
            >
              {running ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.ctaTxt}>
                  Un-crop all ({pendingCount} credit{pendingCount === 1 ? "" : "s"})
                </Text>
              )}
            </Pressable>

            {doneCount > 0 && !running && (
              <Pressable style={[styles.cta, styles.ctaAccent]} onPress={saveAll} disabled={saving}>
                {saving ? <ActivityIndicator color="#0b0b12" /> : <Text style={styles.ctaAccentTxt}>Save all to Photos ({doneCount})</Text>}
              </Pressable>
            )}

            <View style={styles.grid}>
              {items.map((it, i) => (
                <View key={i} style={styles.tile}>
                  <Image source={{ uri: it.resultUrl || it.uri }} style={styles.thumb} />
                  <Text
                    style={[
                      styles.status,
                      it.status === "done" && { color: theme.accent },
                      it.status === "processing" && { color: theme.primary },
                      it.status === "error" && { color: theme.danger },
                    ]}
                    numberOfLines={1}
                  >
                    {it.status === "pending" && "Ready"}
                    {it.status === "processing" && "Processing…"}
                    {it.status === "done" && "Done ✓"}
                    {it.status === "skipped" && "Skipped"}
                    {it.status === "error" && (it.error || "Failed")}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      <OutOfCreditsModal
        open={limit.open}
        reason={limit.reason}
        onClose={() => setLimit((l) => ({ ...l, open: false }))}
        onUpgrade={() => {
          setLimit((l) => ({ ...l, open: false }));
          router.push("/paywall");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  body: { padding: 16, gap: 14 },
  headerBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: theme.surfaceAlt, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  headerBtnTxt: { color: theme.text, fontWeight: "700", fontSize: 13 },
  empty: { alignItems: "center", justifyContent: "center", gap: 14, paddingVertical: 70 },
  emptyTxt: { color: theme.textDim, fontSize: 15, textAlign: "center" },
  label: { color: theme.textDim, fontSize: 12, fontWeight: "700" },
  ratios: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, backgroundColor: theme.surfaceAlt },
  chipOn: { backgroundColor: theme.primary },
  chipTxt: { color: theme.text, fontWeight: "700" },
  chipTxtOn: { color: "#fff" },
  cta: { minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: theme.primary },
  ctaDisabled: { opacity: 0.5 },
  ctaTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },
  ctaAccent: { backgroundColor: theme.accent },
  ctaAccentTxt: { color: "#0b0b12", fontSize: 16, fontWeight: "800" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  tile: { width: "31%", backgroundColor: theme.surface, borderRadius: 12, borderWidth: 1, borderColor: theme.border, padding: 6, gap: 6 },
  thumb: { width: "100%", height: 84, borderRadius: 8, backgroundColor: theme.surfaceAlt },
  status: { fontSize: 11, fontWeight: "700", color: theme.textDim },
  upsellWrap: { padding: 20, flexGrow: 1, justifyContent: "center" },
  upsellCard: { backgroundColor: theme.surface, borderRadius: 18, borderWidth: 1, borderColor: theme.border, padding: 28, alignItems: "center", gap: 12 },
  upsellTitle: { color: theme.text, fontSize: 20, fontWeight: "800" },
  upsellBody: { color: theme.textDim, fontSize: 14, lineHeight: 21, textAlign: "center" },
});

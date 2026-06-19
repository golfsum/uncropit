import { useState } from "react";
import {
  View,
  Image,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";
import { theme } from "../theme";
import { ScreenHeader } from "./ScreenHeader";
import { webDownload } from "../lib/download";
import { uploadUserImage, uncropImage } from "../lib/api";

// Bria expand-image target ratios. Pick the shape that adds scene where you
// want it — e.g. a wide ratio adds left/right, a tall ratio adds top/bottom.
const ASPECTS: { id: string; label: string }[] = [
  { id: "1:1", label: "Square" },
  { id: "4:5", label: "4:5" },
  { id: "3:2", label: "Photo" },
  { id: "16:9", label: "Wide" },
  { id: "9:16", label: "Tall" },
];

/**
 * Full-screen image processing surface. Currently used for the AI Uncrop flow:
 * pick a photo, send it to the cloud uncrop function, show the result.
 */
export function AiProcessor({ mode }: { mode: "uncrop" }) {
  const insets = useSafeAreaInsets();
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "uploading" | "processing">("idle");
  const [aspect, setAspect] = useState("16:9");
  const [saving, setSaving] = useState(false);
  const busy = stage !== "idle";

  // Download the remote AI result to a local file so it can be saved/shared.
  async function downloadResult(): Promise<string> {
    const ext = (resultUrl!.split("?")[0].split(".").pop() || "png").slice(0, 4);
    const dest = new File(Paths.cache, `uncrop-${Date.now()}.${ext}`);
    const file = await File.downloadFileAsync(resultUrl!, dest);
    return file.uri;
  }

  async function saveResult() {
    if (!resultUrl) return;
    try {
      setSaving(true);
      if (Platform.OS === "web") {
        await webDownload(resultUrl, "uncropit.jpg");
        return;
      }
      const uri = await downloadResult();
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) return Alert.alert("Permission needed", "Allow photo access to save.");
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert("Saved ✓", "Your un-cropped photo was saved to your Photos.");
    } catch (e: any) {
      Alert.alert("Couldn't save", e?.message ?? "Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function shareResult() {
    if (!resultUrl) return;
    try {
      setSaving(true);
      if (Platform.OS === "web") {
        await webDownload(resultUrl, "uncropit.jpg");
        return;
      }
      const uri = await downloadResult();
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri);
    } catch (e: any) {
      Alert.alert("Couldn't share", e?.message ?? "Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function pick() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Permission needed", "Allow photo access to choose an image.");
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (!res.canceled) {
      setLocalUri(res.assets[0].uri);
      setResultUrl(null);
    }
  }

  async function process() {
    if (!localUri) return;
    try {
      setStage("uploading");
      const imageUrl = await uploadUserImage(localUri);
      setStage("processing");
      const out = await uncropImage({ imageUrl, aspectRatio: aspect });
      setResultUrl(out.resultUrl);
    } catch (e: any) {
      Alert.alert("Processing failed", e?.message ?? "Try again in a moment.");
    } finally {
      setStage("idle");
    }
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        subtitle="Extend any photo to a cinematic frame with AI."
        right={
          <Pressable onPress={pick} style={styles.headerBtn} disabled={busy}>
            <Ionicons name="images-outline" size={18} color={theme.text} />
            <Text style={styles.headerBtnTxt}>{localUri ? "Change" : "Photo"}</Text>
          </Pressable>
        }
      />

      <View style={styles.canvasArea}>
        {!localUri ? (
          <Pressable onPress={pick} style={styles.empty}>
            <Ionicons name="expand-outline" size={56} color={theme.textDim} />
            <Text style={styles.emptyTxt}>Tap to choose a photo</Text>
          </Pressable>
        ) : (
          <View style={styles.canvas}>
            <Image source={{ uri: resultUrl ?? localUri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
            {resultUrl && (
              <View style={styles.badge}>
                <Ionicons name="sparkles" size={14} color="#fff" />
                <Text style={styles.badgeTxt}>Result</Text>
              </View>
            )}
            {busy && (
              <View style={styles.overlay}>
                <ActivityIndicator color={theme.primary} size="large" />
                <Text style={styles.overlayTxt}>
                  {stage === "uploading" ? "Uploading…" : "AI is working its magic…"}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + 8 }]}>
        <Text style={styles.ratioLabel}>Expand to</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.ratios}>
          {ASPECTS.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => setAspect(a.id)}
              disabled={busy}
              style={[styles.ratioChip, aspect === a.id && styles.ratioChipActive]}
            >
              <Text style={[styles.ratioTxt, aspect === a.id && { color: "#fff" }]}>{a.id}</Text>
              <Text style={[styles.ratioSub, aspect === a.id && { color: "rgba(255,255,255,0.85)" }]}>{a.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <Pressable
          onPress={process}
          disabled={!localUri || busy}
          style={[styles.cta, (!localUri || busy) && styles.disabled]}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="expand" size={20} color="#fff" />
              <Text style={styles.ctaTxt}>{resultUrl ? "Un-crop Again" : "Un-crop Photo"}</Text>
            </>
          )}
        </Pressable>

        {resultUrl && !busy && (
          <View style={styles.resultRow}>
            <Pressable onPress={shareResult} disabled={saving} style={[styles.resBtn, styles.resGhost]}>
              <Ionicons name="share-outline" size={18} color={theme.text} />
              <Text style={styles.resGhostTxt}>Share</Text>
            </Pressable>
            <Pressable onPress={saveResult} disabled={saving} style={[styles.resBtn, styles.resPrimary]}>
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="download-outline" size={18} color="#fff" />
                  <Text style={styles.resPrimaryTxt}>Save to Photos</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  headerBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: theme.surfaceAlt, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  headerBtnTxt: { color: theme.text, fontWeight: "600" },

  canvasArea: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  canvas: { width: "100%", height: "100%", borderRadius: 16, overflow: "hidden", backgroundColor: theme.surfaceAlt },
  empty: { alignItems: "center", justifyContent: "center", gap: 12, flex: 1, alignSelf: "stretch" },
  emptyTxt: { color: theme.textDim, fontSize: 16 },

  badge: { position: "absolute", top: 12, left: 12, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: theme.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  badgeTxt: { color: "#fff", fontWeight: "700", fontSize: 12 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(11,11,18,0.7)", alignItems: "center", justifyContent: "center", gap: 10 },
  overlayTxt: { color: theme.text },

  controls: { backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12, paddingHorizontal: 16, gap: 10 },
  ratioLabel: { color: theme.textDim, fontSize: 12, fontWeight: "600" },
  ratios: { gap: 8, paddingRight: 8 },
  ratioChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: theme.surfaceAlt, alignItems: "center", minWidth: 64 },
  ratioChipActive: { backgroundColor: theme.primary },
  ratioTxt: { color: theme.text, fontWeight: "700", fontSize: 14 },
  ratioSub: { color: theme.textDim, fontSize: 11, marginTop: 1 },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 54, borderRadius: 14, backgroundColor: theme.primary },
  ctaTxt: { color: "#fff", fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.5 },

  resultRow: { flexDirection: "row", gap: 10 },
  resBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 50, borderRadius: 14 },
  resGhost: { backgroundColor: theme.surfaceAlt },
  resGhostTxt: { color: theme.text, fontWeight: "700", fontSize: 15 },
  resPrimary: { backgroundColor: theme.accent },
  resPrimaryTxt: { color: "#0B0B12", fontWeight: "800", fontSize: 15 },
});

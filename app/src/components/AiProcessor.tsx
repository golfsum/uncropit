import { useState } from "react";
import {
  View,
  Image,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { theme } from "../theme";
import { ScreenHeader } from "./ScreenHeader";
import { uploadUserImage, uncropImage } from "../lib/api";

/**
 * Full-screen image processing surface. Currently used for the AI Uncrop flow:
 * pick a photo, send it to the cloud uncrop function, show the result.
 */
export function AiProcessor({ mode }: { mode: "uncrop" }) {
  const insets = useSafeAreaInsets();
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "uploading" | "processing">("idle");
  const busy = stage !== "idle";

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
      const out = await uncropImage({ imageUrl, expand: { left: 256, right: 256 } });
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
              <Text style={styles.ctaTxt}>Un-crop Photo</Text>
            </>
          )}
        </Pressable>
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

  controls: { backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12, paddingHorizontal: 16 },
  cta: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 54, borderRadius: 14, backgroundColor: theme.primary },
  ctaTxt: { color: "#fff", fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.5 },
});

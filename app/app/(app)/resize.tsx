import { useRef, useState } from "react";
import {
  View,
  Image,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import * as ImageManipulator from "expo-image-manipulator";
import { File, Directory, Paths } from "expo-file-system";
import { captureRef } from "react-native-view-shot";
import { theme } from "../../src/theme";
import { ScreenHeader } from "../../src/components/ScreenHeader";
import { PLATFORMS, FILL_PLATFORMS, SizePreset } from "../../src/lib/presets";

type Fit = "fill" | "fit";
type Bg = "white" | "black" | "blur";
type Fmt = "jpg" | "png" | "svg";

const BG_COLORS: Record<Exclude<Bg, "blur">, string> = { white: "#FFFFFF", black: "#000000" };

export default function ResizeScreen() {
  const insets = useSafeAreaInsets();
  const canvasRef = useRef<View>(null);

  const [uri, setUri] = useState<string | null>(null);
  const [srcDims, setSrcDims] = useState({ w: 0, h: 0 });
  const [platformIdx, setPlatformIdx] = useState(0);
  const [preset, setPreset] = useState<SizePreset>(PLATFORMS[0].presets[0]);
  const [custom, setCustom] = useState(false);
  const [cw, setCw] = useState("1080");
  const [ch, setCh] = useState("1080");
  const [fit, setFit] = useState<Fit>("fit");
  const [bg, setBg] = useState<Bg>("white");
  const [format, setFormat] = useState<Fmt>("jpg");
  const [busy, setBusy] = useState(false);
  const [area, setArea] = useState({ w: 0, h: 0 });

  const target = custom
    ? { w: Math.max(1, parseInt(cw) || 1), h: Math.max(1, parseInt(ch) || 1) }
    : { w: preset.w, h: preset.h };
  const ar = target.w / target.h;

  // Available export formats per platform: App Store = PNG only,
  // Favicon = PNG or SVG, everything else = JPG or PNG.
  const platformName = custom ? "Custom" : PLATFORMS[platformIdx].platform;
  const isFavicon = platformName === "Favicon";
  const isAppStore = platformName === "App Store";
  const formats: Fmt[] = isAppStore ? ["png"] : isFavicon ? ["png", "svg"] : ["jpg", "png"];
  const fmt: Fmt = formats.includes(format) ? format : formats[0];

  // Largest box with the target aspect ratio that fits the canvas area.
  let boxW = area.w;
  let boxH = area.w / ar;
  if (boxH > area.h) {
    boxH = area.h;
    boxW = area.h * ar;
  }

  function onArea(e: LayoutChangeEvent) {
    const { width, height } = e.nativeEvent.layout;
    setArea({ w: width, h: height });
  }

  async function pick() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert("Permission needed", "Allow photo access to choose an image.");
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (!res.canceled) {
      const a = res.assets[0];
      setUri(a.uri);
      setSrcDims({ w: a.width ?? 0, h: a.height ?? 0 });
    }
  }

  // A fresh, named file inside the app's persistent "Uncrop it AI" Documents
  // folder (shows up in the Files app on a release build).
  function docFile(name: string): File {
    const dir = new Directory(Paths.document, "Uncrop it AI");
    if (!dir.exists) dir.create();
    const file = new File(dir, name);
    if (file.exists) file.delete();
    return file;
  }

  // Source pixel dimensions — from the picker if available, else queried live.
  // Without these the sharp crop path can't run, so we must not return 0s.
  function getSourceDims(): Promise<{ w: number; h: number }> {
    if (srcDims.w > 0 && srcDims.h > 0) return Promise.resolve(srcDims);
    return new Promise((resolve) => {
      if (!uri) return resolve({ w: 0, h: 0 });
      Image.getSize(
        uri,
        (w, h) => resolve({ w, h }),
        () => resolve({ w: 0, h: 0 })
      );
    });
  }

  // Center-crop params to make the source match a target aspect ratio (cover).
  function fillCropParams(d: { w: number; h: number }, tw: number, th: number) {
    const tAr = tw / th;
    const sAr = d.w / d.h;
    let cropW = d.w;
    let cropH = d.h;
    if (sAr > tAr) cropW = Math.round(d.h * tAr); // source wider → trim sides
    else cropH = Math.round(d.w / tAr); // source taller → trim top/bottom
    return {
      originX: Math.round((d.w - cropW) / 2),
      originY: Math.round((d.h - cropH) / 2),
      width: cropW,
      height: cropH,
    };
  }

  async function render(): Promise<string> {
    const saveFormat =
      fmt === "jpg" ? ImageManipulator.SaveFormat.JPEG : ImageManipulator.SaveFormat.PNG;
    const dims = await getSourceDims();

    // SVG: embed a crisp 512px PNG inside an SVG wrapper — a valid, scalable
    // favicon (raster picture, vector container). Same idea as drawing the image
    // to a canvas and exporting, but built from the full-res source file.
    if (fmt === "svg" && uri && dims.w > 0) {
      const png = await ImageManipulator.manipulateAsync(
        uri,
        [{ crop: fillCropParams(dims, target.w, target.h) }, { resize: { width: 512, height: 512 } }],
        { base64: true, format: ImageManipulator.SaveFormat.PNG }
      );
      const w = target.w;
      const h = target.h;
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
        `<image href="data:image/png;base64,${png.base64}" x="0" y="0" width="${w}" height="${h}" ` +
        `preserveAspectRatio="xMidYMid slice"/></svg>`;
      const file = docFile("favicon.svg");
      file.create();
      file.write(svg);
      return file.uri;
    }

    // FILL mode (icons/favicons): crop+resize the ORIGINAL full-res file directly
    // — no view capture, no downsampling — for the sharpest possible output.
    // Favicons ALWAYS take this path (never the soft view-capture fallback).
    if ((fit === "fill" || isFavicon) && uri && dims.w > 0 && dims.h > 0) {
      const out = await ImageManipulator.manipulateAsync(
        uri,
        [{ crop: fillCropParams(dims, target.w, target.h) }, { resize: { width: target.w, height: target.h } }],
        { compress: fmt === "jpg" ? 0.95 : 1, format: saveFormat }
      );
      // Favicons are web assets → save a clean "favicon.png" to Documents.
      if (isFavicon) {
        const dest = docFile("favicon.png");
        new File(out.uri).copy(dest);
        return dest.uri;
      }
      return out.uri;
    }

    // FIT mode (background/blur padding) needs compositing → capture the view.
    return captureRef(canvasRef, {
      format: fmt === "png" ? "png" : "jpg",
      quality: fmt === "png" ? 1 : 0.95,
      width: target.w,
      height: target.h,
    });
  }

  const SVG_SHARE = { mimeType: "image/svg+xml", UTI: "public.svg-image" };
  const PNG_SHARE = { mimeType: "image/png", UTI: "public.png" };
  const shareOpts = fmt === "svg" ? SVG_SHARE : PNG_SHARE;

  async function save() {
    if (!uri) return;
    try {
      setBusy(true);
      const out = await render();
      // Favicons: render() persists favicon.{png,svg} to the app's Documents
      // folder (shows in Files on a release build). To reliably reach it on any
      // runtime, open the share sheet → "Save to Files" to place it anywhere.
      if (isFavicon) {
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(out, shareOpts);
        } else {
          Alert.alert("Saved ✓", `favicon.${fmt} is ready in the app's Files folder.`);
        }
        return;
      }
      const perm = await MediaLibrary.requestPermissionsAsync();
      if (!perm.granted) return Alert.alert("Permission needed", "Allow photo access to save.");
      await MediaLibrary.saveToLibraryAsync(out);
      Alert.alert("Saved ✓", `Saved ${target.w}×${target.h} ${fmt.toUpperCase()} to your Photos.`);
    } catch (e: any) {
      Alert.alert("Could not save", e?.message ?? "Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (!uri) return;
    try {
      setBusy(true);
      const out = await render();
      if (await Sharing.isAvailableAsync())
        await Sharing.shareAsync(out, fmt === "svg" || isFavicon ? shareOpts : undefined);
    } catch (e: any) {
      Alert.alert("Could not share", e?.message ?? "Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.root}>
      <ScreenHeader
        subtitle="Resize & export for any platform."
        right={
          <Pressable onPress={pick} style={styles.headerBtn}>
            <Ionicons name="images-outline" size={18} color={theme.text} />
            <Text style={styles.headerBtnTxt}>{uri ? "Change" : "Photo"}</Text>
          </Pressable>
        }
      />

      {/* Canvas */}
      <View style={styles.canvasArea} onLayout={onArea}>
        {!uri ? (
          <Pressable onPress={pick} style={styles.empty}>
            <Ionicons name="add-circle-outline" size={56} color={theme.textDim} />
            <Text style={styles.emptyTxt}>Tap to choose a photo</Text>
          </Pressable>
        ) : (
          <View
            ref={canvasRef}
            collapsable={false}
            style={[styles.canvas, { width: boxW, height: boxH }]}
          >
            {fit === "fit" &&
              (bg === "blur" ? (
                <Image source={{ uri }} blurRadius={40} style={StyleSheet.absoluteFill} resizeMode="cover" />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: BG_COLORS[bg] }]} />
              ))}
            <Image
              source={{ uri }}
              style={StyleSheet.absoluteFill}
              resizeMode={fit === "fill" ? "cover" : "contain"}
            />
          </View>
        )}
      </View>

      {/* Controls */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + 8 }]}>
        {/* Platform row */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowPad}>
          {PLATFORMS.map((p, i) => {
            const active = !custom && i === platformIdx;
            return (
              <Pressable
                key={p.platform}
                onPress={() => {
                  setCustom(false);
                  setPlatformIdx(i);
                  setPreset(p.presets[0]);
                  // Icons/favicons look best full-bleed (no blurred padding).
                  if (FILL_PLATFORMS.includes(p.platform)) setFit("fill");
                }}
                style={[styles.platChip, active && styles.platChipActive]}
              >
                <Ionicons name={p.icon} size={16} color={active ? "#fff" : theme.textDim} />
                <Text style={[styles.platTxt, active && { color: "#fff" }]}>{p.platform}</Text>
              </Pressable>
            );
          })}
          <Pressable onPress={() => setCustom(true)} style={[styles.platChip, custom && styles.platChipActive]}>
            <Ionicons name="options-outline" size={16} color={custom ? "#fff" : theme.textDim} />
            <Text style={[styles.platTxt, custom && { color: "#fff" }]}>Custom</Text>
          </Pressable>
        </ScrollView>

        {/* Size presets OR custom inputs */}
        {custom ? (
          <View style={styles.customRow}>
            <TextInput
              value={cw}
              onChangeText={setCw}
              keyboardType="number-pad"
              style={styles.customInput}
              placeholder="W"
              placeholderTextColor={theme.textDim}
            />
            <Text style={styles.times}>×</Text>
            <TextInput
              value={ch}
              onChangeText={setCh}
              keyboardType="number-pad"
              style={styles.customInput}
              placeholder="H"
              placeholderTextColor={theme.textDim}
            />
            <Text style={styles.px}>px</Text>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowPad}>
            {PLATFORMS[platformIdx].presets.map((s) => {
              const active = preset.id === s.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setPreset(s)}
                  style={[styles.sizeChip, active && styles.sizeChipActive]}
                >
                  <Text style={[styles.sizeLabel, active && { color: "#fff" }]}>{s.label}</Text>
                  <Text style={[styles.sizeDims, active && { color: "rgba(255,255,255,0.8)" }]}>
                    {s.w}×{s.h}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Fit + export format */}
        <View style={styles.optionRow}>
          <View style={styles.segment}>
            {(["fit", "fill"] as Fit[]).map((f) => (
              <Pressable key={f} onPress={() => setFit(f)} style={[styles.segBtn, fit === f && styles.segBtnActive]}>
                <Text style={[styles.segTxt, fit === f && { color: "#fff" }]}>{f === "fit" ? "Fit" : "Fill"}</Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.segment}>
            {formats.map((f) => (
              <Pressable key={f} onPress={() => setFormat(f)} style={[styles.segBtn, fmt === f && styles.segBtnActive]}>
                <Text style={[styles.segTxt, fmt === f && { color: "#fff" }]}>{f.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {isAppStore && <Text style={styles.hint}>App Store assets export as PNG.</Text>}
        {isFavicon && (
          <Text style={styles.hint}>
            Exports as favicon.{fmt} via Share → Files. Small icons can look blurry in a
            photo viewer (it magnifies them) — they render sharp at actual size in a browser.
          </Text>
        )}

        {/* Background (fit only) */}
        {fit === "fit" && (
          <View style={styles.swatchRow}>
            <Text style={styles.swatchLabel}>Background</Text>
            <View style={styles.swatches}>
              {(["white", "black", "blur"] as Bg[]).map((b) => (
                <Pressable
                  key={b}
                  onPress={() => setBg(b)}
                  style={[
                    styles.swatch,
                    b === "white" && { backgroundColor: "#fff" },
                    b === "black" && { backgroundColor: "#000" },
                    b === "blur" && { backgroundColor: theme.surfaceAlt, alignItems: "center", justifyContent: "center" },
                    bg === b && styles.swatchActive,
                  ]}
                >
                  {b === "blur" && <Ionicons name="aperture-outline" size={16} color={theme.text} />}
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Pressable onPress={share} disabled={!uri || busy} style={[styles.action, styles.actionGhost, (!uri || busy) && styles.disabled]}>
            <Ionicons name="share-outline" size={20} color={theme.text} />
            <Text style={styles.actionGhostTxt}>Share</Text>
          </Pressable>
          <Pressable onPress={save} disabled={!uri || busy} style={[styles.action, styles.actionPrimary, (!uri || busy) && styles.disabled]}>
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name={isFavicon ? "share-outline" : "download-outline"} size={20} color="#fff" />
                <Text style={styles.actionPrimaryTxt}>{isFavicon ? "Export" : "Save"}</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.bg },
  headerBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: theme.surfaceAlt, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  headerBtnTxt: { color: theme.text, fontWeight: "600" },

  canvasArea: { flex: 1, alignItems: "center", justifyContent: "center", padding: 16 },
  canvas: { overflow: "hidden", backgroundColor: theme.surfaceAlt },
  empty: { alignItems: "center", justifyContent: "center", gap: 12, flex: 1, alignSelf: "stretch" },
  emptyTxt: { color: theme.textDim, fontSize: 16 },

  controls: { backgroundColor: theme.surface, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 12, gap: 12 },
  rowPad: { paddingHorizontal: 14, gap: 8 },

  platChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: theme.surfaceAlt },
  platChipActive: { backgroundColor: theme.primary },
  platTxt: { color: theme.textDim, fontWeight: "600", fontSize: 13 },

  sizeChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, backgroundColor: theme.surfaceAlt, minWidth: 92 },
  sizeChipActive: { backgroundColor: theme.primary },
  sizeLabel: { color: theme.text, fontWeight: "700", fontSize: 13 },
  sizeDims: { color: theme.textDim, fontSize: 11, marginTop: 2 },

  customRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16 },
  customInput: { backgroundColor: theme.surfaceAlt, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, color: theme.text, width: 90, textAlign: "center", borderWidth: 1, borderColor: theme.border },
  times: { color: theme.textDim, fontSize: 16 },
  px: { color: theme.textDim },

  optionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  segment: { flexDirection: "row", backgroundColor: theme.surfaceAlt, borderRadius: 10, padding: 3 },
  segBtn: { paddingHorizontal: 18, paddingVertical: 7, borderRadius: 8 },
  segBtnActive: { backgroundColor: theme.primary },
  segDisabled: { opacity: 0.5 },
  segTxt: { color: theme.textDim, fontWeight: "700" },
  hint: { color: theme.textDim, fontSize: 12, paddingHorizontal: 16, marginTop: -4 },

  swatchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16 },
  swatchLabel: { color: theme.textDim, fontWeight: "600", fontSize: 13 },
  swatches: { flexDirection: "row", gap: 8 },
  swatch: { width: 32, height: 32, borderRadius: 8, borderWidth: 2, borderColor: theme.border },
  swatchActive: { borderColor: theme.primary },

  actions: { flexDirection: "row", gap: 10, paddingHorizontal: 16 },
  action: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: 14 },
  actionGhost: { backgroundColor: theme.surfaceAlt },
  actionGhostTxt: { color: theme.text, fontWeight: "700", fontSize: 16 },
  actionPrimary: { backgroundColor: theme.primary },
  actionPrimaryTxt: { color: "#fff", fontWeight: "700", fontSize: 16 },
  disabled: { opacity: 0.5 },
});

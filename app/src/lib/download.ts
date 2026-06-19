import { Platform } from "react-native";

/**
 * On web, trigger a browser download of a local or remote image URI.
 * Returns true if it handled the download (web), false on native (so callers
 * fall through to MediaLibrary / Sharing).
 */
export async function webDownload(uri: string, filename: string): Promise<boolean> {
  if (Platform.OS !== "web") return false;

  let href = uri;
  // Remote URLs must be fetched to a blob, or the browser navigates instead of
  // downloading (and cross-origin images can't be saved directly).
  if (/^https?:/i.test(uri)) {
    const res = await fetch(uri);
    const blob = await res.blob();
    href = URL.createObjectURL(blob);
  }

  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (href !== uri) URL.revokeObjectURL(href);
  return true;
}

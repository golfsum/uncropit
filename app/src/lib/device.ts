/**
 * Stable per-device id used to enforce the free daily quota across accounts on
 * the same device (anti trial-farming). On iOS we store it in the Keychain via
 * expo-secure-store, which SURVIVES app reinstalls - so deleting and reinstalling
 * the app does not reset the device's free allowance. Falls back to AsyncStorage
 * (Expo Go / module unavailable), which is weaker but still blocks the common
 * "make a new account" bypass.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "uncropit.deviceId";

function secureStore(): any | null {
  try {
    return require("expo-secure-store");
  } catch {
    return null;
  }
}

function uuid(): string {
  // RFC4122-ish; good enough for a device identifier.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

let cached: string | null = null;

export async function getDeviceId(): Promise<string> {
  if (cached) return cached;
  const SS = secureStore();
  try {
    if (SS) {
      const existing = await SS.getItemAsync(KEY);
      if (existing) return (cached = existing);
      const fresh = uuid();
      await SS.setItemAsync(KEY, fresh);
      return (cached = fresh);
    }
  } catch {
    // fall through to AsyncStorage
  }
  try {
    const existing = await AsyncStorage.getItem(KEY);
    if (existing) return (cached = existing);
    const fresh = uuid();
    await AsyncStorage.setItem(KEY, fresh);
    return (cached = fresh);
  } catch {
    return (cached = uuid());
  }
}

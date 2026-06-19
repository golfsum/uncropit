import { initializeApp, getApps, getApp, FirebaseApp } from "firebase/app";
import { initializeAuth, getAuth, Auth } from "firebase/auth";
import { getFirestore, Firestore } from "firebase/firestore";
import { getStorage, FirebaseStorage } from "firebase/storage";
import { getFunctions, Functions } from "firebase/functions";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { Platform } from "react-native";

const extra = (Constants.expoConfig?.extra as any) ?? {};
const cfg = extra.firebase ?? {};
const region = extra.functionsRegion || "us-central1";

if (!cfg.apiKey) {
  // Surfaces a clear error instead of a cryptic Firebase one.
  console.warn(
    "[firebase] Missing config. Copy app/.env.example to app/.env and fill in EXPO_PUBLIC_FIREBASE_* values."
  );
}

const app: FirebaseApp = getApps().length ? getApp() : initializeApp(cfg);

// The umbrella `firebase/auth` build doesn't reliably export
// `getReactNativePersistence`, so define an equivalent AsyncStorage-backed
// persistence class (same internal interface Firebase expects). This keeps a
// signed-in user signed in across app restarts. Prefer Firebase's own if present.
const nativeGetPersistence = (require("firebase/auth") as any).getReactNativePersistence as
  | ((storage: unknown) => unknown)
  | undefined;

class AsyncStoragePersistence {
  static type = "LOCAL" as const;
  readonly type = "LOCAL" as const;
  async _isAvailable(): Promise<boolean> {
    return true;
  }
  async _set(key: string, value: unknown): Promise<void> {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  }
  async _get<T>(key: string): Promise<T | null> {
    const v = await AsyncStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  }
  async _remove(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
  }
  _addListener(): void {}
  _removeListener(): void {}
}

const persistence = (
  typeof nativeGetPersistence === "function"
    ? nativeGetPersistence(AsyncStorage)
    : AsyncStoragePersistence
) as never;

let auth: Auth;
if (Platform.OS === "web") {
  // Web: Firebase's default browser persistence (localStorage/indexedDB) keeps
  // the session, and getAuth wires the popup-redirect resolver signInWithPopup needs.
  auth = getAuth(app);
} else {
  try {
    auth = initializeAuth(app, { persistence });
  } catch {
    // Already initialized (e.g. Fast Refresh) - reuse the instance, which keeps
    // the persistence configured on first init.
    auth = getAuth(app);
  }
}

const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);
const functions: Functions = getFunctions(app, region);

export { app, auth, db, storage, functions };

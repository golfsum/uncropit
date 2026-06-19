import { ExpoConfig, ConfigContext } from "expo/config";

/**
 * Expo app config. Reads Firebase + Google OAuth values from environment
 * (.env via EXPO_PUBLIC_* — these are safe to ship; Firebase web keys are not
 * secrets, security is enforced by Auth + Firestore rules).
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "UnCrop It",
  slug: "uncrop-it",
  owner: "golf-sum",
  scheme: "expandai",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  splash: {
    image: "./assets/icon.png",
    resizeMode: "contain",
    backgroundColor: "#CCD0BD",
  },
  assetBundlePatterns: ["**/*"],
  web: {
    bundler: "metro",
    output: "single",
    favicon: "./assets/favicon.png",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.expandai.uncropper",
    usesAppleSignIn: true,
    infoPlist: {
      NSPhotoLibraryUsageDescription:
        "UnCrop It needs access to your photos to uncrop and resize them.",
      NSPhotoLibraryAddUsageDescription:
        "UnCrop It saves your resized and uncropped images to your photo library.",
      NSCameraUsageDescription:
        "UnCrop It can use your camera to capture a photo to expand or resize.",
      // Expose the app's Documents folder in the Files app (saved favicons live here).
      UIFileSharingEnabled: true,
      LSSupportsOpeningDocumentsInPlace: true,
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  plugins: [
    "expo-router",
    "expo-apple-authentication",
    "expo-secure-store",
    [
      // GoogleSignIn → AppCheckCore (Swift) can't link as a static library
      // against GoogleUtilities/RecaptchaInterop; static frameworks fix it.
      "expo-build-properties",
      { ios: { useFrameworks: "static" } },
    ],
    [
      "@react-native-google-signin/google-signin",
      {
        // Reversed iOS OAuth client id — required so Google can redirect back
        // to the native app (no exp:// web redirect, unlike Expo Go).
        iosUrlScheme:
          "com.googleusercontent.apps." +
          (process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "").replace(".apps.googleusercontent.com", ""),
      },
    ],
    [
      "expo-image-picker",
      {
        photosPermission: "UnCrop It accesses your photos so you can uncrop and resize them.",
      },
    ],
  ],
  extra: {
    router: {},
    eas: {
      projectId: process.env.EAS_PROJECT_ID ?? "31cb3473-7842-4d6f-8edb-dd9f4057219a",
    },
    firebase: {
      apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
      storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    },
    googleAuth: {
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    },
    functionsRegion: process.env.EXPO_PUBLIC_FUNCTIONS_REGION ?? "us-central1",
    revenueCatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "",
  },
});

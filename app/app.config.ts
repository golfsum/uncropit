import { ExpoConfig, ConfigContext } from "expo/config";

/**
 * Expo app config. Reads Firebase + Google OAuth values from environment
 * (.env via EXPO_PUBLIC_* — these are safe to ship; Firebase web keys are not
 * secrets, security is enforced by Auth + Firestore rules).
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Expand AI",
  slug: "expand-ai",
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
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.expandai.uncropper",
    usesAppleSignIn: true,
    infoPlist: {
      NSPhotoLibraryUsageDescription:
        "Expand AI needs access to your photos to uncrop and resize them.",
      NSPhotoLibraryAddUsageDescription:
        "Expand AI saves your resized and uncropped images to your photo library.",
      NSCameraUsageDescription:
        "Expand AI can use your camera to capture a photo to expand or resize.",
      // Expose the app's Documents folder in the Files app (saved favicons live here).
      UIFileSharingEnabled: true,
      LSSupportsOpeningDocumentsInPlace: true,
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  plugins: [
    "expo-router",
    "expo-apple-authentication",
    "expo-web-browser",
    [
      "expo-image-picker",
      {
        photosPermission: "Expand AI accesses your photos so you can uncrop and animate them.",
      },
    ],
  ],
  extra: {
    router: {},
    eas: {
      // Filled in by `eas build:configure`.
      projectId: process.env.EAS_PROJECT_ID ?? "",
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
  },
});

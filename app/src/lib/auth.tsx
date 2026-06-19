import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
} from "react";
import {
  User,
  onAuthStateChanged,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  linkWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  OAuthProvider,
  signOut as fbSignOut,
} from "firebase/auth";
import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import Constants from "expo-constants";
import { auth } from "./firebase";

// Native Google Sign-In - lazy-required so importing this file never crashes
// Expo Go (the native module only exists in a dev/standalone build).
function getGoogleSignin(): any | null {
  try {
    // The package's GoogleSigninButton native spec is stubbed in metro.config.js
    // (we only use the GoogleSignin module, not the button component).
    return require("@react-native-google-signin/google-signin").GoogleSignin;
  } catch {
    return null;
  }
}

interface AuthState {
  user: User | null;
  initializing: boolean;
  signInAnon: () => Promise<void>;
  signInGoogle: () => Promise<void>;
  signInApple: () => Promise<void>;
  signUpEmail: (email: string, password: string) => Promise<void>;
  signInEmail: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [initializing, setInitializing] = useState(true);

  const googleCfg = (Constants.expoConfig?.extra as any)?.googleAuth ?? {};

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitializing(false);
    });
    return unsub;
  }, []);

  const signInAnon = useCallback(async () => {
    await signInAnonymously(auth);
  }, []);

  const signInGoogle = useCallback(async () => {
    // Web: native Google SDK doesn't exist - use Firebase's popup flow.
    if (Platform.OS === "web") {
      await signInWithPopup(auth, new GoogleAuthProvider());
      return;
    }
    const GoogleSignin = getGoogleSignin();
    if (!GoogleSignin) {
      throw new Error("Google sign-in requires a dev/standalone build (not available in Expo Go).");
    }
    GoogleSignin.configure({
      webClientId: googleCfg.webClientId, // for the Firebase ID token
      iosClientId: googleCfg.iosClientId,
    });
    await GoogleSignin.hasPlayServices().catch(() => undefined);
    const res: any = await GoogleSignin.signIn();
    if (res?.type === "cancelled") {
      const err: any = new Error("Cancelled");
      err.code = "ERR_REQUEST_CANCELED";
      throw err;
    }
    const idToken = res?.data?.idToken ?? res?.idToken;
    if (!idToken) throw new Error("Google did not return an ID token.");
    await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
  }, [googleCfg.webClientId, googleCfg.iosClientId]);

  const signInApple = useCallback(async () => {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    if (!credential.identityToken) {
      throw new Error("Apple did not return an identity token.");
    }
    const provider = new OAuthProvider("apple.com");
    const firebaseCred = provider.credential({
      idToken: credential.identityToken,
    });
    await signInWithCredential(auth, firebaseCred);
  }, []);

  const signUpEmail = useCallback(async (email: string, password: string) => {
    const cur = auth.currentUser;
    // Upgrade an existing guest (anonymous) session in place so work isn't lost.
    if (cur?.isAnonymous) {
      await linkWithCredential(cur, EmailAuthProvider.credential(email.trim(), password));
    } else {
      await createUserWithEmailAndPassword(auth, email.trim(), password);
    }
  }, []);

  const signInEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  }, []);

  const signOut = useCallback(async () => {
    await fbSignOut(auth);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      initializing,
      signInAnon,
      signInGoogle,
      signInApple,
      signUpEmail,
      signInEmail,
      signOut,
    }),
    [user, initializing, signInAnon, signInGoogle, signInApple, signUpEmail, signInEmail, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

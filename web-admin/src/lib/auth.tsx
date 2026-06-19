import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
} from "firebase/auth";
import { auth } from "./firebase";

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  loginGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub = () => {};
    try {
      unsub = onAuthStateChanged(auth, async (u) => {
        setUser(u);
        if (u) {
          const token = await u.getIdTokenResult(true);
          setIsAdmin(token.claims.admin === true);
        } else {
          setIsAdmin(false);
        }
        setLoading(false);
      });
    } catch (e) {
      // Bad/missing Firebase config (e.g. VITE_FIREBASE_* not set on the host) —
      // don't crash the whole app to a blank page; show the UI signed-out.
      console.error("[auth] init failed — check VITE_FIREBASE_* env vars", e);
      setLoading(false);
    }
    return () => unsub();
  }, []);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), password);
  };
  const signup = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(auth, email.trim(), password);
  };
  const loginGoogle = async () => {
    await signInWithPopup(auth, new GoogleAuthProvider());
  };
  const logout = async () => {
    await fbSignOut(auth);
  };

  return (
    <Ctx.Provider value={{ user, isAdmin, loading, login, signup, loginGoogle, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
}

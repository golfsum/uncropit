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
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        const token = await u.getIdTokenResult(true);
        setIsAdmin(token.claims.admin === true);
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
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

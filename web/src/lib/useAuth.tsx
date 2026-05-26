import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
} from "firebase/auth";
import type { User } from "firebase/auth";
import { auth, googleProvider, microsoftProvider } from "./firebase";

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithMicrosoft: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Resolve any pending redirect sign-in on app boot. Errors here are
    // surfaced to the console; the auth-state subscription below still drives UI.
    getRedirectResult(auth).catch((err) => {
      console.error("getRedirectResult:", err);
    });

    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    signInWithGoogle: () => signInWithRedirect(auth, googleProvider),
    signInWithMicrosoft: () => signInWithRedirect(auth, microsoftProvider),
    signOut: () => fbSignOut(auth),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

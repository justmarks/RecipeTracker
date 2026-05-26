import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut as fbSignOut,
} from "firebase/auth";
import type { AuthProvider as FirebaseAuthProvider, User } from "firebase/auth";
import { auth, googleProvider, microsoftProvider } from "./firebase";

// Popup works on the same origin (no cross-origin storage sync needed),
// which is much more reliable during local development. Production sticks
// with redirect because popup breaks in installed-PWA contexts on iOS.
const useDevPopup = import.meta.env.DEV;

async function signIn(provider: FirebaseAuthProvider) {
  if (useDevPopup) {
    await signInWithPopup(auth, provider);
  } else {
    await signInWithRedirect(auth, provider);
  }
}

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
    signInWithGoogle: () => signIn(googleProvider),
    signInWithMicrosoft: () => signIn(microsoftProvider),
    signOut: () => fbSignOut(auth),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

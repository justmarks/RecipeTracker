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
import { trackEvent } from "./analytics";

// Popup works on the same origin (no cross-origin storage sync needed),
// which is much more reliable during local development. Production sticks
// with redirect because popup breaks in installed-PWA contexts on iOS.
const useDevPopup = import.meta.env.DEV;

async function signIn(provider: FirebaseAuthProvider, method: string) {
  if (useDevPopup) {
    await signInWithPopup(auth, provider);
    // Track only on completed popup sign-in. For redirect we'd log on
    // the next mount after getRedirectResult resolves, but the
    // onAuthStateChanged subscription is more reliable for that path —
    // see useEffect below.
    trackEvent("login", { method });
  } else {
    await signInWithRedirect(auth, provider);
    // No event here — sign-in completes after the redirect returns.
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
    getRedirectResult(auth)
      .then((result) => {
        if (result) {
          // Redirect sign-in just completed. Log the GA4 `login` event
          // here so we don't miss it (popup path logs from signIn
          // directly).
          trackEvent("login", {
            method: result.providerId ?? "unknown",
          });
        }
      })
      .catch((err) => {
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
    signInWithGoogle: () => signIn(googleProvider, "google.com"),
    signInWithMicrosoft: () => signIn(microsoftProvider, "microsoft.com"),
    signOut: () => fbSignOut(auth),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}

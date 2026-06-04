import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, OAuthProvider, connectAuthEmulator } from "firebase/auth";
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  // Optional. When present, lib/analytics.ts will lazy-init GA4 on
  // the first event. When absent, analytics is a silent no-op so dev
  // setups without a measurement id keep working unchanged.
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const app = initializeApp(config);
export const auth = getAuth(app);
// Firestore with IndexedDB-backed persistent cache so cold starts show
// cached data instantly and sync the delta from network in the
// background. Critical for the installed-PWA / mobile experience —
// without this, every launch re-fetches every recipe document over
// the wire before anything renders.
//
// `persistentMultipleTabManager` opts into shared cache across tabs
// (some users keep recipes open in multiple tabs while cooking) and is
// the modern replacement for the legacy enableMultiTabIndexedDbPersistence.
//
// ignoreUndefinedProperties keeps optional fields with no value (notes,
// yield, prepTime, etc.) from throwing on addDoc/setDoc — they drop
// silently from the write. Pair this with deleteField() in update
// paths when the user explicitly clears a field that previously had a
// value (see EditRecipe.tsx).
export const db = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager(),
  }),
});
export const functions = getFunctions(app);
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();

export const microsoftProvider = new OAuthProvider("microsoft.com");
microsoftProvider.setCustomParameters({ tenant: "common" });
microsoftProvider.addScope("openid");
microsoftProvider.addScope("email");
microsoftProvider.addScope("profile");

if (import.meta.env.VITE_USE_EMULATOR === "1") {
  connectAuthEmulator(auth, "http://localhost:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "localhost", 8080);
  connectFunctionsEmulator(functions, "localhost", 5001);
  connectStorageEmulator(storage, "localhost", 9199);
}

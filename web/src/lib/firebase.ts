import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, OAuthProvider, connectAuthEmulator } from "firebase/auth";
import { initializeFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const app = initializeApp(config);
export const auth = getAuth(app);
// ignoreUndefinedProperties so optional fields with no value (notes, yield,
// prepTime, etc.) drop silently instead of throwing on addDoc/setDoc.
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
export const functions = getFunctions(app);

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
}

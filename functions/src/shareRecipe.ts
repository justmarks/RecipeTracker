import {onCall, HttpsError} from "firebase-functions/https";
import {initializeApp, getApps} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore, FieldValue} from "firebase-admin/firestore";

// Initialize the Admin SDK exactly once per cold start — multiple callables
// in this codebase share the same instance.
if (getApps().length === 0) initializeApp();

/**
 * Look up a user by email (case-normalized) via the Auth Admin SDK.
 * Returns null if no account exists — the caller turns that into a
 * "user hasn't signed up yet" message for the UI.
 *
 * @param {string} email - The email to look up (case-insensitive).
 * @return {Promise<{uid: string, email: string} | null>} the matching
 *   user record, or null if no account exists for that email.
 */
async function findUserByEmail(email: string): Promise<{
  uid: string;
  email: string;
} | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;
  try {
    const record = await getAuth().getUserByEmail(normalized);
    return {uid: record.uid, email: record.email ?? normalized};
  } catch (err) {
    const code = (err as {code?: string}).code;
    if (code === "auth/user-not-found") return null;
    throw err;
  }
}

/**
 * shareRecipe — owner adds another user (by email) to a recipe's
 * `sharedWith` array. Also denormalizes the grantee's email into
 * `sharedWithDetails` so the share-dialog UI can display who has access
 * without doing a separate Auth lookup on every render.
 *
 * Idempotent: re-sharing to the same user is a no-op.
 */
export const shareRecipe = onCall<{
  recipeId: string;
  granteeEmail: string;
}>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in to share recipes.");
  }
  const {recipeId, granteeEmail} = request.data;
  if (!recipeId || !granteeEmail) {
    throw new HttpsError(
      "invalid-argument",
      "recipeId and granteeEmail are required.",
    );
  }

  const db = getFirestore();
  const recipeRef = db.collection("recipes").doc(recipeId);
  const snap = await recipeRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Recipe not found.");
  }
  const recipe = snap.data() as {
    ownerId: string;
    sharedWith?: string[];
    sharedWithDetails?: {uid: string; email: string}[];
  };
  if (recipe.ownerId !== uid) {
    throw new HttpsError(
      "permission-denied",
      "Only the recipe owner can share it.",
    );
  }

  const grantee = await findUserByEmail(granteeEmail);
  if (!grantee) {
    throw new HttpsError(
      "not-found",
      "No account found for that email. Ask them to sign in first.",
    );
  }
  if (grantee.uid === uid) {
    throw new HttpsError(
      "invalid-argument",
      "You already own this recipe — no need to share with yourself.",
    );
  }

  // Idempotent — Firestore's arrayUnion handles dedupe for `sharedWith`.
  // For sharedWithDetails we have to dedupe manually because each element
  // is an object and arrayUnion uses deep-equality on the full object.
  const existingDetails = recipe.sharedWithDetails ?? [];
  const alreadyShared = existingDetails.some((d) => d.uid === grantee.uid);
  const updatedDetails = alreadyShared ?
    existingDetails :
    [...existingDetails, grantee];

  await recipeRef.update({
    sharedWith: FieldValue.arrayUnion(grantee.uid),
    sharedWithDetails: updatedDetails,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {grantee};
});

/**
 * unshareRecipe — owner removes a uid from a recipe's `sharedWith`
 * array. Also strips the matching entry from `sharedWithDetails`.
 */
export const unshareRecipe = onCall<{
  recipeId: string;
  granteeUid: string;
}>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in to manage shares.");
  }
  const {recipeId, granteeUid} = request.data;
  if (!recipeId || !granteeUid) {
    throw new HttpsError(
      "invalid-argument",
      "recipeId and granteeUid are required.",
    );
  }

  const db = getFirestore();
  const recipeRef = db.collection("recipes").doc(recipeId);
  const snap = await recipeRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Recipe not found.");
  }
  const recipe = snap.data() as {
    ownerId: string;
    sharedWithDetails?: {uid: string; email: string}[];
  };
  if (recipe.ownerId !== uid) {
    throw new HttpsError(
      "permission-denied",
      "Only the recipe owner can change shares.",
    );
  }

  const updatedDetails = (recipe.sharedWithDetails ?? []).filter(
    (d) => d.uid !== granteeUid,
  );

  await recipeRef.update({
    sharedWith: FieldValue.arrayRemove(granteeUid),
    sharedWithDetails: updatedDetails,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {ok: true};
});

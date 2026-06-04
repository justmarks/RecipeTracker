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
 * Mirrors the helper in shareRecipe.ts; duplicated rather than imported
 * because each callable file initializes the admin SDK and we want each
 * to be standalone for Cloud Functions deployment.
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
 * shareMealPlan — owner adds another user (by email) to a meal plan's
 * `sharedWith` array. Also denormalizes the grantee's email into
 * `sharedWithDetails` so the share-dialog UI can display who has access
 * without doing a separate Auth lookup on every render.
 *
 * Idempotent: re-sharing to the same user is a no-op (the deep-dedupe
 * on sharedWithDetails matches the recipe pattern).
 *
 * Shared users gain READ access only — the firestore.rules
 * `mealPlans/{planId}` update rule remains owner-only, so the
 * collaborator can view the plan but can't edit or delete it.
 */
export const shareMealPlan = onCall<{
  planId: string;
  granteeEmail: string;
}>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in to share meal plans.");
  }
  const {planId, granteeEmail} = request.data;
  if (!planId || !granteeEmail) {
    throw new HttpsError(
      "invalid-argument",
      "planId and granteeEmail are required.",
    );
  }

  const db = getFirestore();
  const planRef = db.collection("mealPlans").doc(planId);
  const snap = await planRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Meal plan not found.");
  }
  const plan = snap.data() as {
    ownerId: string;
    sharedWith?: string[];
    sharedWithDetails?: {uid: string; email: string}[];
  };
  if (plan.ownerId !== uid) {
    throw new HttpsError(
      "permission-denied",
      "Only the meal plan owner can share it.",
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
      "You already own this meal plan — no need to share with yourself.",
    );
  }

  // Idempotent — Firestore's arrayUnion handles dedupe for `sharedWith`.
  // For sharedWithDetails we dedupe manually because each element is an
  // object and arrayUnion uses deep-equality on the full object.
  const existingDetails = plan.sharedWithDetails ?? [];
  const alreadyShared = existingDetails.some((d) => d.uid === grantee.uid);
  const updatedDetails = alreadyShared ?
    existingDetails :
    [...existingDetails, grantee];

  await planRef.update({
    sharedWith: FieldValue.arrayUnion(grantee.uid),
    sharedWithDetails: updatedDetails,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {grantee};
});

/**
 * unshareMealPlan — owner removes a uid from a meal plan's `sharedWith`
 * array. Also strips the matching entry from `sharedWithDetails`.
 */
export const unshareMealPlan = onCall<{
  planId: string;
  granteeUid: string;
}>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in to manage shares.");
  }
  const {planId, granteeUid} = request.data;
  if (!planId || !granteeUid) {
    throw new HttpsError(
      "invalid-argument",
      "planId and granteeUid are required.",
    );
  }

  const db = getFirestore();
  const planRef = db.collection("mealPlans").doc(planId);
  const snap = await planRef.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Meal plan not found.");
  }
  const plan = snap.data() as {
    ownerId: string;
    sharedWithDetails?: {uid: string; email: string}[];
  };
  if (plan.ownerId !== uid) {
    throw new HttpsError(
      "permission-denied",
      "Only the meal plan owner can change shares.",
    );
  }

  const updatedDetails = (plan.sharedWithDetails ?? []).filter(
    (d) => d.uid !== granteeUid,
  );

  await planRef.update({
    sharedWith: FieldValue.arrayRemove(granteeUid),
    sharedWithDetails: updatedDetails,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return {ok: true};
});

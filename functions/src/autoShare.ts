import {onCall, HttpsError} from "firebase-functions/https";
import {initializeApp, getApps} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";
import {getFirestore, FieldValue} from "firebase-admin/firestore";

if (getApps().length === 0) initializeApp();

/**
 * grantAutoShare — owner grants blanket access to all current + future
 * recipes for the given email. Backed by a deterministic doc id at
 * `autoShares/{ownerId}_{granteeUid}` so security rules can do an O(1)
 * `exists()` check during recipe reads.
 *
 * Idempotent: re-granting to the same user is a no-op (the existing doc
 * is preserved as-is).
 */
export const grantAutoShare = onCall<{
  granteeEmail: string;
}>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in to share recipes.");
  }
  const {granteeEmail} = request.data;
  if (!granteeEmail) {
    throw new HttpsError("invalid-argument", "granteeEmail is required.");
  }

  const normalized = granteeEmail.trim().toLowerCase();
  let grantee: {uid: string; email: string};
  try {
    const record = await getAuth().getUserByEmail(normalized);
    grantee = {uid: record.uid, email: record.email ?? normalized};
  } catch (err) {
    const code = (err as {code?: string}).code;
    if (code === "auth/user-not-found") {
      throw new HttpsError(
        "not-found",
        "No account found for that email. Ask them to sign in first.",
      );
    }
    throw err;
  }

  if (grantee.uid === uid) {
    throw new HttpsError(
      "invalid-argument",
      "You already see all your own recipes — no need to grant yourself access.",
    );
  }

  // The token's email is the owner's own email — denormalize it onto the
  // autoShare doc so the grantee's Sharing UI can render "Shared by
  // alice@example.com" instead of a generic placeholder. Falls back to a
  // server-side lookup if the token doesn't include email (rare — Firebase
  // ID tokens always carry email for password / Google / Microsoft sign-in).
  let ownerEmail = request.auth?.token.email ?? null;
  if (!ownerEmail) {
    try {
      const ownerRecord = await getAuth().getUser(uid);
      ownerEmail = ownerRecord.email ?? null;
    } catch {
      // Leave ownerEmail null — grantee will see the fallback label.
    }
  }

  const db = getFirestore();
  const shareId = `${uid}_${grantee.uid}`;
  const ref = db.collection("autoShares").doc(shareId);
  const existing = await ref.get();
  if (existing.exists) {
    // Already granted. Backfill ownerEmail if the existing doc is from
    // before we stored it — cheap one-field merge, doesn't disturb the
    // existing createdAt.
    if (ownerEmail && !existing.data()?.ownerEmail) {
      await ref.set({ownerEmail}, {merge: true});
    }
    return {grantee, alreadyGranted: true};
  }

  await ref.set({
    ownerId: uid,
    ownerEmail,
    granteeUid: grantee.uid,
    granteeEmail: grantee.email,
    createdAt: FieldValue.serverTimestamp(),
  });

  return {grantee, alreadyGranted: false};
});

/**
 * revokeAutoShare — owner removes the blanket grant for a specific uid.
 * Per-recipe `sharedWith` entries are independent and untouched —
 * revoking an auto-share never strips an explicit share.
 */
export const revokeAutoShare = onCall<{
  granteeUid: string;
}>(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Sign in to manage shares.");
  }
  const {granteeUid} = request.data;
  if (!granteeUid) {
    throw new HttpsError("invalid-argument", "granteeUid is required.");
  }

  const db = getFirestore();
  await db.collection("autoShares").doc(`${uid}_${granteeUid}`).delete();
  return {ok: true};
});

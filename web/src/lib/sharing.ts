import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";

/**
 * Thin client wrappers around the sharing Cloud Functions. Two flavors:
 *
 *   - Per-recipe: shareRecipe / unshareRecipe write to a single recipe's
 *     `sharedWith` array. Used by the Share dialog on RecipeDetail.
 *   - Auto-share: grantAutoShare / revokeAutoShare manage docs in the
 *     top-level autoShares collection, which acts like a blanket "give
 *     this person access to everything I own."
 *
 * Both flavors enforce ownership server-side and resolve email → uid via
 * the Auth Admin SDK, so the client never has to know the recipient's uid.
 */

export type ShareGrantee = { uid: string; email: string };

export const callShareRecipe = httpsCallable<
  { recipeId: string; granteeEmail: string },
  { grantee: ShareGrantee }
>(functions, "shareRecipe");

export const callUnshareRecipe = httpsCallable<
  { recipeId: string; granteeUid: string },
  { ok: true }
>(functions, "unshareRecipe");

export const callGrantAutoShare = httpsCallable<
  { granteeEmail: string },
  { grantee: ShareGrantee; alreadyGranted: boolean }
>(functions, "grantAutoShare");

export const callRevokeAutoShare = httpsCallable<
  { granteeUid: string },
  { ok: true }
>(functions, "revokeAutoShare");

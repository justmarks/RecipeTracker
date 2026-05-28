import {onDocumentDeleted, onDocumentUpdated}
  from "firebase-functions/v2/firestore";
import {initializeApp, getApps} from "firebase-admin/app";
import {getStorage} from "firebase-admin/storage";
import {logger} from "firebase-functions";

if (getApps().length === 0) initializeApp();

/**
 * Parse the storage object path out of a Firebase Storage download URL.
 *
 * Download URLs look like:
 *   https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<encoded-path>?alt=media&token=...
 *
 * Returns null when the URL isn't a Firebase Storage URL at all (e.g.
 * a hand-pasted Unsplash link) — those photos aren't ours to delete.
 *
 * @param {string} url - The full https download URL to parse.
 * @return {string | null} The decoded storage object path, or null if the
 *   URL doesn't match the Firebase Storage download pattern.
 */
function pathFromDownloadUrl(url: string): string | null {
  const match = url.match(
    /firebasestorage\.googleapis\.com\/v0\/b\/[^/]+\/o\/([^?]+)/,
  );
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return null;
  }
}

/**
 * Delete the given storage object, treating "already gone" as success.
 * Anything else gets logged but doesn't throw — orphan cleanup is best-
 * effort, and a failure here shouldn't roll back the recipe delete that
 * already happened in Firestore.
 *
 * @param {string} path - The storage object path (no bucket prefix).
 * @return {Promise<void>} Resolves once the delete attempt completes.
 */
async function deleteIfExists(path: string): Promise<void> {
  try {
    await getStorage().bucket().file(path).delete();
    logger.info(`Deleted orphaned photo: ${path}`);
  } catch (err) {
    const code = (err as {code?: number}).code;
    if (code === 404) return; // already gone, fine
    logger.error(`Failed to delete photo ${path}:`, err);
  }
}

/**
 * Safety check: only delete photos that live under the recipe owner's
 * directory (recipes/{ownerId}/). If a malicious or buggy client wrote
 * a photoUrl pointing at another user's file, we don't want to dutifully
 * delete it just because the owner deleted their own recipe.
 *
 * @param {string} path - The storage object path being considered.
 * @param {string} ownerId - The recipe's ownerId field.
 * @return {boolean} True iff the path lives under recipes/{ownerId}/.
 */
function isOwnedByRecipeOwner(path: string, ownerId: string): boolean {
  return path.startsWith(`recipes/${ownerId}/`);
}

/**
 * onDelete trigger: when a recipe doc is deleted, look at its photoUrl
 * and remove the matching file from Storage. No-op if there's no photo
 * or if the photo wasn't hosted in Firebase Storage (external URL).
 */
export const cleanupRecipePhotoOnDelete = onDocumentDeleted(
  "recipes/{recipeId}",
  async (event) => {
    const data = event.data?.data();
    if (!data) return;
    const photoUrl = data.photoUrl as string | undefined;
    const ownerId = data.ownerId as string | undefined;
    if (!photoUrl || !ownerId) return;

    const path = pathFromDownloadUrl(photoUrl);
    if (!path) {
      logger.info(`Non-Storage photoUrl, nothing to clean: ${photoUrl}`);
      return;
    }
    if (!isOwnedByRecipeOwner(path, ownerId)) {
      logger.warn(
        `Refusing to delete photo outside owner directory: ${path}`,
      );
      return;
    }
    await deleteIfExists(path);
  },
);

/**
 * onUpdate trigger: when a recipe's photoUrl changes (replaced photo or
 * photo cleared), delete the previous file if it was a Storage object.
 * Without this, every photo replacement leaves behind a stale file
 * the user has no way to clean up.
 */
export const cleanupRecipePhotoOnUpdate = onDocumentUpdated(
  "recipes/{recipeId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;
    const beforeUrl = before.photoUrl as string | undefined;
    const afterUrl = after.photoUrl as string | undefined;
    const ownerId = after.ownerId as string | undefined;
    if (!beforeUrl || beforeUrl === afterUrl || !ownerId) return;

    const path = pathFromDownloadUrl(beforeUrl);
    if (!path) return;
    if (!isOwnedByRecipeOwner(path, ownerId)) {
      logger.warn(
        `Refusing to delete replaced photo outside owner directory: ${path}`,
      );
      return;
    }
    await deleteIfExists(path);
  },
);

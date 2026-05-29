import {onDocumentDeleted, onDocumentUpdated}
  from "firebase-functions/v2/firestore";
import {initializeApp, getApps} from "firebase-admin/app";
import {getStorage} from "firebase-admin/storage";
import {logger} from "firebase-functions";
import {pathFromDownloadUrl, isOwnedByRecipeOwner}
  from "./photoCleanupHelpers.js";

if (getApps().length === 0) initializeApp();

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

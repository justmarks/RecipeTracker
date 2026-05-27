import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import { storage } from "./firebase";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024; // matches storage.rules

/**
 * Upload a recipe photo to Firebase Storage and return its public
 * download URL. Path: `recipes/{uid}/{timestamp}-{safeName}`.
 *
 * Validates client-side (image MIME, ≤10MB) so the user gets an
 * immediate error rather than waiting for the rules-layer rejection.
 * The storage.rules block enforces the same limits on the server.
 *
 * Note: deleted recipes don't currently cascade their photo. Orphaned
 * blobs accumulate. Cleanup is a future Cloud Function task.
 */
export async function uploadRecipePhoto(
  file: File,
  uid: string,
): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Only image files are supported.");
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error("Image must be smaller than 10MB.");
  }
  const safeName = file.name
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(-60);
  const path = `recipes/${uid}/${Date.now()}-${safeName}`;
  const ref = storageRef(storage, path);
  await uploadBytes(ref, file, { contentType: file.type });
  return await getDownloadURL(ref);
}

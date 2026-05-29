/**
 * Parse the storage object path out of a Firebase Storage download URL.
 *
 * Download URLs look like:
 *   https://firebasestorage.googleapis.com/v0/b/<bucket>/o/<encoded-path>?alt=media&token=...
 *
 * Returns null when the URL isn't a Firebase Storage URL at all (e.g.
 * a hand-pasted Unsplash link) — those photos aren't ours to delete.
 * @param {string} url - Firebase Storage download URL
 * @return {string | null} Decoded storage path, or null if not a Firebase Storage URL
 */
export function pathFromDownloadUrl(url: string): string | null {
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
 * Safety check: only delete photos that live under the recipe owner's
 * directory (recipes/{ownerId}/). If a malicious or buggy client wrote
 * a photoUrl pointing at another user's file, we don't want to dutifully
 * delete it just because the owner deleted their own recipe.
 * @param {string} path - Storage object path
 * @param {string} ownerId - Recipe owner's Firebase Auth uid
 * @return {boolean} True if the path belongs to the owner's directory
 */
export function isOwnedByRecipeOwner(path: string, ownerId: string): boolean {
  return path.startsWith(`recipes/${ownerId}/`);
}

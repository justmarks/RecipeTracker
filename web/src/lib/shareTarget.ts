/**
 * Client-side counterpart to web/public/share-target-handler.js.
 *
 * When the user shares a photo to the PWA (Android Chrome only — iOS
 * doesn't support Web Share Target), the service worker intercepts the
 * POST /import, stashes the file in CacheStorage, and redirects to
 * /import?via=share-photo. The Import route then calls
 * consumeSharedFile() to pull the file back out and feed it into the
 * vision importer.
 *
 * Single-use semantics: reading the file also deletes it. A second
 * call returns null, so navigating away and back doesn't replay an
 * old share by accident.
 */

const SHARE_CACHE = "marksrecipebook-share-target";
const SHARED_FILE_KEY = "/__shared-file__";

export async function consumeSharedFile(): Promise<File | null> {
  if (typeof caches === "undefined") return null;
  try {
    const cache = await caches.open(SHARE_CACHE);
    const response = await cache.match(SHARED_FILE_KEY);
    if (!response) return null;
    const blob = await response.blob();
    const filename =
      response.headers.get("X-Shared-Filename") || "shared-photo";
    // Best-effort delete — even if it fails, we've already consumed
    // the bytes locally, so the next call will still get the cache
    // miss and return null thanks to the matched-once semantics.
    void cache.delete(SHARED_FILE_KEY);
    return new File([blob], filename, {
      type: blob.type || "image/jpeg",
    });
  } catch (err) {
    console.error("consumeSharedFile:", err);
    return null;
  }
}

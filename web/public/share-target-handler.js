/* global self, caches, Response */

/**
 * Share-target POST handler — pulled into the generated Workbox SW via
 * the `workbox.importScripts` config in vite.config.ts. We can't put
 * this logic in workbox runtime caching because it needs to intercept
 * a non-GET request and manage CacheStorage state.
 *
 * Flow (Android Chrome share sheet → "MarksRecipeBook" → user shares
 * a photo from gallery):
 *
 *   1. The browser POSTs multipart/form-data to /import.
 *   2. We intercept here, pull the file out, and stash it in
 *      CacheStorage under a known key.
 *   3. We respond with a 303 redirect to /import?via=share-photo so
 *      the SPA navigates to the import page through a normal GET (the
 *      original POST URL would re-POST on refresh).
 *   4. Import.tsx detects `?via=share-photo`, reads the cached file
 *      via `consumeSharedFile()` in lib/shareTarget.ts, and feeds it
 *      into the vision-importer pipeline.
 *
 * iOS doesn't support Web Share Target at all — this handler is a no-op
 * there since iOS won't ever POST to /import.
 */

const SHARE_CACHE = "marksrecipebook-share-target";
const SHARED_FILE_KEY = "/__shared-file__";

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "POST") return;
  const url = new URL(event.request.url);
  if (url.pathname !== "/import") return;
  event.respondWith(handleShareTargetPost(event.request));
});

async function handleShareTargetPost(request) {
  try {
    const formData = await request.formData();
    const file = pickFile(formData);
    const title = (formData.get("title") || "").toString();
    const text = (formData.get("text") || "").toString();
    const sharedUrl = (formData.get("url") || "").toString();

    if (file) {
      // Cache the file blob — must be a Response, so wrap it.
      const cache = await caches.open(SHARE_CACHE);
      await cache.put(
        new Request(SHARED_FILE_KEY),
        new Response(file, {
          headers: {
            "Content-Type": file.type || "application/octet-stream",
            "X-Shared-Filename": file.name || "shared-photo",
          },
        }),
      );
      return Response.redirect("/import?via=share-photo", 303);
    }

    // No file — fall back to the URL/text path so a mixed share (image
    // + caption) still lands on the URL fetcher when the caption looks
    // like a link.
    const params = new URLSearchParams();
    if (title) params.set("title", title);
    if (text) params.set("text", text);
    if (sharedUrl) params.set("url", sharedUrl);
    const qs = params.toString();
    return Response.redirect(qs ? `/import?${qs}` : "/import", 303);
  } catch (err) {
    // Log but don't surface — the browser will show its own error UI if
    // we return a non-redirect.
    // eslint-disable-next-line no-console
    console.error("Share target POST failed:", err);
    return Response.redirect("/import?via=share-error", 303);
  }
}

/**
 * The manifest declares `files: [{ name: "photo", accept: [...] }]`, so
 * shared images arrive under the "photo" key. We also check "image" and
 * iterate the FormData as a fallback in case a future manifest tweak or
 * a non-conforming sharing app uses a different key.
 */
function pickFile(formData) {
  const candidates = [formData.get("photo"), formData.get("image")];
  for (const c of candidates) {
    if (c && typeof c === "object" && "arrayBuffer" in c) return c;
  }
  for (const [, value] of formData.entries()) {
    if (
      value &&
      typeof value === "object" &&
      "arrayBuffer" in value &&
      typeof value.type === "string" &&
      (value.type.startsWith("image/") || value.type === "application/pdf")
    ) {
      return value;
    }
  }
  return null;
}

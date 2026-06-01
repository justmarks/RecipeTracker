/**
 * Prep a user-supplied photo or PDF for `importFromImage` upload.
 *
 * Phone cameras produce 5–10+ MB photos at 12+ MP. Claude's vision API
 * caps each image at ~5 MB binary, the Cloud Functions onCall payload
 * caps at 10 MB total, and bigger images take longer to process without
 * meaningfully improving OCR accuracy at the resolutions a recipe scan
 * actually needs.
 *
 * For images this helper resizes the longest side to 2048px and re-
 * encodes to JPEG at quality 0.85 — a comfortable sweet spot for recipe
 * legibility that keeps the payload well under the limits. The original
 * `file.type` is respected for PNG/WebP, since those formats sometimes
 * matter for handwritten ink that JPEG would smudge.
 *
 * For PDFs the file passes through unmodified — they can't be rendered
 * to canvas (no native browser API), and Claude's `document` content
 * block handles multi-page PDFs natively. The 5 MB payload ceiling is
 * the only real constraint; users with chunky scanned PDFs need to
 * compress before uploading.
 */

const MAX_LONGEST_SIDE = 2048;
const JPEG_QUALITY = 0.85;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]);

export type PreparedImage = {
  base64: string;
  mimeType:
    | "image/jpeg"
    | "image/png"
    | "image/webp"
    | "image/gif"
    | "application/pdf";
};

export async function prepareImageForImport(
  file: File,
): Promise<PreparedImage> {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error(
      `Unsupported file type "${file.type || "unknown"}". Use JPEG, PNG, WebP, GIF, or PDF.`,
    );
  }
  // PDFs short-circuit the image-prep pipeline entirely. There's no
  // canvas API for PDFs in browsers, and Claude's `document` block
  // handles them natively across pages. Just base64 the raw file and
  // hand it to the Cloud Function — the server-side 5 MB cap applies.
  if (file.type === "application/pdf") {
    return {
      base64: await fileToBase64(file),
      mimeType: "application/pdf",
    };
  }
  // GIFs (rare for recipes, but the share sheet might offer them) and
  // tiny images skip the resize round-trip — pass straight through.
  // Anything under 500 KB and under 2048px on either side is already
  // small enough to send as-is.
  const bitmap = await loadBitmap(file);
  const longest = Math.max(bitmap.width, bitmap.height);
  const needsResize = longest > MAX_LONGEST_SIDE;
  const isGif = file.type === "image/gif";

  if (!needsResize && !isGif && file.size < 4 * 1024 * 1024) {
    bitmap.close?.();
    return {
      base64: await fileToBase64(file),
      mimeType: file.type as PreparedImage["mimeType"],
    };
  }

  if (isGif) {
    // We can't resize a GIF on canvas without losing animation, and
    // Claude vision treats it as a single frame anyway. Pass through
    // unresized; the server-side 5 MB cap will reject anything huge.
    bitmap.close?.();
    return {
      base64: await fileToBase64(file),
      mimeType: "image/gif",
    };
  }

  const scale = needsResize ? MAX_LONGEST_SIDE / longest : 1;
  const targetW = Math.round(bitmap.width * scale);
  const targetH = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close?.();
    throw new Error("Couldn't create a canvas to resize the image.");
  }
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  bitmap.close?.();

  const outputType: PreparedImage["mimeType"] =
    file.type === "image/png" || file.type === "image/webp"
      ? (file.type as PreparedImage["mimeType"])
      : "image/jpeg";

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, outputType, JPEG_QUALITY),
  );
  if (!blob) {
    throw new Error("Couldn't encode the resized image.");
  }

  return {
    base64: await blobToBase64(blob),
    mimeType: outputType,
  };
}

/**
 * createImageBitmap is faster and handles EXIF orientation on most
 * modern browsers (`imageOrientation: "from-image"`). Safari < 17 may
 * ignore it but recipe photos are usually orientation-correct already.
 */
async function loadBitmap(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Fallback for older Safari: HTMLImageElement, then drawImage.
    return await loadBitmapFallback(file);
  }
}

async function loadBitmapFallback(file: File): Promise<ImageBitmap> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Couldn't decode the image."));
      el.src = url;
    });
    return await createImageBitmap(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function fileToBase64(file: File): Promise<string> {
  return blobToBase64(file);
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  // Chunked btoa to avoid "Maximum call stack size exceeded" on huge
  // images — `String.fromCharCode(...largeArray)` blows the stack.
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(
      null,
      bytes.subarray(i, i + CHUNK) as unknown as number[],
    );
  }
  return btoa(binary);
}

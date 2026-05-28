// generate-icons.mjs — render the design-system app icon SVG into the
// full PNG set the PWA manifest references.
//
//   /public/icons/icon-{192,256,384,512}.png            — "any" purpose
//   /public/icons/icon-maskable-{192,512}.png           — "maskable" purpose
//   /public/icons/apple-touch-icon-180.png              — iOS home screen
//
// "any" icons render the source SVG straight: rounded corners, original
// composition. "maskable" icons drop the rounded corners and inset the
// content inside the 80%-diameter safe zone so the OS mask can crop the
// canvas without slicing into the cookbook art.
//
// Run with:   node scripts/generate-icons.mjs
// or:         pnpm --filter web generate-icons

import sharp from "sharp";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "..", "..");
const sourceSvgPath = join(
  repoRoot,
  ".claude",
  "skills",
  "marksrecipebook-design",
  "assets",
  "app-icon.svg",
);
const outDir = resolve(here, "..", "public", "icons");
mkdirSync(outDir, { recursive: true });

const sourceSvg = readFileSync(sourceSvgPath, "utf8");

// Stash a copy of the source SVG next to the rasters so the manifest
// chain (and any future "render at runtime" use) has a stable path.
writeFileSync(join(outDir, "icon-source.svg"), sourceSvg, "utf8");

/**
 * Build a maskable variant SVG: same content, but
 *  - solid square paper background (no rx)
 *  - artwork scaled to ~84% so the entire icon stays inside the
 *    80%-diameter safe circle that platforms apply
 */
function buildMaskableSvg(src) {
  // Pull everything between the outer <svg> tags so we can reposition it.
  const inner = src.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  // Drop the original rounded background rect — we'll add a full-bleed
  // square one below — and re-emit the rest under a scale transform.
  const innerWithoutBg = inner.replace(
    /<rect\s+width="512"\s+height="512"[^/]*\/>/,
    "",
  );
  // Scale of 0.82 leaves an 18% margin on each side, well within the
  // 80% safe circle (radius 205 from center) for our 280-wide artwork.
  // translate centers the scaled artwork.
  // (1 - 0.82) * 512 / 2 = 46.08 → round to 46
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <defs>
    <linearGradient id="paper-mask" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#FDFAF4"/>
      <stop offset="1" stop-color="#F4ECDD"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#paper-mask)"/>
  <g transform="translate(46 46) scale(0.82)">
    ${innerWithoutBg}
  </g>
</svg>`;
}

const maskableSvg = buildMaskableSvg(sourceSvg);

const anySizes = [192, 256, 384, 512];
const maskableSizes = [192, 512];

async function render(svgBuf, size, outPath) {
  await sharp(svgBuf, { density: 384 })
    .resize(size, size, { fit: "contain" })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  console.log(`  ${outPath.replace(repoRoot, ".")}`);
}

const srcBuf = Buffer.from(sourceSvg);
const maskBuf = Buffer.from(maskableSvg);

console.log("Rendering any-purpose icons:");
for (const size of anySizes) {
  await render(srcBuf, size, join(outDir, `icon-${size}.png`));
}

console.log("Rendering maskable icons:");
for (const size of maskableSizes) {
  await render(maskBuf, size, join(outDir, `icon-maskable-${size}.png`));
}

console.log("Rendering Apple touch icon:");
await render(srcBuf, 180, join(outDir, "apple-touch-icon-180.png"));

// Favicon: pure monogram (M on tomato circle) — high-contrast at 16/32px
// where the cookbook art would just smudge into noise.
const monogramSvgPath = join(
  repoRoot,
  ".claude",
  "skills",
  "marksrecipebook-design",
  "assets",
  "monogram.svg",
);
const monogramSvg = readFileSync(monogramSvgPath);
console.log("Rendering favicon raster fallbacks:");
const publicDir = resolve(here, "..", "public");
await render(monogramSvg, 32, join(publicDir, "favicon-32.png"));
await render(monogramSvg, 16, join(publicDir, "favicon-16.png"));

console.log("Done.");

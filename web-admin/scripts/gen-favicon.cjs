/**
 * Generates favicon / app-icon PNGs in public/ from the app icon.
 * Run: node scripts/gen-favicon.cjs  (or: npm run favicon)
 */
const path = require("path");
const sharp = require("sharp");

const src = path.join(__dirname, "..", "..", "app", "assets", "icon.png");
const outDir = path.join(__dirname, "..", "public");

const sizes = [
  { name: "favicon-16.png", size: 16 },
  { name: "favicon-32.png", size: 32 },
  { name: "favicon-48.png", size: 48 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
];

(async () => {
  for (const { name, size } of sizes) {
    await sharp(src).resize(size, size, { fit: "cover" }).png().toFile(path.join(outDir, name));
    console.log("Wrote", name, `${size}x${size}`);
  }
})();

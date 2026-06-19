/**
 * Generates the social share image at public/og.png (1200x630).
 * Run: node scripts/gen-og.cjs   (re-run after editing the design below)
 */
const fs = require("fs");
const path = require("path");
const { Resvg } = require("@resvg/resvg-js");

const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#8b6bff"/>
      <stop offset="1" stop-color="#21d4b4"/>
    </linearGradient>
    <radialGradient id="glowA" cx="0.12" cy="0.08" r="0.65">
      <stop offset="0" stop-color="#7c5cff" stop-opacity="0.38"/>
      <stop offset="1" stop-color="#7c5cff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glowB" cx="0.92" cy="0.95" r="0.6">
      <stop offset="0" stop-color="#21d4b4" stop-opacity="0.30"/>
      <stop offset="1" stop-color="#21d4b4" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="#0b0b12"/>
  <rect width="1200" height="630" fill="url(#glowA)"/>
  <rect width="1200" height="630" fill="url(#glowB)"/>
  <rect x="0" y="0" width="1200" height="8" fill="url(#accent)"/>

  <!-- eyebrow: diamond + brand -->
  <path d="M88 99 l12 13 l-12 13 l-12 -13 z" fill="#21d4b4"/>
  <text x="114" y="122" font-family="Segoe UI, Arial, sans-serif" font-size="30" font-weight="700" letter-spacing="6" fill="#21d4b4">UNCROP IT AI</text>

  <!-- title -->
  <text x="76" y="296" font-family="Segoe UI, Arial, sans-serif" font-size="106" font-weight="800" fill="#ffffff">Photo Extender</text>
  <text x="76" y="416" font-family="Segoe UI, Arial, sans-serif" font-size="106" font-weight="800" fill="url(#accent)">&amp; Image Resizer</text>

  <!-- tagline -->
  <text x="80" y="492" font-family="Segoe UI, Arial, sans-serif" font-size="32" fill="#c7c7d6">Uncrop &amp; expand any photo with AI. Resize for every platform.</text>

  <!-- feature line -->
  <text x="80" y="558" font-family="Segoe UI, Arial, sans-serif" font-size="26" font-weight="600" fill="#9a9ab0">AI Uncrop  •  Image Extender  •  Photo Resizer  •  No watermark</text>

  <!-- decorative outpaint glyph (top-right) -->
  <g transform="translate(980,66)" fill="none" stroke-linecap="round">
    <rect x="0" y="0" width="150" height="120" rx="16" stroke="#2a2a38" stroke-width="4"/>
    <rect x="40" y="34" width="70" height="52" rx="8" stroke="url(#accent)" stroke-width="4" stroke-dasharray="6 8"/>
    <g stroke="url(#accent)" stroke-width="4">
      <path d="M18 18 L44 18 M18 18 L18 44"/>
      <path d="M132 18 L106 18 M132 18 L132 44"/>
      <path d="M18 102 L44 102 M18 102 L18 76"/>
      <path d="M132 102 L106 102 M132 102 L132 76"/>
    </g>
  </g>
</svg>`;

const resvg = new Resvg(svg, {
  fitTo: { mode: "width", value: 1200 },
  font: { loadSystemFonts: true },
  background: "#0b0b12",
});
const png = resvg.render().asPng();
const out = path.join(__dirname, "..", "public", "og.png");
fs.writeFileSync(out, png);
console.log("Wrote", out, png.length, "bytes");

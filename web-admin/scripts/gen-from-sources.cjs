// Run YOUR photos through aiUncrop (Ideogram V3 Reframe) for the landing demos.
// 1) Save your photos as .jpg/.png into web-admin/public/demo/sources/
// 2) Run: node scripts/gen-from-sources.cjs
// The FIRST file becomes the hero (before.jpg + after.jpg); the next three
// become the feature images (f1.jpg, f2.jpg, f3.jpg).
const fs = require("fs");
const path = require("path");

const KEY = (fs.readFileSync(path.join(__dirname, "../../functions/.env"), "utf8")
  .match(/IDEOGRAM_API_KEY=(.+)/) || [])[1]?.trim();
if (!KEY) throw new Error("IDEOGRAM_API_KEY not found in functions/.env");

const SRC = path.join(__dirname, "../public/demo/sources");
const OUT = path.join(__dirname, "../public/demo");
const files = fs
  .readdirSync(SRC)
  .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
  .sort();

if (!files.length) throw new Error(`No images in ${SRC}. Add .jpg/.png files first.`);

async function reframe(buf) {
  const form = new FormData();
  form.append("image", new Blob([buf], { type: "image/jpeg" }), "image.jpg");
  form.append("resolution", "1344x768"); // widescreen target
  form.append("rendering_speed", "TURBO");
  const res = await fetch("https://api.ideogram.ai/v1/ideogram-v3/reframe", {
    method: "POST",
    headers: { "Api-Key": KEY },
    body: form,
  });
  if (!res.ok) throw new Error(`Ideogram ${res.status}: ${await res.text()}`);
  const url = (await res.json())?.data?.[0]?.url;
  if (!url) throw new Error("No output url from Ideogram");
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}

(async () => {
  for (let i = 0; i < Math.min(files.length, 4); i++) {
    process.stdout.write(`• ${files[i]} … `);
    const buf = fs.readFileSync(path.join(SRC, files[i]));
    const after = await reframe(buf);
    if (i === 0) {
      fs.writeFileSync(path.join(OUT, "before.jpg"), buf);
      fs.writeFileSync(path.join(OUT, "after.jpg"), after);
    } else {
      fs.writeFileSync(path.join(OUT, `f${i}.jpg`), after);
    }
    console.log("done");
  }
  console.log("\nDemos updated. Rebuild/redeploy to see them.");
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});

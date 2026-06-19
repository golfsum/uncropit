// One-off: run royalty-free photos through Ideogram V3 Reframe (same API the
// aiUncrop function uses) to produce real before/after un-crop demos for the
// landing page. Outputs to web-admin/public/demo/. Run: node scripts/gen-demos.js
const fs = require("fs");
const path = require("path");

const KEY = (fs.readFileSync(path.join(__dirname, "../../functions/.env"), "utf8")
  .match(/IDEOGRAM_API_KEY=(.+)/) || [])[1]?.trim();
if (!KEY) throw new Error("IDEOGRAM_API_KEY not found in functions/.env");

const OUT = path.join(__dirname, "../public/demo");
fs.mkdirSync(OUT, { recursive: true });

// Portrait source -> wide output demonstrates horizontal un-crop.
const DEMOS = [
  { seed: "p9portrait", before: "before.jpg", after: "after.jpg" }, // hero (keep before)
  { seed: "k3product", after: "f1.jpg" },
  { seed: "v7desk", after: "f2.jpg" },
  { seed: "z2street", after: "f3.jpg" },
];

async function reframe(buf) {
  const form = new FormData();
  form.append("image", new Blob([buf], { type: "image/jpeg" }), "image.jpg");
  form.append("resolution", "1344x768"); // wide
  form.append("rendering_speed", "TURBO");
  const res = await fetch("https://api.ideogram.ai/v1/ideogram-v3/reframe", {
    method: "POST",
    headers: { "Api-Key": KEY },
    body: form,
  });
  if (!res.ok) throw new Error(`Ideogram ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const url = data?.data?.[0]?.url;
  if (!url) throw new Error("No output url: " + JSON.stringify(data).slice(0, 300));
  return Buffer.from(await (await fetch(url)).arrayBuffer());
}

(async () => {
  for (const d of DEMOS) {
    process.stdout.write(`• ${d.seed} … `);
    const src = Buffer.from(
      await (await fetch(`https://picsum.photos/seed/${d.seed}/820/1180`)).arrayBuffer()
    );
    if (d.before) fs.writeFileSync(path.join(OUT, d.before), src);
    const out = await reframe(src);
    fs.writeFileSync(path.join(OUT, d.after), out);
    console.log("done");
  }
  console.log("\nAll demos written to web-admin/public/demo/");
})().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});

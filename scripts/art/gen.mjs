// node gen.mjs <jobs.json> <outdir> [--estimate] [--only=id,id] [--collect]
// v2 is asynchronous: submit every job, then poll /v2/inferences/tasks until all finish.
// --collect skips submitting and only harvests finished tasks, matched to jobs by image size.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PALETTE = path.join(ROOT, "packages/content/art/palette.png");
const b64 = (file) => fs.readFileSync(file).toString("base64");
const env = fs.readFileSync(new URL("../../.env", import.meta.url), "utf8");
const K = /^RETRO_DIFFUSION_API_KEY=(.+)$/m.exec(env)?.[1]?.trim();
if (!K) throw new Error("no key");
const H = { "X-RD-Token": K, "Content-Type": "application/json" };
const [jobsFile, out, ...flags] = process.argv.slice(2);
const estimate = flags.includes("--estimate");
const collectOnly = flags.includes("--collect");
const only = flags
  .find((f) => f.startsWith("--only="))
  ?.slice(7)
  .split(",");
const allJobs = JSON.parse(fs.readFileSync(jobsFile, "utf8"));
const jobs = allJobs.filter((j) => !only || only.includes(j.id));
fs.mkdirSync(out, { recursive: true });
const mf = path.join(out, "manifest.json");
const manifest = fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, "utf8")) : {};
const save = () => fs.writeFileSync(mf, JSON.stringify(manifest, null, 2));
const pngSize = (b64) => {
  const b = Buffer.from(b64.slice(0, 64), "base64");
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

if (!collectOnly) {
  let total = 0;
  for (const j of jobs) {
    const { id, refs, palette, input, ...body } = j;
    // `input` is a repo path sent as `input_image` (the animation styles' starting frame).
    if (input) body.input_image = b64(path.resolve(ROOT, input));
    // `palette: true` constrains the colours to the scene's palette (D191); `refs` are repo
    // paths of approved sprites sent as reference images (rd_pro styles only, up to 9).
    if (palette) body.input_palette = b64(PALETTE);
    if (refs?.length) body.reference_images = refs.map((ref) => b64(path.resolve(ROOT, ref)));
    if (estimate) body.check_cost = true;
    const res = await fetch("https://api.retrodiffusion.ai/v2/inferences", {
      method: "POST",
      headers: H,
      body: JSON.stringify(body),
    });
    const r = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.log(id, "HTTP", res.status, JSON.stringify(r).slice(0, 200));
      continue;
    }
    if (estimate) {
      total += r.balance_cost ?? 0;
      console.log(
        id.padEnd(12),
        body.prompt_style.padEnd(24),
        `${body.width}x${body.height} x${body.num_images ?? 1}`,
        r.balance_cost,
      );
      continue;
    }
    manifest[id] = { ...body, task_id: r.task_id, files: [] };
    console.log(id.padEnd(12), "accepted", r.task_id);
  }
  save();
  if (estimate) {
    console.log("ESTIMATED TOTAL", total.toFixed(2), "USD");
    process.exit(0);
  }
}

// poll
const want = new Set(jobs.map((j) => j.id));
const bySize = new Map(allJobs.map((j) => [`${j.width}x${j.height}`, j.id]));
const deadline = Date.now() + 8 * 60_000;
while (Date.now() < deadline) {
  const res = await fetch("https://api.retrodiffusion.ai/v2/inferences/tasks?limit=50", {
    headers: H,
  });
  const { tasks = [] } = await res.json();
  for (const t of tasks) {
    if (t.status !== "succeeded" && t.status !== "failed") continue;
    let id = Object.keys(manifest).find((k) => manifest[k].task_id === t.task_id);
    // Only --collect guesses by size, and only for a job with no task of its own: a fresh
    // run must never take an older task of the same size for one of its jobs.
    if (!id && collectOnly && t.status === "succeeded" && t.result?.base64_images?.[0]) {
      const guess = bySize.get(pngSize(t.result.base64_images[0]).join("x"));
      if (guess && !manifest[guess]?.task_id) id = guess;
    }
    if (!id || !want.has(id)) continue;
    if (!manifest[id]) manifest[id] = { ...allJobs.find((j) => j.id === id), files: [] };
    const m = manifest[id];
    if (m.done) continue;
    if (t.status === "failed") {
      m.done = "failed";
      m.error = t.error ?? t.message;
      console.log(id.padEnd(12), "FAILED", JSON.stringify(t).slice(0, 200));
      continue;
    }
    m.task_id = t.task_id;
    m.files = t.result.base64_images.map((b, i) => {
      const f = `${id}_${i}.png`;
      fs.writeFileSync(path.join(out, f), Buffer.from(b, "base64"));
      return f;
    });
    m.cost = t.result.balance_cost;
    m.done = "ok";
    m.size = pngSize(t.result.base64_images[0]).join("x");
    console.log(id.padEnd(12), m.files.join(" "), m.size, "cost", m.cost);
  }
  save();
  const pending = [...want].filter((id) => !manifest[id]?.done);
  if (pending.length === 0) break;
  process.stdout.write(`  waiting: ${pending.join(",")}\n`);
  await new Promise((r) => setTimeout(r, 8000));
}
const spent = Object.values(manifest).reduce((s, m) => s + (m.cost ?? 0), 0);
console.log("done; manifest total", spent.toFixed(2), "USD");

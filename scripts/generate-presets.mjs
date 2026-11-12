// Pre-solves every problem in the library (data/preset-list.json) once and saves them to public/presets/<id>.json
// (files in public/ are served as-is, so the browser loads them from /presets/<id>.json),
// so the demo loads instantly and costs nothing per visit.
// Usage: start `npm run dev` in one terminal, then run `npm run presets` in another.
// Optional: `npm run presets -- byparts ratio` regenerates only those presets.

import { readFile, writeFile, mkdir } from "node:fs/promises"; // file reading/writing

const BASE = process.env.BASE_URL ?? "http://localhost:3000"; // where the app is running
const list = JSON.parse(await readFile("data/preset-list.json", "utf8")); // every library problem
const missing = process.argv.includes("--missing"); // only solve problems that don't have a saved file yet
const wait = (ms) => new Promise((r) => setTimeout(r, ms)); // pause helper
const only = process.argv.slice(2).filter((a) => !a.startsWith("--")); // ids given on the command line, if any
await mkdir("public/presets", { recursive: true }); // make sure the output folder exists

for (const preset of list) {
  if (only.length && !only.includes(preset.id)) continue; // skip presets not asked for
  const started = Date.now();
  process.stdout.write(`Solving ${preset.id} ... `);
  if (missing && (await readFile(`public/presets/${preset.id}.json`, "utf8").then((t) => "task" in JSON.parse(t)).catch(() => false))) {
    console.log("already saved, skipped");
    continue;
  }
  let data;
  for (let tries = 0; tries < 3; tries++) {
    const res = await fetch(`${BASE}/api/presolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ problem: preset.prompt, task: preset.task ?? "" }),
    });
    data = await res.json().catch(() => ({ ok: false, error: "bad reply" }));
    if (res.status !== 429) break;
    process.stdout.write("(rate limit, waiting 60 s) ");
    await wait(60_000); // our own per-minute limit: wait it out and try again
  }
  if (!data.ok) {
    console.log(`FAILED: ${data.error}`); // keep going with the others
    await wait(15_000); // give a busy model a moment before the next one
    continue;
  }
  data.pkg.problem_latex = preset.latex; // use our hand-written LaTeX for the problem header
  if (preset.task) data.pkg.task = preset.task; // and our hand-written task line
  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  const checks = Object.entries(data.verification).map(([id, v]) => `${id}:${v}`).join(" ");
  console.log(`${data.pkg.steps.length} steps in ${seconds}s  [SymPy ${checks || "n/a"}]`);
  await writeFile(`public/presets/${preset.id}.json`, JSON.stringify(data.pkg, null, 2) + "\n"); // save it
  await wait(12_000); // stay well under 6 heavy requests per minute
}

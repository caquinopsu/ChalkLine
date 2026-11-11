// Pre-solves the 6 demo problems once and saves them to public/presets/<id>.json
// (files in public/ are served as-is, so the browser loads them from /presets/<id>.json),
// so the demo loads instantly and costs nothing per visit.
// Usage: start `npm run dev` in one terminal, then run `npm run presets` in another.
// Optional: `npm run presets -- byparts ratio` regenerates only those presets.

import { readFile, writeFile, mkdir } from "node:fs/promises"; // file reading/writing

const BASE = process.env.BASE_URL ?? "http://localhost:3000"; // where the app is running
const list = JSON.parse(await readFile("data/preset-list.json", "utf8")); // the 6 presets
const only = process.argv.slice(2); // ids given on the command line, if any
await mkdir("public/presets", { recursive: true }); // make sure the output folder exists

for (const preset of list) {
  if (only.length && !only.includes(preset.id)) continue; // skip presets not asked for
  const started = Date.now();
  process.stdout.write(`Solving ${preset.id} ... `);
  const res = await fetch(`${BASE}/api/presolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ problem: preset.prompt }),
  });
  const data = await res.json();
  if (!data.ok) {
    console.log(`FAILED: ${data.error}`); // keep going with the others
    continue;
  }
  data.pkg.problem_latex = preset.latex; // use our hand-written LaTeX for the problem header
  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  const checks = Object.entries(data.verification).map(([id, v]) => `${id}:${v}`).join(" ");
  console.log(`${data.pkg.steps.length} steps in ${seconds}s  [SymPy ${checks || "n/a"}]`);
  await writeFile(`public/presets/${preset.id}.json`, JSON.stringify(data.pkg, null, 2) + "\n"); // save it
}

// Sends sample student steps (one right, one wrong per preset) through /api/check-step and prints the verdicts.
// Usage: start `npm run dev`, then run `npm run test:steps` in another terminal. Uses about 14 Gemini requests.

import { readFile } from "node:fs/promises";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

// For each preset: how many reference lines are already on the board (`at`), then a right and a wrong line.
const CASES = [
  { id: "lhopital", at: 0, good: "\\lim_{x\\to0}\\frac{e^x-1}{2x}", bad: "\\lim_{x\\to0}\\frac{e^x-1}{x}" },
  { id: "chain", at: 0, good: "3\\left[\\ln(x^2+1)\\right]^2\\cdot\\frac{2x}{x^2+1}", bad: "3\\left[\\ln(x^2+1)\\right]^2" },
  { id: "usub", at: 0, good: "\\frac{1}{2}e^{x^2}+C", bad: "e^{x^2}+C" },
  { id: "byparts", at: 2, good: "\\frac{x^2}{2}\\ln x-\\frac{1}{2}\\int x\\,dx", bad: "\\frac{x^2}{2}\\ln x-\\int x\\,dx" },
  { id: "partial", at: 0, good: "\\int\\frac{3}{x-2}+\\frac{2}{x+1}\\,dx", bad: "\\int\\frac{3}{x-2}-\\frac{2}{x+1}\\,dx" },
  { id: "ratio", at: 0, good: "a_n=\\frac{n^2}{2^n}", bad: "a_n=\\frac{n^2}{n^2}" },
  // Trickier ones: a missing + C must be rejected; skipping straight to the answer must be accepted.
  { id: "usub", at: 0, bad: "\\frac{1}{2}e^{x^2}" },
  { id: "byparts", at: 1, good: "\\frac{x^2}{2}\\ln x-\\frac{x^2}{4}+C" },
];

let passed = 0;
let total = 0;
for (const c of CASES) {
  const pkg = JSON.parse(await readFile(`public/presets/${c.id}.json`, "utf8"));
  const board = pkg.steps.slice(0, c.at).map((s) => ({ latex: s.plain_latex, sympy: s.sympy }));
  for (const [kind, latex] of [["good", c.good], ["bad", c.bad]].filter(([, l]) => l)) {
    const started = Date.now();
    const res = await fetch(`${BASE}/api/check-step`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pkg, expectedIndex: c.at, board, studentLatex: latex, attempt: 1 }),
    });
    const data = await res.json();
    total++;
    if (!data.ok) {
      console.log(`${c.id.padEnd(9)} ${kind.padEnd(4)} ERROR ${data.error}`);
      continue;
    }
    const r = data.result;
    const valid = r.status === "correct" || r.status === "correct_alternate";
    const ok = kind === "good" ? valid : !valid; // good lines should pass, bad lines should fail
    if (ok) passed++;
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    console.log(
      `${ok ? "PASS" : "FAIL"} ${c.id.padEnd(9)} ${kind.padEnd(4)} ${r.status.padEnd(17)} sympy:${r.sympy.padEnd(9)} ${secs}s  "${r.display_feedback}"`,
    );
  }
}
console.log(`\n${passed}/${total} verdicts as expected`);

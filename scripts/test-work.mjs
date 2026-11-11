// Sends whole sample solutions (some right, some with a planted mistake) through /api/check-work
// and checks that the first slip lands on the right line.
// Usage: start `npm run dev`, then run `npm run test:work` in another terminal. Uses about 9 Gemini requests.

import { readFile } from "node:fs/promises";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";

// slip = 0-based index of the line that should be flagged first, or null if the solution is right.
const CASES = [
  {
    id: "byparts", name: "correct", slip: null,
    lines: ["u=\\ln x,\\ dv=x\\,dx", "\\frac{x^2}{2}\\ln x-\\int\\frac{x^2}{2}\\cdot\\frac{1}{x}\\,dx", "\\frac{x^2}{2}\\ln x-\\frac{1}{2}\\int x\\,dx", "\\frac{x^2}{2}\\ln x-\\frac{x^2}{4}+C"],
  },
  {
    id: "byparts", name: "dropped 1/2 (frame H)", slip: 2,
    lines: ["u=\\ln x,\\ dv=x\\,dx", "\\frac{x^2}{2}\\ln x-\\int\\frac{x^2}{2}\\cdot\\frac{1}{x}\\,dx", "\\frac{x^2}{2}\\ln x-\\int x\\,dx", "\\frac{x^2}{2}\\ln x-\\frac{x^2}{2}+C"],
  },
  {
    id: "usub", name: "missing + C", slip: 2,
    lines: ["u=x^2,\\ du=2x\\,dx", "\\frac{1}{2}\\int e^u\\,du", "\\frac{1}{2}e^{x^2}"],
  },
  {
    id: "usub", name: "lost the 1/2", slip: 1,
    lines: ["u=x^2,\\ du=2x\\,dx", "\\int e^u\\,du", "e^{x^2}+C"],
  },
  {
    id: "chain", name: "correct, one line", slip: null,
    lines: ["3\\ln^2(x^2+1)\\cdot\\frac{2x}{x^2+1}", "\\frac{6x\\ln^2(x^2+1)}{x^2+1}"],
  },
  {
    id: "chain", name: "forgot inner derivative", slip: 0,
    lines: ["3\\ln^2(x^2+1)\\cdot\\frac{1}{x^2+1}", "\\frac{3\\ln^2(x^2+1)}{x^2+1}"],
  },
  {
    id: "partial", name: "wrong coefficient", slip: 0,
    lines: ["\\int\\frac{3}{x-2}+\\frac{1}{x+1}\\,dx", "3\\ln|x-2|+\\ln|x+1|+C"],
  },
  {
    id: "lhopital", name: "correct", slip: null,
    lines: ["\\lim_{x\\to0}\\frac{e^x-1}{2x}", "\\lim_{x\\to0}\\frac{e^x}{2}", "\\frac{1}{2}"],
  },
  {
    id: "ratio", name: "wrong limit", slip: 2,
    lines: ["a_n=\\frac{n^2}{2^n},\\ a_{n+1}=\\frac{(n+1)^2}{2^{n+1}}", "\\frac{a_{n+1}}{a_n}=\\frac{(n+1)^2}{2n^2}", "\\lim_{n\\to\\infty}\\frac{(n+1)^2}{2n^2}=1", "\\text{the test is inconclusive}"],
  },
];

let passed = 0;
for (const c of CASES) {
  const pkg = JSON.parse(await readFile(`public/presets/${c.id}.json`, "utf8"));
  const started = Date.now();
  const res = await fetch(`${BASE}/api/check-work`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pkg, lines: c.lines }),
  });
  const data = await res.json();
  const secs = ((Date.now() - started) / 1000).toFixed(1);
  if (!data.ok) {
    console.log(`ERROR ${c.id} ${c.name}: ${data.error}`);
    continue;
  }
  const r = data.result;
  const ok = r.slipIndex === c.slip;
  if (ok) passed++;
  const got = r.slipIndex === null ? "no slip" : `slip at line ${r.slipIndex + 1}`;
  const want = c.slip === null ? "no slip" : `line ${c.slip + 1}`;
  console.log(`${ok ? "PASS" : "FAIL"} ${c.id.padEnd(9)} ${c.name.padEnd(26)} ${got.padEnd(16)} (want ${want}) sympy:${r.sympy} ${secs}s`);
  console.log(`     "${r.title}" ${r.explanation || r.praise}${r.fixLatex ? `  fix: ${r.fixLatex}` : ""}`);
}
console.log(`\n${passed}/${CASES.length} first-slip verdicts as expected`);
process.exit(passed === CASES.length ? 0 : 1);

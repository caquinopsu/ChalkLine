// Builds the reference solution package for a problem: Gemini writes it, SymPy double-checks it.
import "server-only";
import { askJson, SMART, ThinkingLevel } from "./gemini";
import { PRESOLVE_SYSTEM } from "./prompts";
import { PackageSchema, type SolutionPackage } from "./schemas";
import { sympyCompare, type Verdict } from "./sympy";

export type Verification = Record<string, Verdict>; // step id -> did SymPy confirm it?

// Asks Gemini for a package. `extra` adds a note (used when asking it to fix a previous attempt).
async function askModel(problem: string, extra?: string): Promise<SolutionPackage> {
  return askJson({
    models: SMART,
    system: PRESOLVE_SYSTEM,
    contents: `Problem: ${problem}${extra ? `\n\n${extra}` : ""}`,
    schema: PackageSchema, // the reply must match PackageSchema
    thinking: ThinkingLevel.LOW, // SymPy double-checks every line, so we can keep thinking short (faster)
    timeoutMs: 45_000, // per model; a slow model falls back to the next one
  });
}

// Uses SymPy to confirm every "chain" line really equals the problem (and the final answer too).
export async function verifyPackage(pkg: SolutionPackage, origin: string): Promise<Verification> {
  const checks: { id: string; pair: [string, string] }[] = []; // which comparisons to run
  if (pkg.problem_sympy) {
    for (const step of pkg.steps) {
      if (step.chain && step.sympy) checks.push({ id: step.id, pair: [pkg.problem_sympy, step.sympy] });
    }
    if (pkg.final_answer_sympy) checks.push({ id: "final", pair: [pkg.problem_sympy, pkg.final_answer_sympy] });
  }
  const verdicts = await sympyCompare(origin, checks.map((c) => c.pair), pkg.check_mode, pkg.variable);
  return Object.fromEntries(checks.map((c, i) => [c.id, verdicts[i]])); // e.g. { s2: true, s3: false }
}

// Full pre-solve: ask, verify, and if SymPy finds a wrong line, ask once more with the errors listed.
export async function presolve(problem: string, origin: string) {
  let pkg = await askModel(problem); // first attempt
  let verification = await verifyPackage(pkg, origin);
  const failed = Object.entries(verification).filter(([, v]) => v === false).map(([id]) => id); // lines SymPy rejected
  if (failed.length > 0) {
    const note =
      `A previous attempt had lines that our SymPy checker says are NOT equal to the problem: ${failed.join(", ")}. ` +
      `Re-check those lines (and their sympy fields) and return a corrected package.\nPrevious attempt:\n${JSON.stringify(pkg)}`;
    pkg = await askModel(problem, note); // second attempt
    verification = await verifyPackage(pkg, origin);
  }
  return { pkg, verification };
}

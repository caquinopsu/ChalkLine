// Builds the reference solution package for a problem: Claude Sonnet writes it, SymPy double-checks it.
import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod"; // turns our zod schema into a JSON format Claude must follow
import { claude, SONNET } from "./anthropic";
import { PRESOLVE_SYSTEM } from "./prompts";
import { PackageSchema, type SolutionPackage } from "./schemas";
import { sympyCompare, type Verdict } from "./sympy";

export type Verification = Record<string, Verdict>; // step id -> did SymPy confirm it?

// Asks Sonnet for a package. `extra` adds a note (used when asking it to fix a previous attempt).
async function askSonnet(problem: string, extra?: string): Promise<SolutionPackage> {
  const response = await claude().beta.messages.parse({
    model: SONNET,
    max_tokens: 16000, // room for thinking + a long JSON package
    betas: ["server-side-fallback-2026-07-01"], // enables the safety fallback below
    fallbacks: "default", // if a safety filter wrongly declines a math problem, retry on a fallback model
    output_config: { effort: "medium", format: betaZodOutputFormat(PackageSchema) }, // reply must match PackageSchema
    system: [{ type: "text", text: PRESOLVE_SYSTEM, cache_control: { type: "ephemeral" } }], // cached: same every time
    messages: [{ role: "user", content: `Problem: ${problem}${extra ? `\n\n${extra}` : ""}` }],
  }, { timeout: 100_000, maxRetries: 0 }); // normally ~15 s; give up well before the 120 s route limit
  if (response.stop_reason === "refusal") throw new Error("The tutor declined this problem."); // safety stop
  if (!response.parsed_output) throw new Error("The tutor's answer wasn't in the expected format."); // shouldn't happen
  return response.parsed_output; // the package as a typed object
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
  let pkg = await askSonnet(problem); // first attempt
  let verification = await verifyPackage(pkg, origin);
  const failed = Object.entries(verification).filter(([, v]) => v === false).map(([id]) => id); // lines SymPy rejected
  if (failed.length > 0) {
    const note =
      `A previous attempt had lines that our SymPy checker says are NOT equal to the problem: ${failed.join(", ")}. ` +
      `Re-check those lines (and their sympy fields) and return a corrected package.\nPrevious attempt:\n${JSON.stringify(pkg)}`;
    pkg = await askSonnet(problem, note); // second attempt
    verification = await verifyPackage(pkg, origin);
  }
  return { pkg, verification };
}

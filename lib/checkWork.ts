// Mode B, "Check my work": finds the first wrong line in a whole solution.
// Claude Sonnet marks the solution like a teacher, then SymPy double-checks the algebra line by line.
import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { claude, SONNET } from "./anthropic";
import { CHECK_WORK_SYSTEM } from "./prompts";
import { AiWorkCheckSchema, type AiWorkCheck, type SolutionPackage, type WorkResult } from "./schemas";
import { sympyCompare, type Verdict } from "./sympy";

export const MAX_WORK_LINES = 12; // longest solution we check (also the SymPy batch limit)

// Step 1: Sonnet's verdict on the whole solution.
async function askSonnet(pkg: SolutionPackage, lines: string[]): Promise<AiWorkCheck> {
  const numbered = lines.map((l, i) => `${i}. ${l}`).join("\n"); // 0-based, matching first_error_index
  const response = await claude().beta.messages.parse({
    model: SONNET, // not a live check, so we use the more careful model
    max_tokens: 10000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(AiWorkCheckSchema) },
    system: [
      { type: "text", text: CHECK_WORK_SYSTEM },
      // The package is the same for every check of this problem, so it's cached.
      { type: "text", text: `Reference solution package:\n${JSON.stringify(pkg)}`, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: `Problem: ${pkg.problem_latex}\n\nStudent's solution, one line each:\n${numbered}` }],
  }, { timeout: 60_000, maxRetries: 1 });
  if (response.stop_reason === "refusal") throw new Error("The tutor declined to check this.");
  if (!response.parsed_output) throw new Error("The checker's answer wasn't in the expected format.");
  return response.parsed_output;
}

// Does a line look like a setup line ("u = ln x", "dv = x dx") rather than a value?
const isSetupLine = (latex: string) => /^\s*d?[a-zA-Z]\s*=/.test(latex);

// Step 2: combine Sonnet's marking with SymPy's checks and find the first real slip.
export async function checkWork(pkg: SolutionPackage, rawLines: string[], origin: string): Promise<WorkResult> {
  const ai = await askSonnet(pkg, rawLines);
  const n = rawLines.length;
  // Line up the AI's lines with ours (if it returned a different count, fall back to the raw text).
  const aiLines = rawLines.map(
    (raw, i) => ai.lines[i] ?? { interpreted_latex: raw, student_sympy: null, matched_step_id: null, ok: true },
  );
  const aiFirst = ai.first_error_index !== null && ai.first_error_index >= 0 && ai.first_error_index < n ? ai.first_error_index : null;

  // For each line, decide what SymPy should compare it with, and whether a "not equal" answer can be trusted.
  type Check = { line: number; pair: [string, string]; mode: "value" | "antiderivative"; trustFalse: boolean };
  const checks: Check[] = [];
  aiLines.forEach((l, i) => {
    if (!l.student_sympy) return; // setup lines and words can't be compared
    const matched = pkg.steps.find((s) => s.id === l.matched_step_id);
    if (matched?.chain && pkg.problem_sympy) {
      checks.push({ line: i, pair: [pkg.problem_sympy, l.student_sympy], mode: pkg.check_mode, trustFalse: true });
    } else if (matched?.sympy) {
      checks.push({ line: i, pair: [matched.sympy, l.student_sympy], mode: "value", trustFalse: true });
    } else if (pkg.problem_sympy) {
      // Unmatched line: "equal to the problem" proves it's fine. "Not equal" only counts for the last line
      // (a final answer must equal the problem); a middle line written in u could legitimately differ.
      checks.push({ line: i, pair: [pkg.problem_sympy, l.student_sympy], mode: pkg.check_mode, trustFalse: i === n - 1 });
    }
  });
  const byLine = new Map<number, { equal: Verdict; trustFalse: boolean }>();
  // SymPy calls are grouped by mode, because one request uses one mode.
  for (const mode of ["value", "antiderivative"] as const) {
    const group = checks.filter((c) => c.mode === mode);
    const results = await sympyCompare(origin, group.map((c) => c.pair), mode, pkg.variable);
    group.forEach((c, k) => byLine.set(c.line, { equal: results[k], trustFalse: c.trustFalse }));
  }

  // Find the first slip. A line counts as wrong if the AI says so (unless SymPy proves its value is right,
  // and the mistake isn't one that keeps the value, like a missing + C), or if SymPy proves it changed.
  const valueKeeping = ai.error_kind === "notation" || ai.error_kind === "incomplete";
  let slip: number | null = null;
  let sympy: WorkResult["sympy"] = "unchecked";
  for (let i = 0; i < n; i++) {
    const s = byLine.get(i);
    const aiWrong = i === aiFirst || !aiLines[i].ok;
    const keepsValue = i === aiFirst ? valueKeeping : false;
    if (aiWrong && s?.equal === true && !keepsValue) {
      sympy = "overruled"; // the AI flagged it, but SymPy proves the algebra is fine
      continue;
    }
    if (aiWrong) { slip = i; break; }
    if (s?.equal === false && s.trustFalse) { slip = i; sympy = "overruled"; break; } // SymPy caught one the AI missed
  }
  if (sympy === "unchecked" && byLine.size > 0 && [...byLine.values()].some((v) => v.equal !== null)) sympy = "confirmed";

  // Explanation: the AI's own, when the slip is the line it flagged; otherwise a plain message.
  let title = ai.title, explanation = ai.explanation, fixLatex = ai.fix_latex, fixNote = ai.fix_note, errorLatex = ai.error_latex;
  let errorKind = ai.error_kind;
  if (slip !== null && slip !== aiFirst) {
    const matched = pkg.steps.find((s) => s.id === aiLines[slip!].matched_step_id);
    title = "The value changed here";
    explanation = "This line isn't equal to the line before it. Compare the two carefully, piece by piece.";
    fixLatex = matched?.plain_latex ?? null; // the reference version of this line, if we know which one it is
    fixNote = "compare with the line above";
    errorLatex = null;
    errorKind = "algebra";
  }

  // Fixed rule for indefinite integrals (same as Step practice): the final answer needs + C.
  const last = aiLines[n - 1]?.interpreted_latex ?? "";
  const hasConstant = /(^|[^a-zA-Z\\])[CK]([^a-zA-Z]|$)/.test(last);
  if (slip === null && pkg.check_mode === "antiderivative" && !last.includes("\\int") && !hasConstant && !isSetupLine(last)) {
    slip = n - 1;
    errorKind = "incomplete";
    title = "Don't forget the constant";
    explanation = "This is an indefinite integral, so the final answer is a whole family of functions: it needs $+\\,C$ at the end.";
    fixLatex = `${last} + C`;
    fixNote = "add + C";
    errorLatex = null;
  }
  if (slip === null) { title = ai.title; explanation = ""; fixLatex = null; fixNote = ""; errorLatex = null; errorKind = "none"; }

  // Where to continue from: just past the furthest reference step reached before the slip.
  const upTo = slip ?? n;
  let resumeIndex = 0;
  for (let i = 0; i < upTo; i++) {
    const idx = pkg.steps.findIndex((s) => s.id === aiLines[i].matched_step_id);
    if (idx + 1 > resumeIndex) resumeIndex = idx + 1;
  }
  const complete = slip === null && ai.complete;
  if (complete) resumeIndex = pkg.steps.length;

  return {
    lines: aiLines.map((l, i) => ({
      latex: l.interpreted_latex,
      sympy: l.student_sympy,
      verdict: slip === null || i < slip ? "correct" : i === slip ? "slip" : "after",
    })),
    slipIndex: slip,
    errorKind,
    errorLatex,
    title,
    explanation,
    fixLatex,
    fixNote,
    complete,
    praise: slip === null ? ai.praise : "",
    resumeIndex,
    sympy,
  };
}

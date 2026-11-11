// Checks one student line: Gemini (the fast model) judges it, then SymPy verifies the algebra and can overrule.
import "server-only";
import { askJson, FAST, ThinkingLevel } from "./gemini";
import { CHECK_SYSTEM } from "./prompts";
import { AiCheckSchema, type AiCheck, type CheckRequest, type CheckResult } from "./schemas";
import { sympyCompare } from "./sympy";

// Step 1: ask the fast model for its verdict.
async function askModel(req: CheckRequest): Promise<AiCheck> {
  const { pkg, expectedIndex, board, studentLatex, attempt } = req;
  const expected = pkg.steps[expectedIndex]; // the reference line we expect next (may be undefined at the end)
  const boardText = board.length ? board.map((l, i) => `${i + 1}. ${l.latex}`).join("\n") : "(nothing yet)";
  return askJson({
    models: FAST,
    // Instructions + the package. They stay the same for every step of a problem, which lets Gemini
    // reuse its work automatically ("implicit caching"), making repeat checks cheaper.
    system: `${CHECK_SYSTEM}\n\nReference solution package:\n${JSON.stringify(pkg)}`,
    contents:
      `Lines on the board so far:\n${boardText}\n\n` +
      `Expected next reference step: ${expected ? `${expected.id}: ${expected.plain_latex}` : "(the solution is complete)"}\n` +
      `Attempt number at this step: ${attempt}\n\n` +
      `Student's new line (LaTeX):\n${studentLatex}`,
    schema: AiCheckSchema,
    thinking: ThinkingLevel.LOW, // a little thinking keeps it fast
    timeoutMs: 15_000, // per model; a check normally takes a few seconds
    maxOutputTokens: 6000,
  });
}

// Step 2: combine the AI's verdict with SymPy's. SymPy wins on whether the algebra is right.
export async function checkStep(req: CheckRequest, origin: string): Promise<CheckResult> {
  const { pkg, expectedIndex } = req;
  const ai = await askModel(req);
  const result: CheckResult = { ...ai, sympy: "unchecked", finished: false }; // start from the AI's verdict
  const matched = pkg.steps.find((s) => s.id === ai.matched_step_id); // the reference step it matched, if any
  const expected = pkg.steps[expectedIndex];

  // Decide what to compare the student's line against.
  let target: string | null = null; // SymPy expression it should equal
  let mode: "value" | "antiderivative" = "value";
  if (ai.student_sympy) {
    const isChainLine = matched ? matched.chain : (expected?.chain ?? false); // should this line equal the problem?
    if (isChainLine && pkg.problem_sympy) {
      target = pkg.problem_sympy; // any valid line must equal the original problem's value
      mode = pkg.check_mode; // "antiderivative" allows a different + C
    } else if (matched?.sympy) {
      target = matched.sympy; // e.g. a ratio-test line must equal the reference ratio
    } else if (pkg.problem_sympy && (ai.is_final_answer || ai.status === "incorrect")) {
      // A claimed final answer, or a line the AI rejected, can still be tested against the problem itself.
      // (Not used for other lines: a valid line written in a new variable, like u, wouldn't equal the problem.)
      target = pkg.problem_sympy;
      mode = pkg.check_mode;
    }
  }

  if (target && ai.student_sympy) {
    const [equal] = await sympyCompare(origin, [[target, ai.student_sympy]], mode, pkg.variable);
    const aiSaysValid = ai.status === "correct" || ai.status === "correct_alternate";
    // Mistakes that don't change the value (missing + C, missing dx) are real even when SymPy says "equal".
    const valueKeepingMistake = ai.error_kind === "notation" || ai.error_kind === "incomplete";
    if (equal === true && ai.status === "incorrect" && !valueKeepingMistake) {
      // The AI thought the line was wrong, but SymPy proves the value is unchanged: accept the line.
      Object.assign(result, {
        status: matched ? "correct" : "correct_alternate",
        error_kind: "none",
        error_latex: null,
        hint: null,
        display_feedback: "That checks out: the algebra keeps the value the same.",
        spoken_feedback: "That checks out.",
        sympy: "overruled",
      });
    } else if (equal === false && aiSaysValid) {
      // The AI accepted it, but SymPy shows the value changed: flag it, with the reference hint as a nudge.
      Object.assign(result, {
        status: "incorrect",
        error_kind: "algebra",
        is_final_answer: false,
        display_feedback: "Close, but the value changed somewhere on this line. Compare it with the line above.",
        spoken_feedback: "Close, but something changed the value. Check this line again.",
        hint: expected?.hint ?? null,
        sympy: "overruled",
      });
    } else if (equal !== null) {
      result.sympy = "confirmed"; // SymPy agrees with the AI
    }
  }

  // Fixed rule for indefinite integrals: once no integral sign is left, the line needs + C.
  // (Skipped for setup lines with "=", like "u = x^2, du = 2x dx".)
  const line = result.interpreted_latex;
  const integralLeft = line.includes("\\int");
  const hasConstant = /(^|[^a-zA-Z\\])[CK]([^a-zA-Z]|$)/.test(line); // a standalone C or K
  const stillValid = result.status === "correct" || result.status === "correct_alternate";
  if (pkg.check_mode === "antiderivative" && stillValid && !integralLeft && !hasConstant && !line.includes("=")) {
    Object.assign(result, {
      status: "incorrect",
      error_kind: "incomplete",
      is_final_answer: false,
      error_latex: null,
      display_feedback: "Almost! This is an indefinite integral, so the answer needs one more piece at the end.",
      spoken_feedback: "Almost. An indefinite integral needs one more piece at the end.",
      hint: "Every antiderivative family has a constant.",
    });
  }

  // The problem is done when a valid line is the final answer or reaches the last reference step.
  const valid = result.status === "correct" || result.status === "correct_alternate";
  const reachedLast = matched?.id === pkg.steps[pkg.steps.length - 1]?.id;
  result.finished = valid && (result.is_final_answer || reachedLast);
  return result;
}

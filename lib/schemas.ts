// Data shapes ("schemas") shared by the server routes and the UI.
// zod describes the shape once; we use it to (1) tell Claude exactly what JSON to return and
// (2) get TypeScript types for free via z.infer<...>.

import { z } from "zod"; // the schema library

// A colored piece of an expression (e.g. "u" or "dv"), kept stable across steps for animations later.
export const PartSchema = z.object({
  id: z.string(), // stable ID, e.g. "u", "dv", "half"
  latex: z.string(), // the piece itself, e.g. "\\ln x"
  role: z.enum(["a", "b", "c"]).nullable(), // color role: a = blue, b = gold, c = teal, null = chalk
});

// One line of the reference solution.
export const StepSchema = z.object({
  id: z.string(), // "s1", "s2", ...
  latex: z.string(), // the whole line in LaTeX, with \htmlClass{role-a}{...} around colored parts
  plain_latex: z.string(), // the same line with no color markup
  sympy: z.string().nullable(), // the line in SymPy syntax, or null if it isn't a single expression
  chain: z.boolean(), // true if this line equals the original problem's value (so SymPy can verify it)
  rule: z.string(), // short rule label, e.g. "Integration by parts"
  summary: z.string(), // one sentence for the Focus card
  why: z.string(), // 1-3 sentence explanation (may contain $inline math$)
  hint: z.string(), // a nudge that doesn't give the answer away
  side_work: z
    .object({
      title: z.string(), // e.g. "Find du and v"
      lines: z.array(z.string()), // LaTeX lines of the sub-calculation
    })
    .nullable(),
  common_mistakes: z.array(z.object({ mistake: z.string(), hint: z.string() })),
  parts: z.array(PartSchema),
});

// The reference solution package: built once per problem, reused by every mode.
export const PackageSchema = z.object({
  problem_latex: z.string(), // the problem, typeset
  problem_sympy: z.string().nullable(), // the problem's value in SymPy (null for yes/no questions)
  topic: z.string(), // e.g. "Integration"
  techniques: z.array(z.string()), // e.g. ["integration by parts"]
  check_mode: z.enum(["value", "antiderivative"]), // how SymPy compares lines (antiderivative allows + C)
  variable: z.string(), // the main variable, e.g. "x" or "n"
  steps: z.array(StepSchema), // the main solution path
  alternates: z.array(z.object({ label: z.string(), summary: z.string() })), // other valid routes, briefly
  final_answer_latex: z.string(),
  final_answer_sympy: z.string().nullable(),
});

// What Claude Haiku returns when it checks a student's step.
export const AiCheckSchema = z.object({
  interpreted_latex: z.string(), // clean LaTeX of what the student wrote
  student_sympy: z.string().nullable(), // the student's line in SymPy syntax (null if not an expression)
  status: z.enum(["correct", "correct_alternate", "incorrect", "unclear_input"]),
  error_kind: z.enum(["none", "algebra", "reasoning", "notation", "incomplete"]), // what kind of mistake, if any
  matched_step_id: z.string().nullable(), // which reference step this line reaches, if any
  is_final_answer: z.boolean(), // true if this line is the complete final answer
  error_latex: z.string().nullable(), // the exact wrong piece of interpreted_latex, to ring in pink
  display_feedback: z.string(), // 1-2 sentences shown in the tray
  spoken_feedback: z.string(), // under ~15 words (for voice in Phase 3)
  hint: z.string().nullable(), // a nudge for wrong steps
});

// TypeScript types generated from the schemas above.
export type Part = z.infer<typeof PartSchema>;
export type Step = z.infer<typeof StepSchema>;
export type SolutionPackage = z.infer<typeof PackageSchema>;
export type AiCheck = z.infer<typeof AiCheckSchema>;

// What /api/check-step sends back to the browser: the AI's verdict plus what SymPy concluded.
export type CheckResult = AiCheck & {
  sympy: "confirmed" | "overruled" | "unchecked"; // did SymPy agree, overrule the AI, or not apply?
  finished: boolean; // true when this step completes the problem
};

// What the browser sends to /api/check-step.
export type CheckRequest = {
  pkg: SolutionPackage; // the reference package
  expectedIndex: number; // index of the reference step we expect next
  board: { latex: string; sympy: string | null }[]; // lines already accepted on the board
  studentLatex: string; // what the student just typed
  attempt: number; // 1 for the first try at this step, 2 for the second, ...
};

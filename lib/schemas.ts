// Data shapes ("schemas") shared by the server routes and the UI.
// zod describes the shape once; we use it to (1) tell the AI exactly what JSON to return and
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

// What the AI returns when it checks a student's step.
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

// ---------- Phase 2: photos, Check my work, similar problems ----------

// What the AI returns after reading a photo (of a problem, of handwritten work, or both).
export const PhotoReadSchema = z.object({
  readable: z.boolean(), // false if there's no math in the photo or it can't be read
  problem_latex: z.string().nullable(), // the problem statement, typeset (null if the photo has none)
  lines: z.array(
    z.object({
      latex: z.string(), // one line of the student's work, exactly as written (mistakes kept)
      unclear: z.boolean(), // true if some of it was hard to read
    }),
  ),
  note: z.string(), // a short message for the student (what was unclear, or why it couldn't be read)
});
export type PhotoRead = z.infer<typeof PhotoReadSchema>;

// What the AI returns when it checks a whole written solution (Mode B).
export const AiWorkCheckSchema = z.object({
  lines: z.array(
    z.object({
      interpreted_latex: z.string(), // clean LaTeX of the line (their math unchanged)
      student_sympy: z.string().nullable(), // the line in SymPy syntax, exactly as written
      matched_step_id: z.string().nullable(), // furthest reference step this line reaches
      ok: z.boolean(), // is this line itself correct (given the line before it)?
    }),
  ),
  first_error_index: z.number().int().nullable(), // 0-based index of the first wrong line, or null
  error_kind: z.enum(["none", "algebra", "reasoning", "notation", "incomplete"]),
  error_latex: z.string().nullable(), // the wrong piece of that line, to ring in pink
  title: z.string(), // 3-6 words, e.g. "A constant slipped away"
  explanation: z.string(), // 1-2 sentences, may contain $math$
  fix_latex: z.string().nullable(), // the corrected version of the wrong line
  fix_note: z.string(), // 2-5 words for the margin, e.g. "keep the 1/2"
  complete: z.boolean(), // does the solution reach a complete final answer?
  praise: z.string(), // when everything is right: what they did well
});
export type AiWorkCheck = z.infer<typeof AiWorkCheckSchema>;

// One checked line, as the board draws it.
export type WorkLine = {
  latex: string; // the line (clean LaTeX)
  sympy: string | null;
  verdict: "correct" | "slip" | "after"; // before the slip, the slip itself, or after it (redo)
};

// What /api/check-work sends back.
export type WorkResult = {
  lines: WorkLine[];
  slipIndex: number | null; // which line is the first slip (null = no mistakes)
  errorKind: AiWorkCheck["error_kind"];
  errorLatex: string | null;
  title: string;
  explanation: string;
  fixLatex: string | null;
  fixNote: string;
  complete: boolean; // reaches a correct final answer with no slips
  praise: string;
  resumeIndex: number; // reference step to continue from (for "Redo" / "Show me the rest")
  sympy: "confirmed" | "overruled" | "unchecked";
};

// A solution the student is about to submit in Check my work (typed, or read from a photo).
export type Submission = {
  source: "photo" | "typed";
  thumb: string | null; // the photo (as a data URL) for the thumbnail
  lines: string[]; // one LaTeX string per line
  unclear: boolean[]; // per line: was the handwriting hard to read?
  note: string; // what the photo reader wanted to tell the student
};

// What the AI returns when asked for a similar problem.
export const SimilarSchema = z.object({
  problem_latex: z.string(), // the new problem, typeset
  problem_text: z.string(), // the same problem as an instruction, e.g. "Evaluate \\int x e^{2x}\\,dx"
});

// What the browser sends to /api/check-step.
export type CheckRequest = {
  pkg: SolutionPackage; // the reference package
  expectedIndex: number; // index of the reference step we expect next
  board: { latex: string; sympy: string | null }[]; // lines already accepted on the board
  studentLatex: string; // what the student just typed
  attempt: number; // 1 for the first try at this step, 2 for the second, ...
};

// ---------- Phase 3: Think-aloud voice ----------

// What the AI returns after listening to one push-to-talk clip.
export const HeardSchema = z.object({
  transcript: z.string(), // the words, written out as heard ("x squared over two log x")
  intent: z.enum(["step", "why", "choose", "show_fix", "hint", "other"]), // what the student wants
  latex: z.string().nullable(), // the spoken math as KaTeX LaTeX (for a step, or the problem itself)
  alternatives: z.array(z.string()), // other readings of the math when it's ambiguous (0-2), as LaTeX
  choice: z.number().int().nullable(), // for "choose": 1 or 2 ("the first one" -> 1)
  question: z.string().nullable(), // for "why": the question in plain words
});
export type Heard = z.infer<typeof HeardSchema>;

// What the browser sends to /api/speech-to-math.
export type SpeechRequest = {
  audio: string; // the clip, base64
  mimeType: string; // "audio/wav" (we convert in the browser)
  kind: "step" | "problem"; // solving a step, or saying the problem on the start screen
  problemLatex?: string; // the problem being solved (helps the AI read the math)
  board?: string[]; // the last lines on the board (more context)
  choices?: number; // how many "Did you mean…?" options are showing (0 = none)
  wrongStep?: boolean; // is a rejected step waiting to be fixed? ("show me the fix" makes sense)
};

// POST /api/why  { pkg, stepIndex, question }  ->  { ok, answer }
// Answers a follow-up "why?" question about one step (the basic "why" text comes free with the package).
import { rateLimit } from "@/lib/rateLimit"; // per-visitor speed bump (Phase 5)
import { askText, SMART, ThinkingLevel } from "@/lib/gemini";
import { WHY_SYSTEM } from "@/lib/prompts";
import { badRequest, errorResponse } from "@/lib/routeHelpers";
import { PackageInput } from "@/lib/schemas";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const limited = rateLimit(req, "light"); // too many requests from this visitor?
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    const pkg = PackageInput.safeParse(body.pkg);
    if (!pkg.success) return badRequest("Missing or invalid solution package.");
    const step = pkg.data.steps[body.stepIndex]; // the line the question is about
    if (!step) return badRequest("Unknown step.");
    const question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : "";
    if (!question) return badRequest("Ask a question first.");

    const answer = await askText({
      models: SMART,
      system: WHY_SYSTEM,
      thinking: ThinkingLevel.LOW, // short answers don't need deep thinking
      timeoutMs: 15_000, // per model; short answers
      contents:
        `Problem: ${pkg.data.problem_latex}\n` +
        `Line ${body.stepIndex + 1}: ${step.plain_latex}\nRule: ${step.rule}\nExplanation shown: ${step.why}\n\n` +
        `Student's question: ${question}`,
    });
    return Response.json({ ok: true, answer: answer || "Sorry, I couldn't come up with an answer. Try rephrasing." });
  } catch (err) {
    return errorResponse(err);
  }
}

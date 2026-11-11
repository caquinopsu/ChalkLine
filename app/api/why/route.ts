// POST /api/why  { pkg, stepIndex, question }  ->  { ok, answer }
// Answers a follow-up "why?" question about one step (the basic "why" text comes free with the package).
import { claude, SONNET } from "@/lib/anthropic";
import { WHY_SYSTEM } from "@/lib/prompts";
import { badRequest, errorResponse } from "@/lib/routeHelpers";
import { PackageSchema } from "@/lib/schemas";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const pkg = PackageSchema.safeParse(body.pkg);
    if (!pkg.success) return badRequest("Missing or invalid solution package.");
    const step = pkg.data.steps[body.stepIndex]; // the line the question is about
    if (!step) return badRequest("Unknown step.");
    const question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : "";
    if (!question) return badRequest("Ask a question first.");

    const response = await claude().beta.messages.create({
      model: SONNET,
      max_tokens: 2000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // retry on a fallback model if a safety filter wrongly declines
      output_config: { effort: "low" }, // short answers don't need deep thinking
      system: WHY_SYSTEM,
      messages: [
        {
          role: "user",
          content:
            `Problem: ${pkg.data.problem_latex}\n` +
            `Line ${body.stepIndex + 1}: ${step.plain_latex}\nRule: ${step.rule}\nExplanation shown: ${step.why}\n\n` +
            `Student's question: ${question}`,
        },
      ],
    }, { timeout: 30_000, maxRetries: 1 }); // short answers; don't hang
    // Collect the text parts of the reply (skipping thinking blocks).
    const answer = response.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
    return Response.json({ ok: true, answer: answer || "Sorry, I couldn't come up with an answer. Try rephrasing." });
  } catch (err) {
    return errorResponse(err);
  }
}

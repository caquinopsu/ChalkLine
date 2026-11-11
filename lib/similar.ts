// "Give me a similar problem": Sonnet writes a new problem with the same technique, then we pre-solve it
// and only hand it over if SymPy confirms a clean, correct solution.
import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { claude, SONNET } from "./anthropic";
import { presolve } from "./presolve";
import { SIMILAR_SYSTEM } from "./prompts";
import { SimilarSchema, type SolutionPackage } from "./schemas";

async function askForProblem(pkg: SolutionPackage, avoid: string[]) {
  const response = await claude().beta.messages.parse({
    model: SONNET,
    max_tokens: 3000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: betaZodOutputFormat(SimilarSchema) },
    system: [{ type: "text", text: SIMILAR_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content:
          `Original problem: ${pkg.problem_latex}\nTopic: ${pkg.topic}\nTechniques: ${pkg.techniques.join(", ")}` +
          (avoid.length ? `\nDon't reuse these problems: ${avoid.join(" ; ")}` : ""),
      },
    ],
  }, { timeout: 30_000, maxRetries: 1 });
  if (!response.parsed_output) throw new Error("Couldn't write a new problem.");
  return response.parsed_output;
}

// Returns a ready-to-use solution package for a new, verified problem (tries twice).
export async function similarProblem(pkg: SolutionPackage, origin: string): Promise<SolutionPackage> {
  const tried: string[] = [pkg.problem_latex];
  for (let attempt = 0; attempt < 2; attempt++) {
    const next = await askForProblem(pkg, tried);
    tried.push(next.problem_latex);
    const { pkg: solved, verification } = await presolve(next.problem_text, origin);
    solved.problem_latex = next.problem_latex; // show the problem the way it was written
    // "Clean" = SymPy rejected no line (null means "couldn't decide", which is fine for series lines).
    const clean = Object.values(verification).every((v) => v !== false);
    if (clean) return solved;
  }
  // Never show a problem whose solution SymPy doubts.
  throw new Error("Couldn't find a new problem with a clean solution. Please try again.");
}

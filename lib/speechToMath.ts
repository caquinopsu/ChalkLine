// Listens to one push-to-talk clip with Gemini: what was said, the math in it, and what the student wants.
import "server-only";
import { askJson, FAST, ThinkingLevel } from "./gemini";
import { SPEECH_SYSTEM } from "./prompts";
import { HeardSchema, type Heard, type SpeechRequest } from "./schemas";

export async function speechToMath(req: SpeechRequest): Promise<Heard> {
  // The context sent along with the audio, so "x squared over two" can be read in light of the problem.
  const context =
    req.kind === "problem"
      ? "Context: the student is saying the PROBLEM they want to solve (not a step). Use intent \"step\" and put the problem in latex, without words like \"evaluate\"."
      : [
          `Problem: ${req.problemLatex ?? "(unknown)"}`,
          req.board?.length ? `Last lines on the board:\n${req.board.map((l) => `  ${l}`).join("\n")}` : "Nothing on the board yet.",
          req.choices ? `On screen: ${req.choices} "Did you mean…?" options, numbered 1 and 2.` : "No options are showing.",
          req.wrongStep ? "Their last step was marked wrong and is waiting to be fixed." : "",
        ]
          .filter(Boolean)
          .join("\n");

  const heard = await askJson({
    models: FAST, // the fast model: this needs to come back in about 2 seconds
    system: SPEECH_SYSTEM,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: req.mimeType, data: req.audio } }, // the clip itself
          { text: context },
        ],
      },
    ],
    schema: HeardSchema,
    thinking: ThinkingLevel.LOW, // transcribing needs speed, not deep thought (LOW is proven on these models)
    timeoutMs: 12_000, // per model
    maxOutputTokens: 2000,
  });

  // Tidy up: drop alternatives that repeat the main reading, keep at most 2.
  const alternatives = heard.alternatives.filter((a) => a.trim() && a !== heard.latex).slice(0, 2);
  return { ...heard, alternatives, latex: heard.latex?.trim() || null };
}

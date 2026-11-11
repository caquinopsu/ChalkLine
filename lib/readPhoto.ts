// Reads a photo (a problem, handwritten work, or both) with Claude Sonnet's vision.
import "server-only";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { claude, SONNET } from "./anthropic";
import { READ_PHOTO_SYSTEM } from "./prompts";
import { PhotoReadSchema, type PhotoRead } from "./schemas";

export type ImageType = "image/jpeg" | "image/png" | "image/webp" | "image/gif"; // what Claude accepts

// `knownProblem` is set in Check my work, where we already know the problem and only want the work.
export async function readPhoto(base64: string, mediaType: ImageType, knownProblem: string | null): Promise<PhotoRead> {
  const ask = knownProblem
    ? `The problem is already known: ${knownProblem}\nTranscribe the student's work in this photo (leave the problem statement itself out of lines).`
    : "Read the problem in this photo, and any student work under it.";
  const response = await claude().beta.messages.parse({
    model: SONNET, // Sonnet does vision
    max_tokens: 6000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default", // retry on a fallback model if a safety filter wrongly declines
    output_config: { effort: "low", format: betaZodOutputFormat(PhotoReadSchema) }, // transcribing needs little thinking
    system: [{ type: "text", text: READ_PHOTO_SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } }, // the photo itself
          { type: "text", text: ask },
        ],
      },
    ],
  }, { timeout: 60_000, maxRetries: 1 });
  if (response.stop_reason === "refusal") throw new Error("The tutor couldn't read this photo.");
  if (!response.parsed_output) throw new Error("The photo reader's answer wasn't in the expected format.");
  return response.parsed_output;
}

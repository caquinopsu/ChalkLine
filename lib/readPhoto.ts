// Reads a photo (a problem, handwritten work, or both) with Gemini's vision.
import "server-only";
import { askJson, SMART, ThinkingLevel } from "./gemini";
import { READ_PHOTO_SYSTEM } from "./prompts";
import { PhotoReadSchema, type PhotoRead } from "./schemas";

export type ImageType = "image/jpeg" | "image/png" | "image/webp" | "image/gif"; // image types we accept

// `knownProblem` is set in Check my work, where we already know the problem and only want the work.
export async function readPhoto(base64: string, mediaType: ImageType, knownProblem: string | null): Promise<PhotoRead> {
  const ask = knownProblem
    ? `The problem is already known: ${knownProblem}\nTranscribe the student's work in this photo (leave the problem statement itself out of lines).`
    : "Read the problem in this photo, and any student work under it.";
  return askJson({
    models: SMART, // the smart model reads handwriting best
    system: READ_PHOTO_SYSTEM,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: mediaType, data: base64 } }, // the photo itself
          { text: ask },
        ],
      },
    ],
    schema: PhotoReadSchema,
    thinking: ThinkingLevel.LOW, // transcribing needs little thinking
    timeoutMs: 25_000, // per model
  });
}

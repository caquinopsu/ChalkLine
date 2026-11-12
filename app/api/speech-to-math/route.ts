// POST /api/speech-to-math  (SpeechRequest)  ->  { ok, heard: Heard }
// Turns one spoken clip into text + LaTeX + what the student wants. The audio is never stored.
import { rateLimit } from "@/lib/rateLimit"; // per-visitor speed bump (Phase 5)
import { speechToMath } from "@/lib/speechToMath";
import { badRequest, errorResponse } from "@/lib/routeHelpers";
import type { SpeechRequest } from "@/lib/schemas";

export const maxDuration = 60;

// Audio types we accept. The browser converts every clip to WAV, the others are a backup.
const TYPES = ["audio/wav", "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/aac", "audio/flac"];

export async function POST(req: Request) {
  try {
    const limited = rateLimit(req, "light"); // too many requests from this visitor?
    if (limited) return limited;
    const text = await req.text(); // raw body
    if (text.length > 3_000_000) return badRequest("That clip is too long. Keep it under 15 seconds."); // Vercel's limit is 4.5 MB
    const body = JSON.parse(text) as Partial<SpeechRequest>;
    const audio = typeof body.audio === "string" ? body.audio : "";
    if (!audio || !/^[A-Za-z0-9+/=]+$/.test(audio)) return badRequest("No audio was recorded. Try again.");
    const mimeType = typeof body.mimeType === "string" ? body.mimeType.split(";")[0].trim() : ""; // drop ";codecs=opus"
    if (!TYPES.includes(mimeType)) return badRequest("That audio format isn't supported.");
    const request: SpeechRequest = {
      audio,
      mimeType,
      kind: body.kind === "problem" ? "problem" : "step",
      problemLatex: typeof body.problemLatex === "string" ? body.problemLatex.slice(0, 500) : undefined,
      board: Array.isArray(body.board) ? body.board.filter((l) => typeof l === "string").slice(-3).map((l) => l.slice(0, 400)) : [],
      choices: Number.isInteger(body.choices) ? Math.min(2, Math.max(0, body.choices!)) : 0,
      wrongStep: body.wrongStep === true,
    };
    const heard = await speechToMath(request);
    return Response.json({ ok: true, heard });
  } catch (err) {
    return errorResponse(err);
  }
}

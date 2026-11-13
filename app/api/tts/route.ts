// POST /api/tts  { text }  ->  MP3 audio (Cartesia), or 501 when Cartesia isn't set up.
// Optional: only used when CARTESIA_API_KEY is set. The browser falls back to its own voice
// on ANY error from this route, so the app works the same without it.
import { rateLimit } from "@/lib/rateLimit"; // per-visitor speed bump (Phase 5)
import { badRequest } from "@/lib/routeHelpers";

export const maxDuration = 30;

// A calm, clear premade Cartesia voice. Override with CARTESIA_VOICE_ID if you prefer another
// (browse voices at play.cartesia.ai and copy the voice's ID).
const DEFAULT_VOICE = "db6b0ed5-d5d3-463d-ae85-518a07d3c2b4";

export async function POST(req: Request) {
  const key = process.env.CARTESIA_API_KEY; // secret: only ever read on the server
  if (!key) return Response.json({ ok: false, off: true }, { status: 501 }); // switched off: the browser voice is used
  try {
    const limited = rateLimit(req, "light"); // too many requests from this visitor?
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return badRequest("Nothing to say.");
    if (text.length > 600) return badRequest("That's too long to read aloud."); // keeps free-plan credits low

    const res = await fetch("https://api.cartesia.ai/tts/bytes", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Cartesia-Version": "2026-08-14", // the API version these request fields come from
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model_id: "sonic-3.6", // Cartesia's current fast voice model
        transcript: text,
        voice: process.env.CARTESIA_VOICE_ID || DEFAULT_VOICE,
        language: "en",
        output_format: { container: "mp3", sample_rate: 44100, bit_rate: 128000 }, // MP3 plays in every browser
      }),
      signal: AbortSignal.timeout(8000), // give up after 8 s (the browser voice takes over)
    });
    if (!res.ok) {
      console.error(`[tts] Cartesia answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return Response.json({ ok: false }, { status: 502 });
    }
    return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } }); // stream the MP3 through
  } catch (err) {
    console.error("[tts]", err);
    return Response.json({ ok: false }, { status: 502 });
  }
}

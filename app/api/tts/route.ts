// POST /api/tts  { text }  ->  MP3 audio (ElevenLabs), or 501 when ElevenLabs isn't set up.
// Optional: only used when ELEVENLABS_API_KEY is set. The browser falls back to its own voice
// on ANY error from this route, so the app works the same without it.
import { rateLimit } from "@/lib/rateLimit"; // per-visitor speed bump (Phase 5)
import { badRequest } from "@/lib/routeHelpers";

export const maxDuration = 30;

// "Rachel": a calm, warm premade ElevenLabs voice. Override with ELEVENLABS_VOICE_ID if you prefer another.
const DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM";

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY; // secret: only ever read on the server
  if (!key) return Response.json({ ok: false, off: true }, { status: 501 }); // switched off: the browser voice is used
  try {
    const limited = rateLimit(req, "light"); // too many requests from this visitor?
    if (limited) return limited;
    const body = await req.json().catch(() => ({}));
    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return badRequest("Nothing to say.");
    if (text.length > 600) return badRequest("That's too long to read aloud."); // keeps free-plan characters low

    const voice = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE;
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text, model_id: "eleven_flash_v2_5" }), // the fastest ElevenLabs model
      signal: AbortSignal.timeout(8000), // give up after 8 s (the browser voice takes over)
    });
    if (!res.ok) {
      console.error(`[tts] ElevenLabs answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return Response.json({ ok: false }, { status: 502 });
    }
    return new Response(res.body, { headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" } }); // stream the MP3 through
  } catch (err) {
    console.error("[tts]", err);
    return Response.json({ ok: false }, { status: 502 });
  }
}

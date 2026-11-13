// GET /api/health — reports WHETHER each API key is configured, never the key itself.
// This runs on the server (a "route handler"), so process.env is readable here but never sent to the browser.

import { connection } from "next/server"; // lets us say "run this on every request, not once at build time"

export async function GET() {
  await connection(); // wait for a real request, so the answer reflects the env vars set right now
  return Response.json({
    ok: true, // the Next.js server itself is up
    gemini: Boolean(process.env.GEMINI_API_KEY), // true if the key exists, false if missing/empty
    cartesia: Boolean(process.env.CARTESIA_API_KEY), // same check for the Cartesia voice
  });
}

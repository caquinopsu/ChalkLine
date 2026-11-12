// Basic per-visitor rate limiting for the AI routes, so one visitor (or a bot) can't use up the
// whole free Gemini quota. No login and no database: visitors are told apart by their IP address,
// and counts live in the server's memory.
//
// Limitation (on purpose, to keep it simple): Vercel may run several copies of the server, and a
// copy forgets its counts when it shuts down. So this is a speed bump, not a hard wall. That's
// enough to stop accidental loops and casual abuse during the demo.
import "server-only";

// Two cost classes. "heavy" = the smart model with long answers (pre-solve, photos, Check my work,
// similar problems). "light" = quick calls (step checks, why?, voice).
const LIMITS = {
  heavy: { perMinute: 6, perDay: 60 },
  light: { perMinute: 30, perDay: 500 },
} as const;
export type Cost = keyof typeof LIMITS;

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

// visitor + cost class -> the times of their recent requests (milliseconds), oldest first
const hits = new Map<string, number[]>();

// The visitor's IP address. Vercel puts the real one first in "x-forwarded-for".
function visitor(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

// Call at the top of a route. Returns a friendly 429 response if the visitor is over the limit,
// or null (and counts this request) if they're fine.
export function rateLimit(req: Request, cost: Cost): Response | null {
  const now = Date.now();
  const key = `${visitor(req)}:${cost}`;
  const times = (hits.get(key) ?? []).filter((t) => now - t < DAY); // forget anything older than a day
  const lastMinute = times.filter((t) => now - t < MINUTE).length;
  const { perMinute, perDay } = LIMITS[cost];

  if (times.length >= perDay) {
    hits.set(key, times);
    return tooMany("You've reached today's limit for this demo. Please come back tomorrow!", 3600);
  }
  if (lastMinute >= perMinute) {
    hits.set(key, times);
    return tooMany("Whoa, that's a lot of requests at once. Wait a few seconds and try again.", 20);
  }
  times.push(now);
  hits.set(key, times);

  // Now and then, drop visitors we haven't seen in a day so memory doesn't grow forever.
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.length || now - v[v.length - 1] > DAY) hits.delete(k);
  }
  return null;
}

function tooMany(error: string, retryAfterSeconds: number): Response {
  return Response.json(
    { ok: false, error },
    { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } }, // tells the browser when to retry
  );
}

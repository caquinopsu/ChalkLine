// Small helpers shared by the API routes.
import "server-only";
import { ApiError } from "@google/genai"; // errors returned by the Gemini API (they carry an HTTP status)

// Turns any error into a friendly JSON response (and logs the details on the server for debugging).
export function errorResponse(err: unknown): Response {
  console.error(err); // shows up in the terminal / Vercel logs
  const fail = (error: string, status: number) => Response.json({ ok: false, error }, { status });
  if (err instanceof ApiError) {
    if (err.status === 429) return fail("The tutor is busy right now (usage limit reached). Try again in a minute.", 429);
    if (err.status === 401 || err.status === 403 || /api key/i.test(err.message)) return fail("The server's API key isn't working.", 500);
    if (err.status === 400) return fail("The tutor couldn't handle that request. Try rephrasing it.", 400);
    if (err.status === 504) return fail("The tutor took too long to answer. Please try again.", 504);
    return fail("The tutor had a hiccup. Please try again.", 502); // 500 / 503: Google's side
  }
  // Our own timeouts (httpOptions.timeout) end the request with an abort/timeout error.
  if (err instanceof Error && (err.name === "AbortError" || err.name === "TimeoutError" || /timed? ?out|aborted/i.test(err.message))) {
    return fail("The tutor took too long to answer. Please try again.", 504);
  }
  const message = err instanceof Error ? err.message : "Something went wrong.";
  return fail(message, 500);
}

// A 400 "bad request" response for invalid input.
export function badRequest(message: string): Response {
  return Response.json({ ok: false, error: message }, { status: 400 });
}

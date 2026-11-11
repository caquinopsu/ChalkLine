// Small helpers shared by the API routes.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Turns any error into a friendly JSON response (and logs the details on the server for debugging).
export function errorResponse(err: unknown): Response {
  console.error(err); // shows up in the terminal / Vercel logs
  if (err instanceof Anthropic.RateLimitError) {
    return Response.json({ ok: false, error: "The tutor is busy right now. Try again in a moment." }, { status: 429 });
  }
  if (err instanceof Anthropic.BadRequestError && /credit balance/i.test(err.message)) {
    return Response.json({ ok: false, error: "The tutor is out of API credits right now." }, { status: 503 });
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return Response.json({ ok: false, error: "The server's API key isn't working." }, { status: 500 });
  }
  if (err instanceof Anthropic.APIConnectionTimeoutError) {
    return Response.json({ ok: false, error: "The tutor took too long to answer. Please try again." }, { status: 504 });
  }
  if (err instanceof Anthropic.APIError) {
    return Response.json({ ok: false, error: "The tutor had a hiccup. Please try again." }, { status: 502 });
  }
  const message = err instanceof Error ? err.message : "Something went wrong.";
  return Response.json({ ok: false, error: message }, { status: 500 });
}

// A 400 "bad request" response for invalid input.
export function badRequest(message: string): Response {
  return Response.json({ ok: false, error: message }, { status: 400 });
}

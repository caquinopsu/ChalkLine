// Shared Anthropic (Claude) client. Server-only: this file reads the secret API key.
import "server-only"; // build error if a browser component ever imports this file
import Anthropic from "@anthropic-ai/sdk"; // the official Claude SDK

export const SONNET = "claude-sonnet-5-5"; // vision, pre-solving, explanations
export const HAIKU = "claude-haiku-5-5"; // fast step checks

let client: Anthropic | null = null; // created on first use, not at build time

// Returns the shared client, creating it the first time (it reads ANTHROPIC_API_KEY from the environment).
export function claude(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

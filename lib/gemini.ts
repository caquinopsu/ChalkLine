// Shared Google Gemini client and helpers. Server-only: this file reads the secret API key.
import "server-only"; // build error if a browser component ever imports this file
import { ApiError, GoogleGenAI, ThinkingLevel, type ContentListUnion } from "@google/genai"; // Google's official SDK
import { z } from "zod";

// Each job has a list of models to try in order. Free-tier models are sometimes "busy" (503) or
// slow (504); when that happens we move on to the next model instead of failing.
// (Tested Nov 11, 2026: 3.7 and 3.8 Flash timed out on our key, so they're not in the lists.)
export const SMART = ["gemini-3.6-flash", "gemini-3.5-flash", "gemini-3.5-flash-lite"]; // vision, pre-solving, whole solutions, explanations
export const FAST = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.6-flash"]; // quick step checks
export { ThinkingLevel }; // how much the model thinks before answering (MINIMAL, LOW, MEDIUM, HIGH)

let client: GoogleGenAI | null = null; // created on first use, not at build time

// Returns the shared client, creating it the first time (it reads GEMINI_API_KEY from the environment).
export function gemini(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("The server's Gemini API key is missing.");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

type Ask = {
  models: string[]; // SMART or FAST: tried in order
  system: string; // the instructions (from lib/prompts.ts)
  contents: ContentListUnion; // the request: text, or text + an image
  thinking: ThinkingLevel; // more thinking = slower but more careful
  timeoutMs: number; // give up on one model after this long and try the next
  maxOutputTokens?: number;
};

// Is this a "the model is busy or slow" error, worth retrying on another model?
function isBusy(err: unknown): boolean {
  if (err instanceof ApiError) return err.status === 429 || err.status === 500 || err.status === 503 || err.status === 504;
  return err instanceof Error && /timed? ?out|aborted|deadline/i.test(err.message); // our own timeout
}

// Runs one request, falling back to the next model when a model is busy. Other errors stop right away.
async function withFallback<T>(models: string[], run: (model: string) => Promise<T>): Promise<T> {
  let lastError: unknown = null;
  for (const model of models) {
    try {
      return await run(model);
    } catch (err) {
      lastError = err;
      if (!isBusy(err)) throw err; // e.g. a bad API key: another model won't help
      console.warn(`[gemini] ${model} busy or slow, trying the next model`);
    }
  }
  throw lastError;
}

// Asks Gemini for JSON in the exact shape of a zod schema, and returns it as a typed object.
export async function askJson<T>(ask: Ask & { schema: z.ZodType<T> }): Promise<T> {
  const jsonSchema = z.toJSONSchema(ask.schema); // zod schema -> standard JSON Schema that Gemini understands
  return withFallback(ask.models, async (model) => {
    const response = await gemini().models.generateContent({
      model,
      contents: ask.contents,
      config: {
        systemInstruction: ask.system,
        responseMimeType: "application/json", // reply must be JSON...
        responseJsonSchema: jsonSchema, // ...matching this schema
        thinkingConfig: { thinkingLevel: ask.thinking },
        maxOutputTokens: ask.maxOutputTokens ?? 16000,
        httpOptions: { timeout: ask.timeoutMs },
      },
    });
    const text = response.text; // the JSON as a string (undefined if the model stopped early)
    if (!text) {
      const reason = response.candidates?.[0]?.finishReason ?? response.promptFeedback?.blockReason;
      if (reason === "SAFETY" || reason === "PROHIBITED_CONTENT") throw new Error("The tutor declined this request.");
      throw new Error("The tutor didn't answer. Please try again.");
    }
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error("The tutor's answer wasn't in the expected format.");
    }
    const parsed = ask.schema.safeParse(data); // check the shape really matches
    if (!parsed.success) throw new Error("The tutor's answer wasn't in the expected format.");
    return parsed.data;
  });
}

// Asks Gemini for a plain-text answer (used by "Why?" follow-up questions).
export async function askText(ask: Ask): Promise<string> {
  return withFallback(ask.models, async (model) => {
    const response = await gemini().models.generateContent({
      model,
      contents: ask.contents,
      config: {
        systemInstruction: ask.system,
        thinkingConfig: { thinkingLevel: ask.thinking },
        maxOutputTokens: ask.maxOutputTokens ?? 4000,
        httpOptions: { timeout: ask.timeoutMs },
      },
    });
    return (response.text ?? "").trim();
  });
}

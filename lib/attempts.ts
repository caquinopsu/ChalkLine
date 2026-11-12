// Logs every step attempt in the browser (localStorage), with no login.
// The stretch "Skills" dashboard (Bayesian Knowledge Tracing) will read this history later.

export type Attempt = {
  ts: number; // when it happened (milliseconds since 1970)
  problemId: string; // which problem ("byparts", or "custom")
  skills: string[]; // technique tags, e.g. ["integration by parts"]
  stepId: string | null; // which reference step it was aiming at
  correct: boolean; // was the step accepted?
  hintUsed: boolean; // had they asked for a hint (or "show me") on this step?
  mode: "practice" | "walkthrough" | "check" | "voice"; // where it happened ("check" = a line in Check my work, "voice" = Think-aloud)
};

const KEY = "chalkline.attempts"; // the storage slot name

export function logAttempt(attempt: Attempt) {
  try {
    const all: Attempt[] = JSON.parse(localStorage.getItem(KEY) ?? "[]"); // read the existing list
    all.push(attempt); // add the new one
    localStorage.setItem(KEY, JSON.stringify(all.slice(-2000))); // save, keeping the latest 2000
  } catch {
    // Storage can be blocked (private windows, strict settings). Logging is optional, so ignore it.
  }
}

export function readAttempts(): Attempt[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

// Turns an error caught in the browser into a sentence a student can act on.
// Our API routes already send friendly messages; this mainly catches the browser's own
// network errors ("Failed to fetch", "Load failed"), which happen when Wi-Fi drops.
export function messageOf(err: unknown, fallback: string): string {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "You seem to be offline. Check your connection and try again.";
  if (!(err instanceof Error) || !err.message) return fallback;
  if (/failed to fetch|load failed|networkerror|network request failed/i.test(err.message)) {
    return "Couldn't reach the tutor. Check your connection and try again.";
  }
  return err.message;
}

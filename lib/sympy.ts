// Server helper: asks our Python SymPy function (api/check.py) whether expressions are equal.
import "server-only"; // only server routes may import this

export type Verdict = boolean | null; // true = equal, false = different, null = couldn't decide

// Compares each [a, b] pair. `origin` is the site's own address (e.g. https://chalk-line-five.vercel.app),
// because the Python function lives at <origin>/api/check.
export async function sympyCompare(
  origin: string,
  pairs: [string, string][],
  mode: "value" | "antiderivative",
  variable: string,
): Promise<Verdict[]> {
  if (pairs.length === 0) return []; // nothing to check
  try {
    const res = await fetch(new URL("/api/check", origin), {
      method: "POST", // send the pairs in the request body
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairs, mode, var: variable }),
      signal: AbortSignal.timeout(20_000), // give up after 20 seconds
    });
    if (!res.ok) return pairs.map(() => null); // checker unavailable -> undecided
    const data = (await res.json()) as { results: { equivalent: Verdict }[] };
    return data.results.map((r) => r.equivalent); // keep just true/false/null
  } catch {
    return pairs.map(() => null); // network error -> undecided (the AI's judgment is used instead)
  }
}

// Browser helper: gets the solution package for a typed (or photographed) problem.
// Results are remembered by problem text, so pre-solving can start early (as soon as a photo is read)
// and picking a mode a few seconds later reuses the same request instead of paying twice.
import type { SolutionPackage } from "./schemas";

const cache = new Map<string, Promise<SolutionPackage>>(); // problem LaTeX -> its package (or the pending request)

async function fetchPackage(problem: string): Promise<SolutionPackage> {
  const res = await fetch("/api/presolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ problem }),
  });
  const data = await res.json().catch(() => ({ ok: false, error: "The server didn't answer properly." }));
  if (!data.ok) throw new Error(data.error);
  return data.pkg;
}

// Starts (or reuses) the pre-solve for a problem. Failed requests are forgotten so they can be retried.
export function getPackage(problem: string): Promise<SolutionPackage> {
  const key = problem.trim();
  let pending = cache.get(key);
  if (!pending) {
    pending = fetchPackage(key);
    cache.set(key, pending);
    pending.catch(() => cache.delete(key));
  }
  return pending;
}

// Stores a package we already have (e.g. from "Give me a similar problem").
export function rememberPackage(problem: string, pkg: SolutionPackage) {
  cache.set(problem.trim(), Promise.resolve(pkg));
}

// Browser helper: gets the solution package for a typed (or photographed) problem.
// Results are remembered by problem text, so pre-solving can start early (as soon as a photo is read)
// and picking a mode a few seconds later reuses the same request instead of paying twice.
import type { SolutionPackage } from "./schemas";

const cache = new Map<string, Promise<SolutionPackage>>(); // problem LaTeX -> its package (or the pending request)

async function fetchPackage(problem: string, task: string): Promise<SolutionPackage> {
  const res = await fetch("/api/presolve", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ problem, task }),
  });
  const data = await res.json().catch(() => ({ ok: false, error: "The server didn't answer properly." }));
  if (!data.ok) throw new Error(data.error);
  return data.pkg;
}

// Starts (or reuses) the pre-solve for a problem. Failed requests are forgotten so they can be retried.
// task = the worksheet's instructions for this problem (part of a problem set), "" if none.
export function getPackage(problem: string, task = ""): Promise<SolutionPackage> {
  const key = task ? `${problem.trim()}\n${task.trim()}` : problem.trim(); // same problem + same task = same package
  let pending = cache.get(key);
  if (!pending) {
    pending = fetchPackage(problem.trim(), task.trim());
    cache.set(key, pending);
    pending.catch(() => cache.delete(key));
  }
  return pending;
}

// Stores a package we already have (e.g. from "Give me a similar problem").
export function rememberPackage(problem: string, pkg: SolutionPackage) {
  cache.set(problem.trim(), Promise.resolve(pkg));
}

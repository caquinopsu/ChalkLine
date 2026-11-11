// POST /api/presolve  { problem: "..." }  ->  { ok, pkg, verification }
// Builds the reference solution package for a typed problem (presets skip this: theirs are saved in data/presets).
import { presolve } from "@/lib/presolve";
import { badRequest, errorResponse } from "@/lib/routeHelpers";

export const maxDuration = 180; // the AI can take a while on a full solution; allow up to 2 minutes

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({})); // read the JSON body ({} if it's broken)
    const problem = typeof body.problem === "string" ? body.problem.trim() : ""; // the problem text
    if (!problem) return badRequest("Please type a problem first.");
    if (problem.length > 500) return badRequest("That problem is too long (500 characters max).");
    const origin = new URL(req.url).origin; // our own site address, used to reach the SymPy checker
    const { pkg, verification } = await presolve(problem, origin);
    return Response.json({ ok: true, pkg, verification });
  } catch (err) {
    return errorResponse(err);
  }
}

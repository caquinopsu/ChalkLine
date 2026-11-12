// POST /api/check-step  (CheckRequest)  ->  { ok, result: CheckResult }
// Checks one line a student typed in Step practice.
import { rateLimit } from "@/lib/rateLimit"; // per-visitor speed bump (Phase 5)
import { checkStep } from "@/lib/checkStep";
import { badRequest, errorResponse } from "@/lib/routeHelpers";
import { PackageSchema, type CheckRequest } from "@/lib/schemas";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const limited = rateLimit(req, "light"); // too many requests from this visitor?
    if (limited) return limited;
    const text = await req.text(); // raw body
    if (text.length > 80_000) return badRequest("Request too large.");
    const body = JSON.parse(text) as Partial<CheckRequest>;
    const pkg = PackageSchema.safeParse(body.pkg); // make sure the package has the right shape
    if (!pkg.success) return badRequest("Missing or invalid solution package.");
    const studentLatex = typeof body.studentLatex === "string" ? body.studentLatex.trim() : "";
    if (!studentLatex) return badRequest("Type a step first.");
    if (studentLatex.length > 500) return badRequest("That step is too long.");
    const request: CheckRequest = {
      pkg: pkg.data,
      expectedIndex: Number.isInteger(body.expectedIndex) ? body.expectedIndex! : 0,
      board: Array.isArray(body.board) ? body.board.slice(-12) : [], // the last 12 lines are plenty of context
      studentLatex,
      attempt: Number.isInteger(body.attempt) ? body.attempt! : 1,
    };
    const result = await checkStep(request, new URL(req.url).origin);
    return Response.json({ ok: true, result });
  } catch (err) {
    return errorResponse(err);
  }
}

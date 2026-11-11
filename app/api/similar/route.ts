// POST /api/similar  { pkg }  ->  { ok, pkg }   (the package for a new, SymPy-checked problem)
import { badRequest, errorResponse } from "@/lib/routeHelpers";
import { PackageSchema } from "@/lib/schemas";
import { similarProblem } from "@/lib/similar";

export const maxDuration = 180; // writing + pre-solving + verifying, possibly twice

export async function POST(req: Request) {
  try {
    const text = await req.text();
    if (text.length > 80_000) return badRequest("Request too large.");
    const pkg = PackageSchema.safeParse(JSON.parse(text).pkg);
    if (!pkg.success) return badRequest("Missing or invalid solution package.");
    const next = await similarProblem(pkg.data, new URL(req.url).origin);
    return Response.json({ ok: true, pkg: next });
  } catch (err) {
    return errorResponse(err);
  }
}

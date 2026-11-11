// POST /api/check-work  { pkg, lines: string[] }  ->  { ok, result: WorkResult }
// Mode B: checks a whole written solution and finds the first slip.
import { checkWork, MAX_WORK_LINES } from "@/lib/checkWork";
import { badRequest, errorResponse } from "@/lib/routeHelpers";
import { PackageSchema } from "@/lib/schemas";

export const maxDuration = 90;

export async function POST(req: Request) {
  try {
    const text = await req.text();
    if (text.length > 100_000) return badRequest("Request too large.");
    const body = JSON.parse(text);
    const pkg = PackageSchema.safeParse(body.pkg);
    if (!pkg.success) return badRequest("Missing or invalid solution package.");
    const lines: string[] = Array.isArray(body.lines)
      ? body.lines.filter((l: unknown) => typeof l === "string" && l.trim()).map((l: string) => l.trim())
      : [];
    if (lines.length === 0) return badRequest("Write at least one line of your solution first.");
    if (lines.length > MAX_WORK_LINES) return badRequest(`That's a long one! Please keep it to ${MAX_WORK_LINES} lines.`);
    if (lines.some((l) => l.length > 500)) return badRequest("One of the lines is too long.");
    const result = await checkWork(pkg.data, lines, new URL(req.url).origin);
    return Response.json({ ok: true, result });
  } catch (err) {
    return errorResponse(err);
  }
}

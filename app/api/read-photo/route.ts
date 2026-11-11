// POST /api/read-photo  { image: base64, mediaType, knownProblem? }  ->  { ok, read: PhotoRead }
// Reads a photo of a problem and/or handwritten work. The photo is never stored.
import { readPhoto, type ImageType } from "@/lib/readPhoto";
import { badRequest, errorResponse } from "@/lib/routeHelpers";

export const maxDuration = 60;

const TYPES: ImageType[] = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export async function POST(req: Request) {
  try {
    const text = await req.text();
    if (text.length > 4_000_000) return badRequest("That photo is too large. Try a smaller one."); // Vercel's limit is 4.5 MB
    const body = JSON.parse(text);
    const image = typeof body.image === "string" ? body.image : "";
    if (!image || !/^[A-Za-z0-9+/=]+$/.test(image)) return badRequest("Please choose a photo first.");
    const mediaType = TYPES.includes(body.mediaType) ? (body.mediaType as ImageType) : null;
    if (!mediaType) return badRequest("Please use a JPG or PNG image.");
    const known = typeof body.knownProblem === "string" ? body.knownProblem.slice(0, 500) : null;
    const read = await readPhoto(image, mediaType, known);
    return Response.json({ ok: true, read });
  } catch (err) {
    return errorResponse(err);
  }
}

// Browser helpers for photos: shrink the image, then send it to /api/read-photo.
import type { PhotoRead } from "./schemas";

export type PreparedPhoto = { base64: string; mediaType: "image/jpeg"; thumb: string }; // thumb = a data URL to show

const MAX_SIDE = 1568; // Claude reads images up to about this size; bigger only makes the upload slower

// Shrinks a photo to at most 1568 px on its longest side and re-saves it as a JPEG.
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file); // decodes the image (and applies the phone's rotation)
  } catch {
    throw new Error("Couldn't open that image. Please use a JPG or PNG photo.");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height)); // never enlarge
  const canvas = document.createElement("canvas"); // an off-screen drawing surface
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // transparent screenshots get a white background
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85); // "data:image/jpeg;base64,...."
  return { base64: dataUrl.split(",")[1], mediaType: "image/jpeg", thumb: dataUrl };
}

// Sends a prepared photo to the server and returns what Sonnet read.
export async function readPhoto(photo: PreparedPhoto, knownProblem?: string): Promise<PhotoRead> {
  const res = await fetch("/api/read-photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: photo.base64, mediaType: photo.mediaType, knownProblem: knownProblem ?? null }),
  });
  const data = await res.json().catch(() => ({ ok: false, error: "The server didn't answer properly." }));
  if (!data.ok) throw new Error(data.error);
  return data.read;
}

// Pulls an image file out of a paste (Ctrl+V of a screenshot) or a drag-and-drop, if there is one.
export function imageFrom(data: DataTransfer | null): File | null {
  if (!data) return null;
  for (const file of Array.from(data.files)) if (file.type.startsWith("image/")) return file;
  return null;
}

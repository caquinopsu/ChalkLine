// The 6 demo problems. Their solution packages were generated once (npm run presets)
// and live in public/presets/<id>.json, so loading one is instant and free.
import list from "@/data/preset-list.json"; // id, tag, topic, latex, prompt for each preset
import type { SolutionPackage } from "./schemas";

export type PresetMeta = (typeof list)[number]; // the type of one entry in the list
export const PRESETS: PresetMeta[] = list;

// Fetches a preset's saved solution package from the server.
export async function loadPreset(id: string): Promise<SolutionPackage> {
  const res = await fetch(`/presets/${id}.json`); // a plain static file
  if (!res.ok) throw new Error("This demo problem isn't ready yet.");
  return res.json();
}

// The problem library: which problems you've solved, and which ones to practice next.
// Everything stays in this browser (localStorage), with no login.
//
// "Picked for you" (weak spots) is version 1 of the recommender: a simple count over your own step
// history (lib/attempts.ts). For each technique it counts the steps you missed or needed help on,
// and recommends library problems that use the techniques you miss most. A trained model (e.g.
// knowledge tracing, which predicts the chance you'll get the next step right) can replace
// weakSpots() later without changing the screens, because it returns the same thing.
import { PRESETS, type PresetMeta } from "./presets";
import { readAttempts } from "./attempts";

const SOLVED_KEY = "chalkline.solved"; // the storage slot for solved problem ids

// The ids of the library problems you've finished (any mode).
export function solvedIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SOLVED_KEY) ?? "[]"));
  } catch {
    return new Set(); // storage blocked (private window): nothing is remembered, that's fine
  }
}

export function markSolved(id: string) {
  try {
    const all = solvedIds();
    all.add(id);
    localStorage.setItem(SOLVED_KEY, JSON.stringify([...all]));
  } catch {
    // ignore: remembering is optional
  }
}

// Lowercase, no punctuation, so "L'Hôpital's rule" and "l'hopital's rule" compare equal.
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, "").trim();

// Does a technique name from your history ("integration by parts") match a library tag?
// (Tags and the AI's technique names are written a little differently, so we compare loosely.)
function matches(skill: string, tag: string): boolean {
  const a = norm(skill), b = norm(tag);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  const words = (s: string) => s.split(" ").filter((w) => w.length > 3 && !["rule", "test", "series"].includes(w));
  return words(a).some((w) => words(b).includes(w)); // share a meaningful word ("substitution", "parts")
}

export type WeakSpot = { skill: string; missed: number; tried: number }; // a technique you struggle with

// Your weakest techniques, worst first: the ones with the most missed (or helped) steps.
export function weakSpots(limit = 3): WeakSpot[] {
  const bySkill = new Map<string, WeakSpot>();
  for (const a of readAttempts()) {
    for (const skill of a.skills) {
      const key = norm(skill);
      const spot = bySkill.get(key) ?? { skill, missed: 0, tried: 0 };
      spot.tried += 1;
      if (!a.correct || a.hintUsed) spot.missed += 1; // a miss, or right only after help
      bySkill.set(key, spot);
    }
  }
  return [...bySkill.values()]
    .filter((s) => s.missed > 0)
    // score = misses x miss rate: many misses on a skill you rarely get right ranks first
    .sort((x, y) => y.missed * (y.missed / y.tried) - x.missed * (x.missed / x.tried))
    .slice(0, limit);
}

export type Pick = { problem: PresetMeta; reason: string }; // a recommended problem and why

// Up to `limit` problems that practice your weak spots: unsolved ones first, easiest first.
export function picksForYou(limit = 3): Pick[] {
  const solved = solvedIds();
  const picks: Pick[] = [];
  for (const spot of weakSpots(5)) {
    const options = PRESETS.filter((p) => matches(spot.skill, p.tag) && !picks.some((k) => k.problem.id === p.id))
      .sort((a, b) => Number(solved.has(a.id)) - Number(solved.has(b.id)) || a.level - b.level);
    const best = options[0];
    if (best) picks.push({ problem: best, reason: `${spot.missed} missed step${spot.missed === 1 ? "" : "s"} on ${spot.skill.toLowerCase()}` });
    if (picks.length >= limit) break;
  }
  return picks;
}

// Library problems that practice a technique (for "More … problems" on the summary).
export function problemsFor(skill: string): PresetMeta[] {
  return PRESETS.filter((p) => matches(skill, p.tag));
}

export const TOPICS = [...new Set(PRESETS.map((p) => p.topic))]; // in the order of the list
export const LEVELS = ["", "warm-up", "core", "challenge"]; // level 1-3 as words

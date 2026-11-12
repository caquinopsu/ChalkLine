# Handoff: research a calculus problem dataset for Chalkline

Paste this whole file into a new chat (opened in this same project folder) to start the research.

## Context
- **Chalkline** is an AI calculus tutor (Calc I + II) in this folder: Next.js 16 + TypeScript on Vercel,
  live at https://chalk-line-five.vercel.app. Read `CLAUDE.md`, `PROGRESS.md` and `CODE_GUIDE.md` first.
- The AI is **Google Gemini** (free tier, `lib/gemini.ts`). Free-tier models are often busy, so a new
  typed or photographed problem takes 15-20 s to "pre-solve", sometimes up to a minute.
- Every problem gets a **solution package** (`PackageSchema` in `lib/schemas.ts`): steps in LaTeX and
  SymPy form, rule names, hints, "why" text, common mistakes, optional colored parts. A Python SymPy
  checker (`api/check.py`) verifies lines. The 6 demo problems are pre-solved files in `public/presets/`.
- The owner is a student who knows basic Python; explain at a high level and comment code well.
- **Deadline: Nov 13, 2026, 11:59 pm ET.** The voice feature (Phase 3) is being built in parallel in
  another chat in this same folder, so **do not edit existing app files** during the research. New
  files go under `research/` (and `scripts/` for a prototype importer, if you get that far).

## Goal
Find free, openly available datasets of calculus problems **with worked solutions** (step-by-step if
possible, at least final answers), and recommend how Chalkline can use them to:
1. **Load known problems instantly**: when a typed/photographed problem matches a dataset entry
   (matched by math, not text: convert both to a canonical SymPy expression), give Gemini the known
   solution to format into a package instead of solving from scratch (faster, more accurate, works
   better when the free tier is busy). Partial data (just steps, or just the answer) still helps.
2. **"Give me a similar problem" instantly**: pick a dataset problem with the same technique tag
   instead of generating one.
3. **A big Practice bank** browsable by topic (limits, derivatives, chain rule, u-sub, by parts,
   partial fractions, trig integrals, improper integrals, series tests, Taylor series, ...).

Colored parts and other package extras are optional and must not block anything.

## Questions to answer
1. **Which datasets?** Search Hugging Face, Kaggle, GitHub, OpenStax, MIT OCW and similar. For each
   candidate: name, link, license, total size, how many problems are Calc I/II, format (LaTeX? plain
   text?), whether solutions are step-by-step or answer-only, and quality (spot-check 10 calculus
   problems by hand or with SymPy). Candidates worth checking include NuminaMath, the MATH dataset,
   DeepMind's mathematics dataset (calculus modules), OpenStax Calculus Vol. 1-2 exercises, and any
   dedicated calculus sets.
2. **How to tag techniques** (e.g. "integration by parts") for problems that don't come tagged.
3. **How to match** an incoming problem to the dataset: canonical SymPy form as the key? How many
   dataset problems parse into SymPy cleanly?
4. **Where to store it**: Vercel limits server functions to roughly 250 MB unzipped, and a huge
   dataset shouldn't go in the git repo. Compare (a) a filtered calculus-only file shipped with the app
   (how many MB?) vs (b) a free hosted database (Supabase, Neon, Upstash, Turso, ...) with a lookup
   route. Include setup steps the owner would need to click through.
5. **Effort and risk** before the deadline.

## Deliverable
- `research/dataset-report.md`: a comparison table of the datasets, a clear recommendation, the
  storage choice, and a step-by-step integration plan (which files change, new routes, the lookup
  flow, what Gemini is asked when a match is found).
- Optional, only if time allows and the owner agrees: a prototype importer in `scripts/` that downloads
  the recommended dataset, filters calculus problems, converts them to SymPy, tags techniques, and
  writes a small sample (e.g. 500 problems) to `research/sample.json`.
- Don't commit or push; leave that to the owner (another chat is committing Phase 3 work).

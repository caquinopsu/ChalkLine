# Progress

## Phase 0: Skeleton and deploy (in progress)
- Done: Next.js 16 (App Router, TypeScript, Tailwind) app in this folder.
- Done: `api/check.py` SymPy function (`/api/check` self-test, `?a=&b=` equivalence check). Self-test passes locally.
- Done: `/api/health` reports whether each API key is set (never the value).
- Done: `.env.local` (git-ignored) and `.env.example`. Test page with two buttons.
- To do: push to GitHub (`ChalkLine` repo), deploy on Vercel, check that the public URL loads and `/api/check` responds.

## Next
Phase 1: text-only engine, Walkthrough (Mode A) and Step practice (Mode C), 6 preset problems.

## Known issues
- `npm run dev` doesn't run Python, so "Test SymPy" only works on the deployed site.
- `/api/check` has no rate limiting yet, and a deliberately huge expression could be slow. Planned for Phase 5.
- Unknown multi-letter names are split into single letters (e.g. `abc` means a*b*c). Fine for calculus; will revisit in Phase 1.

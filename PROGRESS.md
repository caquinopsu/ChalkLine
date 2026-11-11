# Progress

Live: https://chalk-line-five.vercel.app · Repo: https://github.com/caquinopsu/ChalkLine (every push to `main` redeploys)

## Phase 0: Skeleton and deploy ✅ (Nov 11, 2026)
- Next.js 16 (App Router, TypeScript, Tailwind) app.
- `api/check.py` SymPy function: `/api/check` self-test and `?a=&b=` equivalence check. Verified on the live site.
- `/api/health` reports whether each API key is set (never the value). Both keys show `true` on Vercel.
- `.env.local` (git-ignored) and `.env.example`. Test page with two buttons.
- `CODE_GUIDE.md`: file-by-file tour for learning.

## Next
Phase 1: text-only engine, Walkthrough (Mode A) and Step practice (Mode C), 6 preset problems.

## Known issues
- `npm run dev` doesn't run Python, so "Test SymPy" only works on the deployed site.
- `/api/check` has no rate limiting yet, and a deliberately huge expression could be slow. Planned for Phase 5.
- Unknown multi-letter names are split into single letters (e.g. `abc` means a*b*c). Fine for calculus; will revisit in Phase 1.

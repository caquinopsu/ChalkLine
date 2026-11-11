# Progress

Live: https://chalk-line-five.vercel.app · Repo: https://github.com/caquinopsu/ChalkLine (every push to `main` redeploys)

## Phase 0: Skeleton and deploy ✅ (Nov 11, 2026)
- Next.js 16 app, `api/check.py` SymPy function, `/api/health` key check, env setup, `CODE_GUIDE.md`.

## Phase 1: Text engine + Walkthrough + Step practice ✅ (Nov 11, 2026)
- **Screens** (structure from `design/DESIGN.md`, plain-ish styling): start screen with Type it and
  Practice dropdowns; session screen with board + 3-card tray; finish board.
- **Pre-solve** (`/api/presolve`, Sonnet): reference solution package, every line double-checked by
  SymPy, one automatic retry if SymPy rejects a line. Typed problems take about 15 s.
- **6 presets** pre-solved and saved in `public/presets/` (instant, free). SymPy confirmed every
  checkable line.
- **Walkthrough (Mode A):** previous / next / autoplay, Why? (with follow-up questions via `/api/why`),
  Side work, "Let me try the next step".
- **Step practice (Mode C):** MathLive input with live chalk preview, `/api/check-step` (Haiku verdict,
  SymPy can overrule on the algebra, fixed rule for a missing + C), pink ring + hint on wrong steps,
  fix shown after a second miss or on request, Hint, "Stuck? Show me this step".
- Mode chip switches modes mid-problem. Every step attempt is logged to localStorage.
- `npm run test:steps`: 14/14 right/wrong sample steps across all 6 presets judged correctly.

## Next
Phase 2: Vision (photo → problem), Check my work (Mode B), "Give me a similar problem".

## Known issues
- MathLive's typing shortcuts (`^`, `/`) weren't testable by automation; check them by hand.
- Series problems (ratio test) are judged by the AI alone for most lines (SymPy can't compare them).
- No rate limiting yet (Phase 5). Each step check costs about $0.001, a typed problem about $0.05.
- `/api/check` has no rate limiting, and a deliberately huge expression could be slow (8 s cap per comparison).

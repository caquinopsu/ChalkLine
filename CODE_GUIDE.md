# Chalkline code guide

A tour of every file in the project: what it does, how the pieces connect, and the
web-development ideas behind them. Updated at the end of every phase (last: **Phase 1**).

> **Tip:** In VS Code, press `Ctrl+Shift+V` while this file is open to see it nicely formatted.

---

## 1. The big picture

```
 Your browser (React)                    Server (Vercel)
┌──────────────────────────┐          ┌───────────────────────────────────────────────┐
│ app/page.tsx             │          │ /api/presolve  ─► Claude Sonnet: write the     │
│  ├ StartScreen           │  fetch   │                   reference solution           │
│  └ Session               │ ───────► │                └► SymPy: double-check each line│
│     ├ Board  (chalk)     │          │ /api/check-step ─► Claude Haiku: judge a step  │
│     └ Tray   (3 cards)   │ ◄─────── │                 └► SymPy: verify the algebra   │
│                          │   JSON   │ /api/why        ─► Claude Sonnet: follow-ups   │
│ public/presets/*.json    │          │ /api/check (Python) = SymPy itself             │
└──────────────────────────┘          └───────────────────────────────────────────────┘
```

- **Frontend:** the page you see, built with **React** (a library for building pages out of
  reusable pieces called *components*) inside **Next.js** (a framework that adds routing, server
  code and deployment on top of React).
- **Server routes:** code that runs on the server, never in the browser, so the secret API key is
  safe there.
- **Two "brains" that check each other:** Claude understands what a student *meant* and writes
  friendly hints. **SymPy** (Python) is exact at algebra. When they disagree about whether a line
  keeps the same value, SymPy wins.

### The key idea: the "reference solution package"
When a problem loads, Sonnet writes one JSON "package": every step of the solution, with a rule
name, a "why", a hint, common mistakes, colored parts, and a SymPy version of each line. Every mode
reuses it. Walkthrough *shows* it, and Step practice *checks your lines against it*. The 6 demo
problems' packages are saved as files, so they load instantly and cost nothing.

---

## 2. Which files to read (suggested order)

| # | File | What it is |
|---|------|------------|
| 1 | `lib/schemas.ts` | **Start here.** The shapes of all the data (package, step, check result). |
| 2 | `api/check.py` | Python SymPy checker. "Are these two expressions equal?" |
| 3 | `lib/prompts.ts` | The instructions we give Claude. Plain English, worth reading. |
| 4 | `lib/presolve.ts` | Sonnet writes a package, SymPy verifies it. |
| 5 | `lib/checkStep.ts` | Haiku judges a step, SymPy can overrule it. |
| 6 | `app/api/*/route.ts` | Thin wrappers that turn web requests into calls to the files above. |
| 7 | `app/page.tsx` | Top of the UI: start screen or session. |
| 8 | `components/StartScreen.tsx` | Start screen + "Type it" and "Practice" dropdowns. |
| 9 | `components/Session.tsx` | The session: all the state for Walkthrough / Step practice / finish. |
| 10 | `components/Board.tsx` | The chalkboard and its shrinking step stack. |
| 11 | `components/Tex.tsx`, `MathInput.tsx` | Math display (KaTeX) and math typing (MathLive). |

**Smaller helpers:** `lib/anthropic.ts` (the Claude client), `lib/sympy.ts` (calls the Python
checker), `lib/routeHelpers.ts` (friendly error messages), `lib/presets.ts` (the 6 demo problems),
`lib/attempts.ts` (logs every attempt in your browser for the future Skills dashboard),
`components/Logo.tsx`, `types/math-field.d.ts` (tells TypeScript about MathLive's `<math-field>` tag).

**Data and scripts:**

| File | What it's for |
|------|---------------|
| `data/preset-list.json` | The 6 demo problems: id, tag, LaTeX, and the text sent to Sonnet. |
| `public/presets/*.json` | Their saved solution packages (made by `npm run presets`). |
| `scripts/dev_py.py` | Runs the Python checker locally on port 8000 (Vercel does this in the cloud). |
| `scripts/generate-presets.mjs` | Re-generates the preset packages. |
| `scripts/test-steps.mjs` | Sends sample right and wrong steps for every preset and prints the verdicts. |

**Settings:** `package.json` (libraries + commands), `requirements.txt` (Python libraries),
`next.config.ts` (forwards `/api/check` to the local Python server during development),
`vercel.json`, `tsconfig.json`, `eslint.config.mjs`, `.env.local` (**your secret keys**, never
uploaded), `.env.example`, `.gitignore`.

**Ignore:** `node_modules/`, `.next/`, `.venv/`, `package-lock.json`, `next-env.d.ts`, `.git/`.

---

## 3. How a step check works (Step practice)

1. You type in the MathLive box. Every edit calls `setDraft(...)`, so React redraws the board with
   your line in big chalk.
2. **Check this step** → `Session.tsx` sends `{ package, lines on the board, your LaTeX, attempt }`
   to `/api/check-step`.
3. `lib/checkStep.ts` asks **Haiku**: what did they write (in SymPy form), is it correct, which
   reference step does it match, where is the mistake, and what hint to give.
4. It then asks **SymPy** whether your line has the same value as the problem (for integrals, "same up
   to + C"). If Haiku and SymPy disagree on the algebra, SymPy's answer is used.
5. A fixed rule catches a missing **+ C** on indefinite integrals.
6. Back in the browser: correct → the line moves up the board with a ✓. Wrong → pink ring + hint.
   After a second miss, the fix is written in teal.

---

## 4. Web-development ideas used (one line each)

- **Component:** a function that returns what to draw (`function Board(...) { return <div>…</div> }`).
- **Props:** inputs passed to a component, like function arguments (`<Tex latex="x^2" />`).
- **State (`useState`):** a variable React watches. Changing it redraws the page.
- **Effect (`useEffect`):** code that runs *after* drawing, e.g. to start a timer (autoplay) or load MathLive.
- **Ref (`useRef`):** a handle to a real element on the page (used to insert math keys into the input).
- **`"use client"`:** this file runs in the browser (needed for anything interactive).
- **`import "server-only"`:** this file must never reach the browser (it touches the API key).
- **`fetch` + `await`:** call a URL and wait for the reply without freezing the page.
- **JSON:** the text format the browser and server use to exchange data.
- **Schema (zod):** a description of a data shape, used to force Claude's reply into that exact shape.
- **Structured outputs:** Claude is *required* to return JSON matching the schema, so parsing never breaks.
- **Prompt caching:** the parts of a request that never change (instructions, the package) are cached
  by the API, which makes repeat calls cheaper and faster.
- **Tailwind classes:** styling shortcuts in `className` (`rounded` = rounded corners, `px-4` =
  horizontal padding, `bg-panel` = our panel color from `globals.css`).
- **KaTeX / LaTeX:** LaTeX is a text language for math (`\frac{x^2}{2}`), and KaTeX draws it.
  `\htmlClass{role-a}{u}` adds a CSS class, which is how parts get their blue/gold/teal colors.

---

## 5. Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Starts the app at http://localhost:3000 **and** the Python checker. Stop with `Ctrl+C`. |
| `npm run build` | Builds the production version (what Vercel does). Good for catching errors. |
| `npm run lint` | Checks for common mistakes. |
| `npm run presets` | Re-generates the 6 demo solutions (needs `npm run dev` running; costs about $0.40). |
| `npm run test:steps` | Runs the 14 sample step checks (needs `npm run dev`; costs about $0.02). |
| `.venv\Scripts\python api\check.py` | Runs the SymPy self-tests. |

---

## 6. VS Code tips

- **`Ctrl+P`**, then type a file name: jump to any file.
- **`Ctrl+Click`** a function name: jump to where it's defined.
- **Hover** over a name: shows its type and documentation.
- **Source Control** (`Ctrl+Shift+G`): see exactly what changed since the last commit.

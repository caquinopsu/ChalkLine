# Chalkline code guide

A tour of every file in the project: what it does, how the pieces connect, and the
web-development ideas behind them. Updated at the end of every phase (last: **Phase 2**).

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
│     └ WorkBoard (Mode B) │   JSON   │ /api/why        ─► Claude Sonnet: follow-ups   │
│                          │          │ /api/read-photo ─► Claude Sonnet: read a photo │
│ public/presets/*.json    │          │ /api/check-work ─► Sonnet marks a solution     │
│                          │          │                 └► SymPy: re-check every line  │
│                          │          │ /api/similar    ─► Sonnet: new problem, then   │
│                          │          │                    presolve + SymPy check      │
│                          │          │ /api/check (Python) = SymPy itself             │
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
reuses it. Walkthrough *shows* it, Step practice *checks your lines against it one at a time*, and
Check my work *compares your whole solution with it*. The 6 demo
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
| 6 | `lib/checkWork.ts` | Check my work: Sonnet marks a whole solution, SymPy finds slips it missed. |
| 7 | `lib/readPhoto.ts`, `lib/similar.ts` | Reading photos (vision) and writing similar problems. |
| 8 | `app/api/*/route.ts` | Thin wrappers that turn web requests into calls to the files above. |
| 9 | `app/page.tsx` | Top of the UI: start screen or session. |
| 10 | `components/StartScreen.tsx` | Start screen + "Upload a photo", "Type it" and "Practice" dropdowns. |
| 11 | `components/Session.tsx` | The session: all the state for every mode and the finish board. |
| 12 | `components/Board.tsx`, `WorkBoard.tsx` | The chalkboard; WorkBoard is its Check my work version. |
| 13 | `components/Tex.tsx`, `MathInput.tsx` | Math display (KaTeX) and math typing (MathLive). |

**Smaller helpers:** `lib/anthropic.ts` (the Claude client), `lib/sympy.ts` (calls the Python
checker), `lib/routeHelpers.ts` (friendly error messages), `lib/presets.ts` (the 6 demo problems),
`lib/attempts.ts` (logs every attempt in your browser for the future Skills dashboard),
`lib/photo.ts` (shrinks a photo in the browser and sends it), `lib/packages.ts` (remembers solution
packages in the browser so pre-solving can start early),
`components/Logo.tsx`, `types/math-field.d.ts` (tells TypeScript about MathLive's `<math-field>` tag).

**Data and scripts:**

| File | What it's for |
|------|---------------|
| `data/preset-list.json` | The 6 demo problems: id, tag, LaTeX, and the text sent to Sonnet. |
| `public/presets/*.json` | Their saved solution packages (made by `npm run presets`). |
| `scripts/dev_py.py` | Runs the Python checker locally on port 8000 (Vercel does this in the cloud). |
| `scripts/generate-presets.mjs` | Re-generates the preset packages. |
| `scripts/test-steps.mjs` | Sends sample right and wrong steps for every preset and prints the verdicts. |
| `scripts/test-work.mjs` | Sends whole sample solutions (some with a planted mistake) to Check my work. |

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

### How Check my work works (Mode B)
1. Your lines come from typing (one per line) or from a photo: the browser shrinks the photo
   (`lib/photo.ts`), and `/api/read-photo` asks **Sonnet** to copy each handwritten line *exactly*,
   mistakes included. You can tap any line to fix a misread before checking.
2. `/api/check-work` → `lib/checkWork.ts` asks **Sonnet** to mark the solution: is each line OK, which
   is the *first* wrong line, what went wrong, and what the line should have been.
3. **SymPy** then re-checks every line it can. If Sonnet flagged a line whose value SymPy proves is
   fine, that flag is dropped. If SymPy proves a line changed value and Sonnet missed it, that line
   becomes the slip. The + C rule runs last.
4. The board shows ✓, the pink ring + teal fix on the slip, and fades everything after it.
   "Redo step n myself" puts your correct lines into Step practice and lets you continue from there.

### How a photo becomes a problem
Upload → shrink to 1568 px → `/api/read-photo` → "We read this as". At that moment
`getPackage()` (`lib/packages.ts`) already starts the pre-solve in the background, so by the time you
pick a mode the solution is often ready. The photo is sent once and never saved.

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
- **Canvas:** an invisible drawing surface in the browser; we draw the photo on it smaller and save it as a JPEG.
- **Base64 / data URL:** a way to write a file (like a photo) as plain text, so it can travel inside JSON.
- **Promise cache:** remembering an unfinished request, so asking twice for the same thing waits for one answer.
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
| `npm run test:work` | Runs the 9 sample Check my work solutions (needs `npm run dev`; costs about $0.15). |
| `.venv\Scripts\python api\check.py` | Runs the SymPy self-tests. |

---

## 6. VS Code tips

- **`Ctrl+P`**, then type a file name: jump to any file.
- **`Ctrl+Click`** a function name: jump to where it's defined.
- **Hover** over a name: shows its type and documentation.
- **Source Control** (`Ctrl+Shift+G`): see exactly what changed since the last commit.

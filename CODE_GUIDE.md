# Chalkline code guide

A tour of every file in the project: what it does, how the pieces connect, and the
web-development ideas behind them. Updated at the end of every phase (last: **Phase 3**).

> **Tip:** In VS Code, press `Ctrl+Shift+V` while this file is open to see it nicely formatted.

---

## 1. The big picture

```
 Your browser (React)                    Server (Vercel)
┌──────────────────────────┐          ┌───────────────────────────────────────────────┐
│ app/page.tsx             │          │ /api/presolve  ─► Gemini (smart): write the    │
│  ├ StartScreen           │  fetch   │                   reference solution           │
│  └ Session               │ ───────► │                └► SymPy: double-check each line│
│     ├ Board  (chalk)     │          │ /api/check-step ─► Gemini (fast): judge a step │
│     └ Tray   (3 cards)   │ ◄─────── │                 └► SymPy: verify the algebra   │
│     └ WorkBoard (Mode B) │   JSON   │ /api/why        ─► Gemini (smart): follow-ups  │
│                          │          │ /api/read-photo ─► Gemini (smart): read photo  │
│ public/presets/*.json    │          │ /api/check-work ─► Gemini marks a solution     │
│                          │          │                 └► SymPy: re-check every line  │
│                          │          │ /api/similar    ─► Gemini: new problem, then   │
│                          │          │                    presolve + SymPy check      │
│ mic ► lib/recorder (WAV) │          │ /api/speech-to-math ─► Gemini (fast): listen,  │
│ voice ◄ lib/speak        │          │                    words + LaTeX + intent      │
│                          │          │ /api/tts (optional) ─► ElevenLabs voice        │
│                          │          │ /api/check (Python) = SymPy itself             │
└──────────────────────────┘          └───────────────────────────────────────────────┘
```

- **Frontend:** the page you see, built with **React** (a library for building pages out of
  reusable pieces called *components*) inside **Next.js** (a framework that adds routing, server
  code and deployment on top of React).
- **Server routes:** code that runs on the server, never in the browser, so the secret API key is
  safe there.
- **Two "brains" that check each other:** the AI (Google Gemini) understands what a student *meant* and writes
  friendly hints. **SymPy** (Python) is exact at algebra. When they disagree about whether a line
  keeps the same value, SymPy wins.

### The key idea: the "reference solution package"
When a problem loads, Gemini writes one JSON "package": every step of the solution, with a rule
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
| 3 | `lib/prompts.ts` | The instructions we give the AI. Plain English, worth reading. |
| 4 | `lib/presolve.ts` | Gemini writes a package, SymPy verifies it. |
| 5 | `lib/checkStep.ts` | Gemini (fast model) judges a step, SymPy can overrule it. |
| 6 | `lib/checkWork.ts` | Check my work: Gemini marks a whole solution, SymPy finds slips it missed. |
| 7 | `lib/readPhoto.ts`, `lib/similar.ts` | Reading photos (vision) and writing similar problems. |
| 8 | `app/api/*/route.ts` | Thin wrappers that turn web requests into calls to the files above. |
| 9 | `app/page.tsx` | Top of the UI: start screen or session. |
| 10 | `components/StartScreen.tsx` | Start screen + "Upload a photo", "Type it" and "Practice" dropdowns. |
| 11 | `components/Session.tsx` | The session: all the state for every mode and the finish board. |
| 12 | `components/Board.tsx`, `WorkBoard.tsx` | The chalkboard; WorkBoard is its Check my work version. |
| 13 | `components/Tex.tsx`, `MathInput.tsx` | Math display (KaTeX) and math typing (MathLive). |
| 14 | `lib/useVoice.ts`, `components/MicButton.tsx` | Think-aloud: push-to-talk (button or space) and the mic's 6 states. |
| 15 | `lib/recorder.ts`, `lib/speechToMath.ts` | Recording a clip, and Gemini turning it into words + LaTeX + what you want. |
| 16 | `lib/speak.ts` | The tutor's voice, and turning LaTeX into words ("x squared over 2"). |

**Smaller helpers:** `lib/gemini.ts` (the Gemini client: which models to use, JSON replies, and automatic fallback to another model when one is busy), `lib/sympy.ts` (calls the Python
checker), `lib/routeHelpers.ts` (friendly error messages), `lib/presets.ts` (the 6 demo problems),
`lib/attempts.ts` (logs every attempt in your browser for the future Skills dashboard),
`lib/photo.ts` (shrinks a photo in the browser and sends it), `lib/packages.ts` (remembers solution
packages in the browser so pre-solving can start early),
`components/Logo.tsx`, `types/math-field.d.ts` (tells TypeScript about MathLive's `<math-field>` tag).

**Data and scripts:**

| File | What it's for |
|------|---------------|
| `data/preset-list.json` | The 6 demo problems: id, tag, LaTeX, and the text sent to the AI. |
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
3. `lib/checkStep.ts` asks **Gemini's fast model**: what did they write (in SymPy form), is it correct, which
   reference step does it match, where is the mistake, and what hint to give.
4. It then asks **SymPy** whether your line has the same value as the problem (for integrals, "same up
   to + C"). If the AI and SymPy disagree on the algebra, SymPy's answer is used.
5. A fixed rule catches a missing **+ C** on indefinite integrals.
6. Back in the browser: correct → the line moves up the board with a ✓. Wrong → pink ring + hint.
   After a second miss, the fix is written in teal.

### How Check my work works (Mode B)
1. Your lines come from typing (one per line) or from a photo: the browser shrinks the photo
   (`lib/photo.ts`), and `/api/read-photo` asks **Gemini** to copy each handwritten line *exactly*,
   mistakes included. You can tap any line to fix a misread before checking.
2. `/api/check-work` → `lib/checkWork.ts` asks **Gemini** to mark the solution: is each line OK, which
   is the *first* wrong line, what went wrong, and what the line should have been.
3. **SymPy** then re-checks every line it can. If the AI flagged a line whose value SymPy proves is
   fine, that flag is dropped. If SymPy proves a line changed value and the AI missed it, that line
   becomes the slip. The + C rule runs last.
4. The board shows ✓, the pink ring + teal fix on the slip, and fades everything after it.
   "Redo step n myself" puts your correct lines into Step practice and lets you continue from there.

### How Think-aloud works (Mode D)
Think-aloud is Step practice with a microphone in front and a voice after it. It uses the same
state and the same `/api/check-step` as typing.
1. **Record:** hold the mic button or space (`lib/useVoice.ts`); a quick tap means "keep listening
   until I tap again". `lib/recorder.ts` records with the browser's `MediaRecorder` and converts the
   clip to a small WAV file (16 kHz, mono), a format every Gemini model accepts. Clips stop at 15 s.
2. **Listen:** `/api/speech-to-math` → `lib/speechToMath.ts` sends the audio plus context (the
   problem, the last lines on the board) to **Gemini's fast model**, which returns what you said, the
   math as LaTeX, what you want (`step`, `why`, `choose`, `show_fix`, `hint`, `other`), and
   "Did you mean…?" alternatives when the math could be read two ways.
3. **Do it** (`handleClip` in `Session.tsx`): a step is checked like a typed one. Correct → a quiet ✓
   (no talking, to stay fast). Wrong → the pink ring, and the hint is shown *and* spoken. "Why?" goes
   to `/api/why` and the answer is read out. Hint / show the fix work like the buttons.
4. **Speak:** `lib/speak.ts` uses the browser's built-in voice (`speechSynthesis`). If the server has
   an `ELEVENLABS_API_KEY`, it tries `/api/tts` first and falls back to the browser voice on any error.
   `latexToWords()` turns math into speech: `\frac{x^2}{2}` → "x squared, over 2".
5. **Read aloud** in Walkthrough reads each step with the same voice, with no AI calls; autoplay
   waits for each step to be read.

### How the board animates (Phase 4)
Everything lives in `components/Board.tsx` and the "Phase 4" block of `app/globals.css`.
1. **Ink:** the current line has the CSS class `ink`, a short fade with a slight lift. The line is
   keyed by its step number, so it appears again only when a new step arrives, not while typing.
2. **Glide between steps (FLIP):** every visible line has `data-n` = its step number. After each
   step change, `Board` measures where each numbered line is now, compares it to where it was
   (saved in the `spots` ref), and plays a transform from the old spot and size to the new one. So
   the line you just finished floats up and shrinks into the stack, and older lines slide up.
3. **The answer:** in Walkthrough the last step gets `final: true`: teal ✓ badge, teal frame that
   glows (`.answer-frame`), "← the answer!" and a puff of chalk dust (`ChalkDust`, CSS `.dust`).
   The summary stamps "Solved!" and boxes the answer the same way.
4. **Marks:** the ✓ path has `pathLength=1`, so the CSS can "draw" it; the pink ring is a `::after`
   outline that pops in; a wrong line shakes.
5. `prefers-reduced-motion` turns it all off.
6. **Entrance (Phase 6):** `Board` wraps the surface in `.board-drop` (unrolls from the rail) and is
   "fresh" for 1.6 s so step 1 waits; the tray has `.tray-in`; the finish rows get `.row-in` with a
   growing `animationDelay`. All the timings live in the "Phase 6" block of `globals.css`.

### Home screen and summary sizing
- `DemoBoard` (in `StartScreen.tsx`) is the real `Board` fed a saved solution, advancing one step every
  2.6 s.
- Each choice opens a `Sheet`: a fixed, centered panel over a blurred backdrop, so the page never moves.
  Inside, `ModeCards` shows the work modes as big cards. `ChalkBackdrop` draws the floating doodles.
- `fill()` (in `Session.tsx`) draws the summary at 30 px, measures it, and scales the font so the
  lines fill the left half and the answer fills the right half.

### Protecting the demo (Phase 5)
- **Rate limiting:** every AI route starts with `rateLimit(req, "heavy" | "light")` from
  `lib/rateLimit.ts`. It remembers when each IP address made its recent requests and answers
  "slow down" (HTTP 429) past the per-minute or per-day limit, before any AI is called.
- **Friendly errors:** `messageOf()` in `lib/errors.ts` turns browser network errors into a sentence.
- **Phones:** Tailwind's `md:` prefix means "from 768 px wide up", so classes without it are the phone
  look (e.g. `px-3 md:px-10`). The tray is a sideways scroll strip with snap points on phones and a
  3-column grid on desktop; `TrayTabs` in `Session.tsx` drives it.

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
- **Schema (zod):** a description of a data shape, used to force the AI's reply into that exact shape.
- **Structured outputs:** Gemini is *required* to return JSON matching the schema (`responseJsonSchema`), and we double-check the shape with zod.
- **Fallback:** if a free-tier model is busy or slow, `lib/gemini.ts` quietly retries the request on the next model in its list.
- **Implicit caching:** Gemini automatically reuses work when requests start with the same text (our instructions + the package), which makes repeat checks faster and cheaper.
- **Tailwind classes:** styling shortcuts in `className` (`rounded` = rounded corners, `px-4` =
  horizontal padding, `bg-panel` = our panel color from `globals.css`).
- **Canvas:** an invisible drawing surface in the browser; we draw the photo on it smaller and save it as a JPEG.
- **Custom hook (`useVoice`):** a function starting with `use` that bundles state + effects so a component can reuse them.
- **MediaRecorder / getUserMedia:** the browser's microphone access (it asks permission once) and recorder.
- **speechSynthesis:** the browser's built-in text-to-speech voice; free and offline.
- **Pointer events:** one set of events for mouse, touch and pen (`onPointerDown` / `onPointerUp`), used for hold-to-talk.
- **Base64 / data URL:** a way to write a file (like a photo) as plain text, so it can travel inside JSON.
- **CSS animation / @keyframes:** a named list of looks over time (e.g. hidden → shown) the browser plays on an element.
- **Web Animations API (`element.animate`):** the same thing started from JavaScript, used when the motion depends on measured positions.
- **`useLayoutEffect`:** like an effect, but runs right after the page updates and before it's painted, so we can measure and animate without a flicker.
- **clip-path:** shows only part of an element (used for the board unrolling from the rail).
- **FLIP animation:** First (old position), Last (new position), Invert (jump back with a transform), Play (animate to none). How lines glide between steps.
- **`overflow-x: clip`:** cuts off only the sides of a box, so tall math (fractions, integrals) is never cut at the top or bottom.
- **Board font:** `--font-chalk` in `globals.css` (Patrick Hand) replaces KaTeX's letters and digits on the board; KaTeX keeps its own big symbols (∫, Σ, brackets).
- **Responsive design / breakpoints:** one page that rearranges itself by screen width (`md:` = 768 px and up).
- **Rate limit / HTTP 429:** a cap on requests per visitor; 429 is the standard "too many requests" status.
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
| `npm run presets` | Re-generates the 6 demo solutions (needs `npm run dev` running; uses 6 big AI requests). |
| `npm run test:steps` | Runs the 14 sample step checks (needs `npm run dev`; 14 AI requests). |
| `npm run test:work` | Runs the 9 sample Check my work solutions (needs `npm run dev`; 9 AI requests). |
| `.venv\Scripts\python api\check.py` | Runs the SymPy self-tests. |

---

## 6. VS Code tips

- **`Ctrl+P`**, then type a file name: jump to any file.
- **`Ctrl+Click`** a function name: jump to where it's defined.
- **Hover** over a name: shows its type and documentation.
- **Source Control** (`Ctrl+Shift+G`): see exactly what changed since the last commit.

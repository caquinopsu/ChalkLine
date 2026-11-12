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

## Phase 2: Vision + Check my work + similar problem ✅ (Nov 11, 2026)
- **Upload a photo** (`/api/read-photo`, Sonnet vision): camera or photo library on a phone, file picker,
  drag-and-drop or Ctrl+V on a laptop. The browser shrinks the photo to 1568 px first. Shows
  "We read this as" + Edit / Retake photo, and pre-solving starts as soon as the problem is read.
  Photos are never stored.
- **Check my work (Mode B)** (`/api/check-work`): type a solution line by line or photograph it
  (lines can be edited before checking). Sonnet marks it, SymPy re-checks each line and can overrule,
  plus the + C rule. Board: ✓ lines, first slip ringed in pink with the teal fix, later lines faded.
  Tray: First slip + Why?, tally, **Redo step n myself** (Step practice from there, with your correct
  lines kept), **Show me the rest** (Walkthrough), Resubmit.
- **Give me a similar problem** (`/api/similar`): Sonnet writes a new problem with the same technique,
  it is pre-solved and only shown if SymPy rejects none of its lines (about 15-20 s). Pick a mode and it
  starts instantly.
- `npm run test:work`: 9/9 sample solutions get the first slip on the right line (or no slip).
- Tested with generated textbook and handwriting images; real phone photos still to be tested by hand.

## Switch to Google Gemini ✅ (Nov 11, 2026)
- Every AI call now uses Gemini (`GEMINI_API_KEY`); the Anthropic SDK and key are no longer used.
- `lib/gemini.ts`: SMART = Gemini 3.6 Flash (photos, pre-solving, Check my work, similar, Why?),
  FAST = Gemini 3.5 Flash-Lite (step checks). Replies are forced into our zod schemas as JSON.
- Free-tier models are sometimes busy (503) or slow (504), so each request automatically falls back
  to the next model in its list. 3.7 / 3.8 Flash timed out on this key, so they aren't used.
- Re-tested on Gemini: step checks 14/14, Check my work 9/9, photo reading, pre-solve (all lines
  SymPy-confirmed), similar problems, Why?. Step checks now take about 1-3 s.
- The 6 preset solutions were made by Claude earlier; they're saved files and still work as-is.

## Phase 3: Think-aloud voice (push-to-talk) 🟡 built, live test pending (Nov 12, 2026)
Plan: `docs/phase3-plan.md`. ElevenLabs is blocked (401), so Gemini listens and the browser speaks.
- **Think-aloud (Mode D):** hold space or the mic (or tap to start / tap to stop, max 15 s). The clip
  is converted to WAV in the browser and sent to `/api/speech-to-math` (Gemini FAST), which returns
  the transcript, the LaTeX, the intent and "Did you mean…?" alternatives.
  - step → `/api/check-step`. Correct = silent ✓. Wrong = pink ring + the hint shown and spoken.
  - why → `/api/why`, answer shown and spoken. hint / show the fix / "the first one" work by voice.
  - Ambiguous math → "Did you mean…?" (click, keys 1/2, or say "the first one").
  - Mic with 6 states (idle, listening + level waveform, writing, checking, tutor speaking, error),
    the words always shown under the line on the board and in the Heard card.
  - Header chip: solid gold "Think-aloud" with a live dot and a timer. "Type instead" switches to
    Step practice on the same step (and the chip switches back).
  - Solving the last step by voice ends with a spoken "Nice work".
- **Where voice appears:** "Talk it through" on the start screen (say the problem → typeset →
  Start solving out loud), "Talk it through" in Practice's "Start as" row, and the mode chip.
- **Read aloud** in Walkthrough: browser voice reads each step (rule, the math in words, summary);
  autoplay waits for it. No AI calls.
- **Speaking:** `lib/speak.ts` (browser voice + LaTeX → words). Optional `/api/tts` (ElevenLabs,
  "Rachel" voice) is used only if `ELEVENLABS_API_KEY` is set; any error falls back to the browser voice.
- **Fallbacks:** mic blocked / missing / unsupported → message + "Type instead". Gemini busy → friendly
  error in the mic area, retry or type.
- **Tested (free checks only):** `tsc`, lint, build; a browser run with a fake microphone and the AI
  routes mocked: hold-to-talk, tap mode, Did you mean + key 1, silent ✓, spoken hint on a wrong
  step, why, hint, show the fix, "other", solving to the finish, Read aloud + autoplay, the Talk
  panel, and a blocked mic. Clips arrive at the server as `audio/wav`.
- **Not yet tested:** the live Gemini batch (about 5-8 requests: a few spoken steps, one "why?", one
  ambiguous phrase), waiting for the Gemini key. Not merged to `main` yet (lives on branch
  `claude/ecstatic-franklin-lcuuk5`).

## Next
Phase 3 live test with the Gemini key (a few real spoken steps, one "why?", one ambiguous phrase),
then merge to `main`. After that: Phase 4, the visual engine.

## Known issues
- Think-aloud hasn't heard a real voice yet (live Gemini test pending). Speech-to-LaTeX quality and
  speed (~2 s expected) still need confirming, especially on Safari/iPhone.
- The browser voice differs per browser and computer (Chrome's "Google US English" is the best we pick).
- Space starts the mic anywhere on the Think-aloud screen except inside a text/math box.
- MathLive's typing shortcuts (`^`, `/`) weren't testable by automation; check them by hand.
- Series problems (ratio test) are judged by the AI alone for most lines (SymPy can't compare them).
- No rate limiting yet (Phase 5). On Gemini's free tier there is no cost, but there are request
  limits per minute and per day (shown in Google AI Studio), and Google may use free-tier data to
  improve its products.
- Free-tier models were often busy during testing (the fallback handled it, but it can add
  10-45 s to a request). If that hurts the demo, enabling billing on the Gemini key fixes it.
- Real phone photos (glare, slanted pages, messy handwriting) not tested yet; generated images read perfectly.
- Layout is desktop-first; phone layout comes in Phase 5.
- `/api/check` has no rate limiting, and a deliberately huge expression could be slow (8 s cap per comparison).

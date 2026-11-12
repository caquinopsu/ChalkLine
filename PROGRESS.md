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

## Phase 3: Think-aloud voice (push-to-talk) ✅ (Nov 12, 2026)
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
- **Live Gemini test (7 requests, clips made with the Windows voice):** every clip heard right in
  1.1-1.8 s (4.3 s for a spoken problem). A correct by-parts setup passed, a wrong step got a hint,
  "why do we pick u as ln x?" became a why question, and "one over two x" offered 1/(2x) or (1/2)x.
  Fixed: Gemini sometimes doubled backslashes (`\\ln`); `lib/speechToMath.ts` now repairs them.
- Merged to `main` from the cloud session's branch `claude/ecstatic-franklin-lcuuk5`.

## Phase 4: Visual engine ✅ (Nov 12, 2026)
All motion is in `components/Board.tsx` + `app/globals.css`; no AI calls, works in every mode.
- **Ink reveal:** each new step writes in left to right (0.6 s). Typing doesn't re-ink.
- **Carry-over slide (part matching):** when a step finishes, each colored part (`role-a/b/c`) of
  the line that just moved up flies into the same-colored part of the new line (e.g. by parts:
  `ln x` and `x dx` slide into `x²/2 · ln x`). Works with the parts the pre-solve already colors.
- **Shrink-on-arrival:** older lines ease down to their smaller size instead of jumping.
- **Highlights:** colored parts glow once when a line arrives, and pulse while the tutor is speaking
  (Read aloud, spoken hints, "why?").
- **Rule tags:** in Walkthrough a gold Caveat label points at the line ("← Integration by parts").
- **Marks:** ✓ draws on and pulses; the pink ring draws on around the wrong part and the line shakes;
  in Check my work the teal fix writes in after the ring.
- **Reduced motion:** all of it switches off when the system asks for less motion.
- Checked in the browser on the by-parts preset (ink, slide, tag, ring). Skipped for time (could add
  later): cancellation strike-throughs, side work folding in/out, word-by-word speech sync.

## Phase 5: Judge-readiness ✅ (Nov 12, 2026)
- **No login:** works in a private window (nothing is stored on the server; no accounts).
- **Rate limiting (`lib/rateLimit.ts`):** per visitor (IP address), on all 8 AI routes.
  Heavy routes (pre-solve, photos, Check my work, similar): 6 a minute, 60 a day. Light routes
  (step checks, why?, voice, tts): 30 a minute, 500 a day. Over the limit = a friendly message.
  Kept in server memory (no database), so it's a speed bump: Vercel's separate server copies each
  count on their own and forget on restart. Tested with empty requests (no AI used): 7th = 429.
- **Error states:** network drops and odd server replies become plain sentences (`lib/errors.ts`);
  a problem that fails to prepare shows **Try again** / **New problem** instead of a dead end. The
  mic-blocked / unclear-audio / busy-AI messages with "Type instead" came with Phase 3.
- **Phones (under 768 px):** smaller margins and headings; the board's big line shrinks further;
  the start-screen dropdowns open as full-screen sheets with a Close button; the three tray cards
  become a swipeable strip with **Focus / Controls / More** tabs, opening on the middle card (the
  input, the mic or the play buttons); the Why?/Side work panel covers the board; the finish board
  stacks. Uses `100dvh` so phone browser bars don't cut off the tray.
- Checked at 375×812 in the browser: start screen, demo sheet, Walkthrough and Step practice fit with
  no sideways scrolling; the tray tabs work. Not checked on a real phone yet.

## Phase 6: Design polish ✅ (Nov 12, 2026)
- **Entrance motion (DESIGN.md section 10):** the board unrolls down from the rail when a problem
  opens, the problem is chalked into the header, the tray slides up, then step 1 writes in.
  Start-screen dropdowns unfold; the start screen fades up.
- **Finish:** the lines slide into one column one after another, then the boxed answer writes in.
- Fixed a stray sideways scrollbar on the finish board.
- **README.md** rewritten in the bootcamp format (Try it, How to test it with exact steps for judges,
  Track, How it works, Superpowers, Why it matters to me, Built with, Built by).
- Checked in the browser on the by-parts preset (all the entrance and finish animations run).
- Not done: the typing preview inking each new symbol (MathLive draws its own input).

## Polish pass ✅ (Nov 12, 2026)
- **Chalk handwriting for the math:** the board's letters and digits use Patrick Hand (clearer digits
  than Kalam, which was also tried); KaTeX keeps its own ∫, Σ, brackets and fraction bars.
- **Bigger handwriting:** step counter, rule tags, notes, line numbers, "next:" line and placeholders.
- **Step-to-step glide:** when you move to another step, the finished line floats up and shrinks into
  the stack and older lines slide up (replaces the colored-part copies). New math fades in softly.
- **Answer reached:** the last step turns teal (✓ badge, glowing frame, "← the answer!", chalk dust,
  status "solved ✓"); the summary stamps **Solved!** and boxes the answer.
- **No more clipped math:** tall math (fractions, limits) is no longer cut at the top or bottom; the
  problem in the header shrinks to fit instead of being cut.
- **Sizes:** summary lines much bigger (and the answer first on phones); Techniques card has larger
  chips plus what each step did; bigger tray text, labels and stats.
- Checked in the browser (desktop 1440×900 and phone 375×812) on the by-parts, partial-fractions
  and L'Hôpital demos. No AI calls.

## Home screen + summary sizing ✅ (Nov 12, 2026)
- **New home screen:** a live chalkboard plays the by-parts demo by itself (glide, colors, the answer
  moment; no AI), then the title, three equal cards with icons (Upload a photo, Type it, Talk it
  through with a SIGNATURE badge) and a **Try a demo problem** button. Removed the disabled
  My skills / History buttons. Phones skip the demo board.
- **No more jumping:** opening a dropdown no longer re-centers the page; the demo board rolls up
  smoothly (0.5 s) and the dropdown unfolds under its button.
- **Summary fills its space:** the steps scale up until they fill the left half (by width and height),
  and the boxed answer scales to fill the right half's width.
- Demo problem cards use the chalk font too.

## Next
Test by hand before submitting: a real voice (Chrome, then Safari/iPhone), a real phone, a private
window, and a real phone photo. Read the README's "How to test it" and fix anything that doesn't match.
Stretch if time allows: the Skills dashboard (knowledge tracing from the attempts already logged).

## Known issues
- Think-aloud was tested with computer-generated speech, not a real human voice or mic yet; check
  accents, background noise and Safari/iPhone recording by hand.
- The browser voice differs per browser and computer (Chrome's "Google US English" is the best we pick).
- Space starts the mic anywhere on the Think-aloud screen except inside a text/math box.
- MathLive's typing shortcuts (`^`, `/`) weren't testable by automation; check them by hand.
- Series problems (ratio test) are judged by the AI alone for most lines (SymPy can't compare them).
- Rate limiting is per server copy and in memory (see Phase 5). Gemini's own free-tier limits per
  minute/day still apply to everyone together, and Google may use free-tier data to improve its products.
- Free-tier models were often busy during testing (the fallback handled it, but it can add
  10-45 s to a request). If that hurts the demo, enabling billing on the Gemini key fixes it.
- Real phone photos (glare, slanted pages, messy handwriting) not tested yet; generated images read perfectly.
- `/api/check` has no rate limiting, and a deliberately huge expression could be slow (8 s cap per comparison).

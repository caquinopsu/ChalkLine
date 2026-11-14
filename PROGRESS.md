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
- **Speaking:** `lib/speak.ts` (browser voice + LaTeX → words). Optional `/api/tts` (Cartesia, Sonic 3.6
  model) is used only if `CARTESIA_API_KEY` is set; any error falls back to the browser voice. ElevenLabs was dropped (account blocked with 401).
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

## Read aloud in sync with the board ✅ (Nov 13, 2026)
- Walkthrough's **Read aloud** now reads each step in pieces and lights up what it's saying: the rule
  label, then the line part by part (each colored part, like $u$ or $dv$, gets a chalk highlight
  when it's named), then the "why" note. Earlier lines dim while it reads.
- `speakSequence()` in `lib/speak.ts` fetches the Cartesia pieces ahead, 2 at a time (the free plan's
  concurrency limit), so there are no gaps; any piece that fails is read by the browser voice.
  `/api/tts` has its own rate-limit budget (90/min) because one step is ~6 short requests.
- Tested in the browser with the real voice: all pieces 200, first sound after ~0.8 s, highlights
  in order rule -> line -> part a -> line -> part b -> note.

## Library complete + explain-don't-skip + why on the board ✅ (Nov 13, 2026)
- **The 4 missing library problems** (quotient rule, logarithmic differentiation, by parts twice,
  alternating series) are generated with `npm run presets -- <ids>`, checked by SymPy (3 of 4; the
  series one can't be) and proofread by hand. All 29 library problems now open.
- **"Stuck? Show me this step"** no longer skips ahead: the step is written on the board in gold with
  its rule and a "here's why" note under it. The student copies it, then presses **Got it, next step**
  (or types/says it back, or says "next" in Think-aloud, where the tutor also reads the explanation).
- **Why on the board:** in Walkthrough the explanation is now a gold-edged note right under the
  current line (it scrolls if long). The dock card below is just for follow-up questions.

## Voice pass 2: slips, commands, hands-free, guide ✅ (Nov 12, 2026)
- **Tutor voice:** Cartesia (Sonic 3.6) through `/api/tts` when `CARTESIA_API_KEY` is set (replaces
  ElevenLabs); the browser voice is still the fallback.
- **Filler words and slips:** the speech prompt drops "um/uh/so…", keeps only the corrected version
  after "no wait / I mean / sorry / actually", and still keeps real math mistakes.
- **Spoken commands:** "scratch that / undo / go back" (takes back a misheard line without counting
  a wrong try, or the last accepted line), "next / start" (starts solving from the Talk sheet, or
  takes the shown fix and moves on), "repeat that", "pause / stop listening".
- **Tap mode stops on silence**, and a new **Hands-free** switch keeps the mic open and sends a clip
  at each pause (thinking out loud gets no reply). Remembered per browser.
- **"How talking works" guide:** an accessible dialog under the mic (Talk sheet and Think-aloud).
- **Tested:** `tsc`, lint; a browser run with a fake mic and mocked AI routes (guide open/Esc/focus,
  Talk sheet "scratch that" and "next", Think-aloud wrong step → "scratch that" → ring gone and try
  given back, "repeat", hands-free switch). Live: 2 clips made with Cartesia: "So, um, I think it's
  x squared, no wait, x cubed over three, plus C" → `\frac{x^3}{3} + C`; "Hmm, okay, scratch that" → undo.
- **Not tested with a real microphone** in a real room (hands-free in a noisy room may pick up
  background talk; headphones help).

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

## Home screen, round 2 ✅ (Nov 12, 2026)
- **Large sheets instead of dropdowns:** each choice opens a big centered sheet (up to 1080 px wide)
  over a blurred page; nothing on the page moves, the demo board keeps playing behind it. Close with
  ✕, Esc or a click outside. Full-screen on phones.
- **Work modes are big cards:** Walkthrough, Step practice, Check my work and Talk it through, each
  with a colored icon, what it does, and a lift + glow + "Start →" on hover. Used in every sheet
  (Talk it through is now offered for typed, photographed and demo problems too).
- **Background design:** faint chalk math (∫ f(x) dx, d/dx, Σ 1/n², π, ∞…) floating slowly in the
  margins, two soft colored lights, and a gold glow behind the title. Bigger sizes on very wide screens.
- Checked at 1440×900 and 375×812. No AI calls.
- Follow-up: bigger demo problems (34 px chalk math, larger topic chips), bigger section labels and
  mode-card text, and sheets now animate out (fade + fold up, 0.22 s) instead of vanishing.

## Design pass 3 ✅ (Nov 12, 2026)
- Home screen never scrolls (the demo board shrinks on short screens; checked at 1366×768).
- Pop-ups: round ✕ close button that turns on hover.
- Tray: one rounded "dock" with three sections and a thin mode-colored line on top (phones keep cards).
- Walkthrough: big ‹ › arrows on the board's left and right edges, ← → keys, and step dots under the
  play button (click a dot to jump). Phones keep the arrows in the tray.
- Math notation: `mathify()` in `components/Tex.tsx` typesets plain-text math the AI left outside
  $...$ ("u = ln x", "(x-1)", "a = 1"); the prompts now ask for all math in $...$.

## Worksheets and staying on the board ✅ (Nov 12, 2026)
- **Problem sets from one photo:** `/api/read-photo` now returns every part on the page (`parts`, each
  with its label) and the shared `instructions`. The Upload sheet shows "We found 4 parts", the
  instructions and each part as a chalk card; pick one to start.
- **Instructions reach the AI:** `/api/presolve` takes an optional `task`, so "f(x) = 1/x, a = 1" is
  solved as "find the Taylor series", not guessed. The board shows the instructions above the problem.
- **Part chips** in the header (a b c d): gold = open, teal ✓ = solved; click to switch. The summary's
  main button becomes **Next: part c →** (the next unsolved part). The next part starts solving in
  the background as soon as you open one, so moving on is instant (one extra AI call per part).
- **New problem stays in the session:** the button opens a sheet over the board with Upload a photo
  (default), Type it, Talk it through and Demo problem tabs. The logo still goes to the start screen.
- Tested: 1 live photo read of a 4-part Taylor series worksheet (all 4 parts + instructions, 4.6 s);
  the rest of the flow in the browser with that reply replayed and pre-solving mocked (no AI).
- Live solve of part a (1/x at a = 1): first try was correct but only 2 steps (jumped to the answer).
  The pre-solve instructions now require at least 3 steps, no jumps, doing the worksheet's task, and a
  5-step recipe for Taylor series. Re-run: 5 steps (derivatives, n-th derivative pattern, value at 1,
  plug in, simplify), correct. SymPy can't compare infinite sums, so those lines are judged by the AI.
- Not yet: progress inside a part isn't kept when you switch parts (you restart at step 1); the
  solved ✓ marks reset on reload.

## Design pass 5: notebook paper + clean fonts ✅ (Nov 12, 2026)
Picked from screenshot mockups (palettes and font sets were compared outside the app, not built in):
- **Colors:** warm notebook-paper page (`#f3eee3`), cream-white cards, ink-brown text, deeper
  gold/teal/blue/pink so they read on a light page. The board is a softer green in a light **oak frame**.
- **Board keeps chalk colors:** inside `.board-surface` (and the mode cards) the color tokens switch
  back to the bright chalk versions, so the board looks the same whatever the page around it is.
- **Fonts:** DM Sans for every heading, label and note (no more handwriting fonts); board math uses
  KaTeX's own textbook fonts with italic variables.
- Inputs and the math field are white; the dark hard-coded colors are gone.

## Design pass 4 + problem library ✅ (Nov 12, 2026)
From the design critique (reviewer pass) and the user's 10 notes:
- **Home:** the "Calculus I & II · free · no sign-up" line and the SIGNATURE badge are gone. "Try a
  demo problem" became a **Problem library** card listing the topics.
- **Mode cards** are mini chalkboards with a chalk sketch of each mode that redraws on hover, a
  handwritten title and a ledge with "start →". Before a problem is ready they say "waiting…"
  instead of looking dimmed and broken.
- **Labels** in the dock and sheets are short lowercase notes instead of monospace capitals (now DM
  Sans, see Design pass 5).
- **Walkthrough dock:** the unlabeled middle card (autoplay + read aloud) is gone; those are now
  labeled toggles ("play", "read aloud") in the board's header. The left of the dock is now the
  **Why** explanation, always open, in full-strength text with a gold margin line and a follow-up box.
  The right is a small chalkboard: step dots and **I'll write step n**.
- **Why / Side work panel** (other modes): solid background (the board no longer shows through),
  handwritten heading, readable text.
- **Task beside the problem:** every solution now has a `task` ("Find the antiderivative."), written
  in gold before the problem on the board (worksheet instructions take priority).
- **Summary:** each line gets a `// takeaway` comment beside it, aligned like code comments, written
  in after the answer lands. The dock lists techniques and the numbered steps (rule · takeaway) in two
  columns, matching the board's numbers. The "5 steps" stat and the duplicate New problem button are
  gone; there's "Now solve it yourself", a similar problem, and "More … problems in the library".
- **Problem library** (new screen): 29 solved problems in 6 areas with technique, difficulty (●●○)
  and ✓ when solved. **Picked for you** = version 1 of the recommender: counts the steps you missed
  per technique (from the attempt log already kept in the browser) and recommends problems for your
  worst ones. Documented as the stand-in for a trained model (knowledge tracing) later.
- Phone layout set aside on purpose (laptop and iPad first).
- Library solutions were generated with `npm run presets` (one AI call per problem, once).

## Next
Test by hand before submitting: a real voice (Chrome, then Safari/iPhone), a real phone, a private
window, and a real phone photo. Read the README's "How to test it" and fix anything that doesn't match.
Stretch if time allows: replace the counting recommender with knowledge tracing (a trained model on
the attempts already logged). Step practice: type the step on the board itself instead of in the dock.

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

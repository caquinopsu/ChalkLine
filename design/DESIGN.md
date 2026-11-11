# Chalkline design spec (v2 · static board)

This is the UI design for Chalkline, made in Claude Design. It describes what the app
should look like and how the screen behaves, and maps every visual element to the data
contracts in `PLAN.md` section 5.

**Live mockup (the source of truth for looks):**
https://claude.ai/artifact/JwxFTYDfnwtq8TbwnZsArg (open the page "v2 · Static board")

**Reference screens:** `design/screens/*.html`, one file per mockup frame (A–K below).
They are exported from the design canvas and depend on its runtime (`support.js`,
`<x-dc>` tags), so they won't render on their own and must **not** be imported into the
app. Read them for exact colors, sizes, spacing, copy and structure, then rebuild them as
React components with Tailwind.

## How to use this spec (for Claude Code)

- Follow `CLAUDE.md` and the phases in `PLAN.md`. This spec doesn't change the phase order.
- **Phases 1–3:** build the screen structure from this spec from the start: the
  start screen, the board + tray session shell, and the shrink-to-fit step rule. Getting
  the structure right early means Phase 6 is a restyle, not a rebuild. Plain styling is fine
  until then.
- **Phase 4 / Phase 6:** apply the tokens and the motion list (section 10).
- If something here conflicts with `PLAN.md`, `PLAN.md` wins on behavior and this
  spec wins on layout and looks. Flag the conflict to the user in one line.

---

## 1. Design principles

1. **One fixed screen, no page scroll.** Every view fits the viewport, like a real
   classroom board. Nothing in the main flow scrolls.
2. **The board holds math only.** Steps, small ✓/⚠ marks, error rings, written
   fixes, and short handwritten notes. Nothing else.
3. **One focus at a time.** Only the current step is big. Its rule name, "Why?",
   side work, hints and tutor messages appear once, in the **tray** under the board,
   never repeated on every line.
4. **Older steps shrink, then fold away.** The eye always has one place to land.
5. **Color always means the same thing** (section 2).

---

## 2. Tokens

### Colors

| Token | Hex | Use |
|---|---|---|
| `room` | `#111419` | App background around the board |
| `panel` | `#1A1F26` | Tray cards, dropdown panels |
| `panel-2` | `#20262E` | Buttons/cards inside panels |
| `panel-3` | `#262D36` | Active/open button state |
| `line` | `rgba(236,232,221,.09–.18)` | Borders (0.09 cards, 0.18 buttons) |
| `text` | `#ECE8DD` | UI text |
| `muted` | `#A3ACB6` | Secondary text (passes 4.5:1 on `panel`) |
| `subtle` | `#7F8893` | Tertiary labels only |
| `board` | `#1C2624` | Slate board surface |
| `wood` | `#3A2F27` | Rail and board frame |
| `ledge` | `#4A3C31` | Chalk ledge under the board |
| `chalk` | `#EDEAE0` | Math on the board |
| `blue` | `#58C4DD` (`#6CCDE3` on the board) | First role: *u*, *du*; listening state |
| `gold` | `#F2C94C` | Second role: *dv*, *v*; hints/warnings; primary buttons |
| `teal` | `#4FD1B5` | Correct ✓, written fixes, constants that matter; tutor speaking |
| `pink` | `#FF7A85` | Errors: ring, error badge |

Tints: use the accent at 12–13% alpha for chip/icon backgrounds (e.g.
`rgba(88,196,221,.13)`), and at ~6% for the current-step block background.

Primary button: gold background, `#14181D` text. Secondary button: transparent,
`line` border, `text` color.

### Tailwind 4 starting point (`app/globals.css`)

```css
@theme {
  --color-room: #111419;
  --color-panel: #1A1F26;
  --color-panel-2: #20262E;
  --color-panel-3: #262D36;
  --color-text: #ECE8DD;
  --color-muted: #A3ACB6;
  --color-subtle: #7F8893;
  --color-board: #1C2624;
  --color-wood: #3A2F27;
  --color-ledge: #4A3C31;
  --color-chalk: #EDEAE0;
  --color-blue: #58C4DD;
  --color-blue-chalk: #6CCDE3;
  --color-gold: #F2C94C;
  --color-teal: #4FD1B5;
  --color-pink: #FF7A85;
  --font-display: var(--font-space-grotesk);
  --font-sans: var(--font-inter);
  --font-hand: var(--font-caveat);
  --font-mono: var(--font-jetbrains-mono);
}
```

### Fonts (load with `next/font/google`, replacing Geist)

| Role | Font | Where |
|---|---|---|
| Display | Space Grotesk 600/700 | Logo, page titles |
| UI | Inter 400/500/600 | Everything else in the chrome |
| Math | KaTeX's default fonts | All math (the mockup used STIX Two Text as a stand-in) |
| Board handwriting | Caveat 500/600 | Short notes on the board: "step 3 of 4", "keep the ½", "which one? ↓" |
| Labels | JetBrains Mono 500 | Step numbers, timers, "STEP 3 · FOCUS" eyebrows, kbd hints |

### Shape

Radii: buttons 12px, tray cards 16px, dropdown panels 20px, featured button 22px,
pills 999px. Minimum touch target 44px.

### Board texture

The board surface is `board` plus two tiny dot layers of chalk dust:

```css
background-color: #1C2624;
background-image:
  radial-gradient(rgba(236,232,221,.045) 1px, transparent 1.3px),
  radial-gradient(rgba(236,232,221,.03) 1px, transparent 1.3px);
background-size: 5px 5px, 11px 11px;
background-position: 0 0, 3px 6px;
box-shadow: 0 24px 50px rgba(0,0,0,.5), inset 0 0 90px rgba(0,0,0,.4);
```

Frame: a 12px `wood` border on the left, right and bottom (none on top, because it hangs from
the rail). Under it, an 18px `ledge` strip with 2–3 small chalk-stick shapes (decorative).

---

## 3. Screen geometry (designed at 1440×900)

### Start screen (frames A–D)

- Header, 72px: logo (left), "My skills" and "History" buttons (right).
- **Rail:** a 16px `wood` bar under the header, inset 80px from each side, with a small
  pull tab in the center. The board is "rolled up" in it.
- Centered stack: title "What are we solving today?" (Space Grotesk 56px), tagline
  "See the math move." (italic, `#C9C3B5`), then the action row, then Practice.
- **Action row:**
  - "BRING A PROBLEM" eyebrow above one grouped container (`panel`, radius 18) holding
    two 230×64 buttons, **Upload a photo** and **Type it**, each with a chevron.
  - "or"
  - **Talk it through:** the featured 96px-tall button with a gold border, soft gold glow,
    a 60px gold mic circle, a "SIGNATURE" pill, and the subtitle "Say the problem, solve it on
    paper, out loud". It starts Think-aloud.
- **Practice · demo problems:** a small secondary button under the row.
- Footer: "Hold space anywhere to start talking".

### Session screen (frames F–K): board + tray

```
┌ header 64px ───────────────────────────────────────────────┐
│ logo · mode chip · (timer)                  New problem/End│
├ rail 12px ─────────────────────────────────────────────────┤
│┌ board (fills remaining height, ~560px) ──────────────────┐│
││ problem (28px)                          Caveat status    ││
││ ─────────────────────────────────────────────────────────││
││ [collapsed earlier steps]                                ││
││   2   older step (22px, 45% opacity)                ✓    ││
││   3   previous step (28px, 70%)                     ✓    ││
││ (4)  CURRENT STEP (48–50px)                       mark   ││
││      Caveat ghost: "next: …"                             ││
│└──────────────────────────────────────────────────────────┘│
│ ledge 18px                                                 │
├ tray ~200px: 3 equal cards, gap 16 ────────────────────────┤
│ [Focus card]        [Controls card]        [Tutor/side card]│
└────────────────────────────────────────────────────────────┘
```

- Page: `h-screen overflow-hidden`, 40px side margins.
- Board padding: 24px top/bottom, 56px left/right. The step stack is vertically centered.
- Tray: `grid grid-cols-3 gap-4`, cards `panel` with radius 16 and padding 18×20.
- **Smaller laptops (1280×720):** the tray shrinks to ~170px. Step sizes scale
  with `clamp()`. The board takes whatever height is left.
- **Mobile (Phase 5, not designed yet):** keep the no-scroll rule. Proposal: the board
  fills the screen, and the tray becomes a bottom sheet with three tabs (Focus /
  Controls / Tutor). The mic stays visible at all times.

---

## 4. Frames (reference screens)

| Frame | File | What it shows |
|---|---|---|
| A | `A-start.html` | Start screen, resting |
| B | `B-upload-open.html` | Upload dropdown open: photo → "We read this as" → pick a mode |
| C | `C-type-open.html` | Type dropdown open: input, live preview, math keys, pick a mode |
| D | `D-practice-open.html` | Practice dropdown: the 6 PLAN.md preset problems + "Start as" |
| E | `E-board-drop.html` | Transition: the board rolling down (motion reference only) |
| F | `F-walkthrough.html` | Mode A, Walkthrough, step 3 of 4 |
| G | `G-step-practice.html` | Mode C, your turn at step 4, with the collapsed earlier-steps line |
| H | `H-check-my-work.html` | Mode B, first error ringed in pink, teal fix written beside it |
| I | `I-think-aloud.html` | Mode D, listening, ambiguous speech → "Did you mean…?" |
| J | `J-think-aloud-error.html` | Mode D, wrong step: pink ring + gold "?" hint, tutor speaking |
| K | `K-solved.html` | Finish: whole solution in a tidy column, boxed answer, summary in the tray |

---

## 5. Start flow

1. **Upload a photo** and **Type it** are buttons, not tabs. Clicking one opens a
   dropdown panel (760px wide, anchored under the button group) and dims everything else
   to 40% opacity. Clicking the button again closes it.
2. **Upload panel:** photo thumbnail → dashed arrow → "WE READ THIS AS" + typeset problem,
   with **Edit** and **Retake photo** on the right. Then: "Looks right? Pick how you want to
   work on it." and three mode buttons: **Walkthrough**, **Step practice**, **Check my
   work**.
3. **Type panel:** a text/LaTeX input with a live KaTeX preview beside it, a row of
   math keys (∫ √ xⁿ a⁄b π ∞ Σ ln sin lim), then the same three mode buttons.
4. **Picking a mode is the confirmation** (PLAN.md section 3, step 2). There's no separate Confirm
   button. Start pre-solving as soon as the typeset problem is shown.
5. **Talk it through** goes straight to Think-aloud: the board drops down, the user says
   the problem, it's shown as typeset math with the same "Did you mean…?" pattern, and
   then they start solving.
6. **Practice** opens a panel with the 6 preset problems from PLAN.md Phase 1 (L'Hôpital
   limit, chain rule, u-sub, by parts, partial fractions, ratio test) as cards with a
   topic tag. Under them: **Start as:** Talk it through · Walkthrough · Step practice ·
   Check my work.
7. After a mode is picked, the board drops down from the rail (frame E). The header
   **mode chip** stays clickable so the user can switch modes mid-problem (PLAN.md
   section 3).

---

## 6. The board

### Step stack (shrink-to-fit)

Visible, top to bottom:

1. **Collapsed line** (only when there are more than 2 finished steps): a dashed pill
   `⌃ N earlier steps · <first step in small math> ✓`. Clicking it expands the hidden
   steps as an overlay over the top of the board. Clicking again folds them back. It never
   pushes the layout or scrolls.
2. **Two back:** 22px, 45% opacity, small status mark.
3. **Previous:** 28px, 70% opacity, status mark.
4. **Current:** 48–50px, full opacity, inside a block with a ~6% tint (radius 14,
   padding 18×24, pulled 24px left), with a 34px numbered badge whose color shows the
   state:
   - gold: Walkthrough
   - pink: your turn (Step practice) or an error
   - blue: listening (Think-aloud)
5. **Ghost line** (optional): Caveat at 35% opacity, e.g. "next: integrate ∫ x dx,
   then + C".

If the current line is too wide for the board, scale it down (minimum 32px). Never wrap
it and never scroll.

Step numbers: JetBrains Mono 13px, `muted`, 22px column.

### Marks (right after each line)

- **Correct:** a hand-drawn teal check (an SVG polyline, stroke 3), sized to the line.
- **Hint given / fixed after a hint:** a gold triangle ⚠.
- **Not checked yet:** a dashed gray circle.
- Walkthrough lines have no marks (the tutor wrote them).

### Mistakes

- **Pink ring:** an ellipse around the wrong part (2.5px pink border, `border-radius: 50%`,
  rotated −3° so it looks hand-drawn).
- **Check my work:** a teal chalk arrow and the corrected expression written beside the ring,
  in teal at the same size, plus a short Caveat note ("keep the ½"). Later lines fade to
  ~28% with the Caveat note "redo after the fix".
- **Think-aloud / Step practice (coach mode):** hint first. Ring the wrong part and add a
  gold Caveat "?" circle with a vague note ("a number went missing"). Write the teal fix
  beside it only when the user taps **Show the fix** or gets it wrong twice.

### Header row inside the board

Problem in KaTeX (28px) on the left, a Caveat status label on the right ("step 3 of 4",
"your turn · step 4", "step 3 · listening", "the whole solution"). A thin chalk rule
(`rgba(236,232,221,.14)`) sits under it.

### Finish (frame K)

All steps line up in one column at 20px and 75% opacity, with their marks. A step fixed
after a hint keeps a gold ⚠ and a Caveat "fixed". To the right, a Caveat "answer"
label and the final answer at ~54px inside a 2.5px teal box, rotated −1°.

---

## 7. Mapping to the data contracts (PLAN.md section 5)

| Data | Where it shows up |
|---|---|
| `problem_latex` | Board header row (left) |
| Board step `latex` | A line in the step stack |
| `parts` (IDs) | Rendered with KaTeX `\htmlClass` / `\htmlId` (`trust` on). Role colors come from CSS classes, see below |
| `status: correct` | Teal check mark. The line moves up the stack and shrinks |
| `status: correct_alternate` | Teal check + Caveat note "another way ✓" |
| `status: incorrect` | Pink badge, pink ring around the part whose ID = `error_location`, then the hint or fix as in section 6 |
| `status: unclear_input` | Dotted blue underline under the uncertain part + the **Did you mean…?** card in the tray |
| `rule_label` | Focus card title (not on the board) |
| `why` | Focus card **Why?** button opens a panel over the right third of the board, with the explanation and the expression's parts highlighted. It closes back into the tray |
| `hint` / `common_mistakes[].hint` | Board Caveat note (short) + Focus card body |
| `side_work` | Focus card **Side work** button opens the same overlay panel as Why?, showing the sub-calculation |
| `spoken_feedback` | Tutor card text (and TTS) |
| `display_feedback` | Focus card body |
| `final_answer_latex` | Boxed answer on the finish board |
| `techniques` | "Techniques used" chips on the finish tray |

Role classes for `parts` (suggested names):

```css
.role-a  { color: #6CCDE3; } /* first role: u, du */
.role-b  { color: #F2C94C; } /* second role: dv, v */
.role-c  { color: #4FD1B5; } /* constants/terms that matter, fixes */
.part-error { border: 2.5px solid #FF7A85; border-radius: 50%; padding: 2px 14px 6px; transform: rotate(-3deg); display: inline-block; }
.part-unclear { border-bottom: 3px dotted #58C4DD; }
```

Add one field to the pre-solve output so colors stay consistent: each part gets a
`role` (`a` | `b` | `c` | null). If the AI doesn't assign roles, render everything in
`chalk`.

---

## 8. The tray, per mode

| Mode | Focus card (left) | Controls card (center) | Right card |
|---|---|---|---|
| A · Walkthrough | "STEP n · FOCUS", `rule_label`, one-line explanation, **Why?** **Side work** | ◀ · big ▶ autoplay · ▶, **Read aloud** toggle | **Let me try the next step** (primary) + "You write step n+1, and the board checks it." |
| C · Step practice | "STEP n · YOUR TURN", what to do, **Hint** **Side work** | Labeled input "Type step n" + **Check this step** (primary). What you type renders live as big chalk on the board | Math keys (5×2 grid) + "Stuck? Show me this step →" |
| B · Check my work | "STEP n · FIRST SLIP", short explanation with a small worked expression, **Why?** | Tally (● 2 correct · ● 1 slip · ◌ 1 to redo) + **Redo step n myself** (primary) / **Show me the rest** | Submission thumbnail, "Photo · 4 lines read", **Resubmit** |
| D · Think-aloud | "STEP n · HEARD" + the live transcript in mono, **Type instead** **Side work**; after a check: the rule + **Why?** **Show the fix** | The mic (section 9) + a quiet state legend underneath | **Did you mean…?** (two options, keys 1/2, "or just say 'the first one'") or the **Tutor** message ("Close! When that x cancels…") |
| Finish | "TECHNIQUES USED" chips | Stats: steps · right first try · hints | **Give me a similar problem** (primary) + "Next up: …" |

Eyebrow labels: JetBrains Mono 11px, letter-spacing .08em, in the mode's accent color.

Header mode chip colors: Walkthrough blue, Step practice pink, Check my work teal,
Think-aloud gold (solid, with a small red "live" dot and a timer), Solved teal.

---

## 9. Mic control (Think-aloud)

One 84–92px round button in the center of the tray. Push-to-talk: hold **space** or the
button.

| State | Look | Label |
|---|---|---|
| idle | chalk outline, mic icon | "Ready when you are" |
| listening | blue border and fill tint, blue glow ring, blue waveform bars on both sides | "Listening…" |
| transcribing | three bouncing dots | "Writing it on the board…" |
| thinking | gold border + gold arc spinning around the button, check icon | "Checking your step…" |
| speaking | teal border/tint, speaker icon, teal waveform bars | "Tutor speaking · tap to interrupt" |

Under the button: a quiet legend `idle · listening · writing · checking · tutor`, with the
current state highlighted in its color.

---

## 10. Motion backlog (Phase 4 / Phase 6, not built yet)

Always respect `prefers-reduced-motion`: swap movement for simple fades.

1. **Board drop:** the board unrolls from the rail (~0.5s ease-out, small settle bounce) and
   the start screen fades back. "New problem" rolls it back up.
2. **Problem first:** the problem is chalked across the board header, then the tray slides up,
   then step 1 writes in.
3. **Ink reveal:** new math writes in left to right (~0.6s, clip-path wipe).
4. **Shrink-on-arrival:** when a new step lands, every older step shrinks one size and
   dims (~0.4s). The oldest folds into the collapsed line.
5. **Carry-over slide:** matched `parts` slide from line N to their spot in line N+1.
6. **Cancellation:** cancelled factors get a pink strike, then fade (~0.5s).
7. **✓ pulse** when a step checks out. **Gentle shake + the ring drawing on** for an error.
8. **Fix writing:** in Check my work, the ring draws, then the arrow, then the teal fix inks in.
9. **Finish:** steps slide into one tidy column, the answer is rewritten big, and the
   box draws around it.
10. **Mic:** a blue glow pulse while listening (1.6s loop), bouncing dots, a spinning gold arc,
    teal waveform.
11. **Dropdowns:** panels unfold down from their button (~0.25s) and the rest dims.
12. **Typing preview:** in the Type panel, each new symbol inks in as you type.
13. **Speech-synced highlights:** during "why?", the part being talked about glows
    (PLAN.md section 6).

---

## 11. Not designed yet (decide during the build, keep the principles)

- Mobile layout (proposal in section 3).
- Error states: mic permission denied, API failure, unclear audio. Show them in the
  tutor card with a "Type instead" button, never as a full-page error.
- Skills dashboard (stretch). The v1 page of the mockup has a draft.
- The Why? / Side work overlay: its position is defined above, but there's no frame
  for it yet.

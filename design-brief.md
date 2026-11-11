# Design brief: Chalkline, AI calculus tutor

> Paste this into Claude Design to create the mockup while Claude Code builds the backend.

## What the app is
A voice-first calculus tutor. The student solves a problem on paper while saying
each step out loud. The app writes each step on a "board" as animated math, checks
it, and coaches them by voice. It should feel calm, focused and satisfying,
something a student *wants* to open.

**App name:** Chalkline  (tagline idea: "See the math move.")
**Visual theme:** A dark chalkboard blended with the 3Blue1Brown video style: a
deep, slightly textured dark background, math in soft chalk-white, and a small set
of vivid accent colors (blue, yellow/gold, teal, pink-red) used consistently to
color-code parts of expressions. Minimal UI chrome so the math is the star.
**Mood words:** calm, focused, elegant, satisfying, a little playful

## Modes
The app has four modes that share the same board and animations:
- **Walkthrough:** the AI solves it step by step, with next/previous, autoplay,
  "Why?" on any step, and "Let me try the next step"
- **Check my work:** submit a full solution (typed or photo), and the app
  highlights the first error and shows the fix
- **Step practice:** type one step at a time and get each one checked
- **Think-aloud (signature feature, should feel special):** speak your steps
  while solving on paper, and the app writes and checks them live

## Screens to design
1. **Start screen:** load a problem: upload or take a photo, type it, say it, or
   pick from preset demo problems (cards with topic tags like "Integration by
   parts", "Ratio test").
2. **Confirm problem + choose mode:** the photo thumbnail next to the typeset
   problem, "Looks right?" with Confirm / Edit, then the four mode cards, with
   Think-aloud visually highlighted as the featured mode.
3. **Walkthrough view:** the board with the current step animating in, step
   controls at the bottom, a "Why?" button on each step, and an optional "read
   aloud" toggle.
4. **Check my work view:** the student's submitted solution with a ✓ next to each
   correct step and the first wrong step highlighted, plus an explanation card and
   the corrected path branching off from that step.
5. **Think-aloud / Step practice session (most important):**
   - The problem pinned at the top
   - **The board:** a vertical stack of solution steps written as math, each with a
     small rule tag ("Chain rule") and a status (✓ correct, ⚠ hint, pending)
   - **Side work panel:** a collapsible scratch area beside a step (e.g. finding
     *du*, partial fraction coefficients)
   - **Mic control:** large and central at the bottom, with states: idle,
     listening (live waveform), transcribing, thinking, tutor speaking (waveform in
     another color). Hint text: "Hold space to talk"
   - **"Did you mean…?" chip** when speech was ambiguous, showing two options
   - **Tutor feedback bubble:** short text of what the tutor just said
   - **"Why?" explanation panel:** opens from a step, with the explanation text and
     the expression shown with highlighted parts
6. **Session summary:** final answer, techniques used, steps where you got hints,
   and a "Give me a similar problem" button.
7. **Skills dashboard (stretch):** one mastery bar per technique (chain rule,
   partial fractions, ratio test…), a predicted chance of success on the next
   problem, and a "Practice my weakest skill" button.

## Motion to show or describe (static mockups can't animate, so annotate these)
- New math reveals left-to-right like ink being written (~0.6 s)
- Terms that carry over between lines slide into their new positions
- Color-coded parts (e.g. *u* and *du* in two consistent accent colors)
- Cancelled factors get struck through, then fade
- ✓ pulse on a correct step, gentle shake + underline on an incorrect part
- Mic glows and pulses while listening

## Example content to put in the mockup
Problem: ∫ x·ln(x) dx (integration by parts)
- Step 1: u = ln x, dv = x dx   [tag: Integration by parts] ✓
- Side work: du = (1/x) dx, v = x²/2
- Step 2: (x²/2)ln x − ∫ (x²/2)(1/x) dx  ✓
- Step 3: (x²/2)ln x − ∫ x dx   ⚠ hint: "Check the constant you pulled out"

# PLAN.md: Chalkline, AI calculus tutor, full project spec

---

## 1. Working rules

See `CLAUDE.md` (who I am, how to work with me, phase-by-phase process).

## 2. The project

**Name:** Chalkline  (tagline idea: "See the math move.")

**One-line pitch:** An AI calculus tutor that makes the algebra visible. Every
step is animated so you can *see* what moved, what was substituted and what
cancelled, and you can ask "why?" about any step. Its signature feature is
**Think-aloud mode**: you solve on paper while saying your steps out loud, and the
app writes each one on screen, checks it live and coaches you by voice like a real
tutor sitting next to you.

**Why it matters to me:** I always use AI to learn calculus, and I take advantage of
its interactivity to find the gaps in my understanding by asking about specific
steps. I want a more integrated system with built-in features that help
understanding, plus an appealing, satisfying experience that makes me *want* to
keep learning.

**Scope:** All Calculus I and II topics: limits, derivatives (all rules, implicit,
related rates), applications, integrals, integration techniques (u-sub, by parts,
trig integrals, trig substitution, partial fractions, improper integrals), sequences
and series (convergence tests, power series, Taylor/Maclaurin). Focus is on
**techniques and the algebra behind them**, not on graphing functions.

**Deadline:** Submission due Nov 13, 2026, 11:59 pm ET. The demo link must stay
live until Nov 20. Judges must be able to open the link in a private window with
no login and try it themselves.

**Judging bonus (superpowers):** Each must visibly work in the demo:
1. **Vision:** reads a photo or screenshot of a problem, or of my handwritten work.
2. **Voice:** I speak my steps and questions, and the tutor speaks back. This is the
   centerpiece and must be reliable.

## 3. Modes and user flow

Every mode starts the same way and shares the same engine:

1. **Load a problem:** upload or snap a photo (Vision), type it, say it, or pick
   one of the preset demo problems.
2. **Confirm:** the app shows the problem as typeset math and asks "Is this right?"
3. **Pre-solve:** in the background, the AI builds a reference solution package
   (see section 5). Every mode reuses this package, so each one is mostly a
   different way of presenting it.
4. **Pick a mode** (the user can switch modes mid-problem):

### Mode A: Walkthrough (the AI solves it, you follow along)
- The solution plays step by step as animated transformations (section 6), with a
  rule tag on each step.
- Controls: next / previous step, autoplay, replay a step.
- **"Why?" on any step:** an explanation with the relevant parts of the expression
  highlighted. Optional: the tutor reads it aloud (TTS toggle).
- **"Let me try the next step"** button: hides the upcoming step so I can attempt it
  (typed or spoken) and get it checked before revealing it.

### Mode B: Check my work
- I submit my **full solution**: typed, or a photo of my handwritten work (Vision).
- The app transcribes it into steps, checks each one (SymPy + AI), and finds the
  **first error**: it highlights where, explains what went wrong, and shows the
  corrected path from that point. If everything is correct, it confirms and
  optionally shows a shorter alternate method.

### Mode C: Step-by-step practice (typed)
- I enter one step at a time by typing (a math input field with a live LaTeX preview).
- Each step is checked and displayed on the board with the same animations and the
  same coach-mode feedback as Mode D, shown as text (and optionally spoken).
- This is the quiet, no-microphone version of Think-aloud.

### Mode D: Think-aloud (the signature feature)
1. **I narrate my work (push-to-talk):** I hold the spacebar (or a mic button),
   say one step, and release.
2. **Transcribe and display:** my speech becomes LaTeX and appears on the
   board as an animated transformation from the previous line. If the speech is
   ambiguous (e.g. "one over x plus one"), show the interpretation and let me
   correct it by voice or click.
3. **Check:** compare my step against the reference paths. SymPy verifies the
   algebra, and the AI judges reasoning steps (like choosing a convergence test).
4. **Feedback (coach mode):**
   - Correct → silent ✓ animation, keep going (no talking, to stay fast)
   - Wrong → stop me with a short spoken hint that points at the issue without
     giving away the answer, and highlight the problem spot
   - Valid but different from my reference path → accept it and re-plan from there
5. **"Why?" anytime:** I say "wait, why…?" or click a step. The tutor explains out
   loud while the explanation and the relevant parts of the expression highlight in
   sync.

### Similar problem (available at the end of every mode)
- A "Give me a similar problem" button generates a new problem that uses the same
  technique(s) with different numbers or functions (Sonnet).
- Verify with SymPy that the new problem has a clean, correct solution before
  showing it, then load it straight into the mode picker.

**Finish (all modes):** summary of the solution, the techniques used, and the steps
where I needed hints.

**Architecture note:** Modes C and D share the same step-checking pipeline. Mode D
just adds speech-to-text in front of it and text-to-speech after it. Build Mode C
first and Mode D on top of it.

## 4. Tech stack (already decided)

- **Framework:** Next.js (App Router) + TypeScript + Tailwind CSS, deployed on
  **Vercel** (free tier, no cold starts).
- **Math checking:** a Python serverless function in the same Vercel project using
  **SymPy** for equivalence checks (e.g. `simplify(a - b) == 0`, checking a
  derivative or antiderivative).
- **Math rendering:** KaTeX (or MathJax SVG if needed for the drawing effect).
- **Animation:** Framer Motion.
- **LLM:** Anthropic API.
  - `claude-sonnet-5-5`: vision, pre-solving, "why?" explanations
  - `claude-haiku-5-5`: live step checking and speech-to-LaTeX (speed matters)
  - Use **prompt caching** on the reference solution package so each step check
    reuses it cheaply.
  - Ask for **structured JSON output** with a defined schema for every call.
- **Voice:** ElevenLabs.
  - Speech-to-text: ElevenLabs Scribe
  - Text-to-speech: ElevenLabs voice: warm, calm, natural and
    conversational, like Claude's default voice in the Claude app's voice mode.
    Pick the closest premade ElevenLabs voice and tell me which one you chose.
  - **Free plan limits:** I'm on the ElevenLabs free plan. Keep spoken replies
    short, cache audio for the preset demo problems, and if the quota runs out or
    a call fails, fall back to the browser's built-in speech (Web Speech API) and
    show text so the app never breaks.
  - Stream TTS audio so the tutor starts speaking before the full reply is ready.
- All API calls go through server routes. No keys in the browser.

## 5. Data contracts

> These keep the backend and the design work in sync. Claude Code can refine
> them, but should keep the idea.

**Reference solution package** (created once per problem):
- `problem_latex`, `topic`, `techniques` (e.g. ["integration by parts"])
- `paths`: one or more valid solution paths, each a list of steps
- each step: `latex`, `rule` (short label), `why` (1–3 sentence explanation),
  `hint` (nudge without answer), `common_mistakes` (list of `{mistake, hint}`),
  `parts` (sub-expressions with stable IDs, see section 6)
- `final_answer_latex`

**Step check result:**
- `status`: `correct` | `correct_alternate` | `incorrect` | `unclear_input`
- `matched_step_id`, `error_location` (part ID to highlight), `spoken_feedback`
  (short, under ~15 words), `display_feedback`

**Board step** (what the UI renders): `latex`, `parts` with IDs, `status`,
`rule_label`, optional `side_work` (sub-calculation shown in a side panel)

## 6. The visual engine (the creative core)

The goal is to **see the algebra happen**, not graph functions:
- Every expression is split into **parts with stable IDs** (e.g. using KaTeX
  `\htmlClass` / `\htmlId` with `trust` enabled). The AI assigns IDs so a part in
  line N can be matched to its counterpart in line N+1.
- **Transform animation:** matched parts slide from their old position to the
  new one. New parts draw in with a left-to-right "ink" reveal. Removed parts fade.
- **Color coding:** pieces playing a role glow consistently (e.g. *u* in one color
  and *du* in another during substitution; *u* and *dv* during integration by parts).
- **Cancellations:** matching factors highlight, get struck through, then fade.
- **Rule tags:** a small label points at what changed ("Chain rule", "Ratio test").
- **Side work panel:** sub-calculations (finding *du*, partial fraction
  coefficients, limits inside the ratio test) open beside the main line, then fold
  back in.
- **Speech-synced highlights:** during "why?" explanations, the part being talked
  about glows while it's spoken.

Build the simple version first (fade/wipe reveal + highlights), then upgrade to
part-matching transforms.

## 7. Look and feel

**Theme:** A dark chalkboard blended with the 3Blue1Brown video style: a
deep, slightly textured dark background, math in soft chalk-white, and a small
set of vivid accent colors (blue, yellow/gold, teal, pink-red) used *consistently*
to color-code the parts of an expression, the way 3Blue1Brown colors variables.
Clean, minimal UI chrome so the math is the star. Smooth, unhurried motion.

- Smooth, satisfying micro-animations: ✓ pulse on correct steps, gentle shake on
  the wrong part, a glowing or pulsing mic while listening, a distinct "thinking"
  state, and an animated waveform while the tutor speaks.
- Mic states: idle, listening, transcribing, thinking, speaking.
- Respect `prefers-reduced-motion`.
- If I attach screenshots of a mockup made in Claude Design, match it closely
  in Phase 6. Otherwise follow the theme above.

## 8. Build phases (stop and let me test after each)

**Phase 0: Skeleton and deploy.** Next.js app, Tailwind, env vars, a Python
SymPy route that returns a test result, deployed to Vercel. Done when the public
URL loads and the SymPy test route responds.

**Phase 1: Text-only engine + Walkthrough + Step practice (no voice, no design).**
Type a problem → pre-solve package → **Mode A** (step-through with "why?") and
**Mode C** (type steps → check with SymPy + Haiku → feedback text). Include these 6 preset
demo problems:
  1. Limit (L'Hôpital): lim x→0 of (eˣ − 1 − x) / x²
  2. Derivative (chain rule): d/dx [ ln(x² + 1) ]³
  3. Integral (u-substitution): ∫ x·e^(x²) dx
  4. Integral (by parts): ∫ x·ln(x) dx
  5. Integral (partial fractions): ∫ (5x − 1) / (x² − x − 2) dx
  6. Series (ratio test): does Σ n² / 2ⁿ converge?
Done when all 6 work in both modes, with sensible feedback on both correct and wrong steps.

**Phase 2: Vision + Check my work.** Photo of a problem → LaTeX → confirm screen.
**Mode B**: photo or typed full solution → first-error detection. Also add the
"Give me a similar problem" button (section 3). Done when a phone
photo of a textbook problem and a photo of handwritten work both work.

**Phase 3: Think-aloud voice (push-to-talk).** **Mode D** on top of the Mode C
pipeline: spacebar or mic button → ElevenLabs Scribe → speech-to-LaTeX (Haiku) with
an ambiguity confirmation → step check → spoken feedback via ElevenLabs TTS
(streamed). Spoken "why?" questions. Also add the optional "read aloud" toggle to
Walkthrough. Done when I can solve a full problem by voice only, and wrong steps get
a spoken hint within a few seconds.

**Phase 4: Visual engine.** Section 6, simple version first, then part-matching
transforms. Applies to every mode.

**Phase 5: Judge-readiness.** No login. Basic per-visitor rate limiting to protect
my API credits. Friendly error states (mic permission denied, API failure, unclear
audio) with a typing fallback. Mobile-friendly layout. Test in a private window.

**Phase 6: Design polish.** Apply the theme or mockup and all animations from
section 7.

**Stretch (only if everything above works):**
- Hands-free mode: always-on mic with pause detection (~1.5 s) as the end of
  a step, plus a toggle back to push-to-talk.
- Exam mode: flag mistakes silently and review at the end.
- **ML: knowledge tracing (my top stretch goal).** Track my mastery of each skill
  (each technique tag, e.g. "chain rule", "partial fractions", "ratio test")
  and predict where I'll struggle. Use **Bayesian Knowledge Tracing (BKT)**: per
  skill, estimate P(mastered) from my history of correct/incorrect step attempts,
  using the standard parameters (prior, learn, guess, slip) with sensible defaults.
  Show a "Skills" dashboard (mastery bar per skill, predicted chance of getting
  the next problem right) and recommend a similar problem for the weakest skill.
  Explain the model to me in plain language when you build it, since this is the
  ML part I'll present.
- **Prepare for it from Phase 1:** log every step attempt to browser localStorage
  (no login needed): timestamp, problem id, skill tag(s), correct/incorrect,
  whether a hint was used, and the mode. Cheap to add early, needed later.

## 9. Ship checklist

- Demo link works in a private window with no sign-in.
- Spending cap: my Anthropic account has prepaid credits with auto-reload OFF.
  ElevenLabs is on the free plan (see the fallback in section 4).
- Write a README following the bootcamp template (sections: Try it, How to test it,
  Track, How it works [trigger → AI step → output], Superpowers, Why it matters to
  me, Built with, Built by). Include exact test instructions for judges (which preset
  problem to click, what to say out loud, what should happen).
- Track: Social Good (education)

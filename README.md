# Chalkline

**An AI calculus tutor that makes the algebra visible. *See the math move.***

Every step of a Calculus I or II problem is written on a chalkboard and animated, so you can see
what moved, what was substituted and what changed. You can ask "why?" about any step. The
signature feature is **Think-aloud**: you solve on paper while saying your steps out loud, and
Chalkline writes each one on the board, checks it live and coaches you by voice, like a tutor
sitting next to you.

## Try it

**Live demo: https://chalk-line-five.vercel.app**

No login and no install. It works in a private window. Use Chrome or Edge on a laptop for the
best experience (the microphone and the browser voice are most reliable there). It also works on a
phone.

## How to test it (about 5 minutes)

1. **Walkthrough (no AI needed, instant).**
   Click **Problem library** → **Integration by parts** (∫ x ln x dx) → **Walkthrough**.
   - The board drops down and step 1 is written in. Press **›** (next) or **play** (autoplay).
   - Watch the colored pieces slide from one step into the next, and the rule tag appear.
   - Under the board, **why step n?** explains each step; ask a follow-up right there.
     Turn on **read aloud** to hear each step.
   - At the end, **See the summary**: every line gets a `// takeaway` comment beside it.
2. **Step practice (typing).**
   In the same problem, click **I'll write step n**. Type a step in the box (use the math
   keys) and click **Check this step**.
   - A correct step gets a teal ✓ that draws itself on.
   - Type something wrong on purpose (for example, drop the ½): the wrong part gets a pink ring
     and a hint. **Show the fix** writes the correct line beside it.
3. **Think-aloud (Voice superpower).**
   Go back to the start screen and pick **Problem library** → **u-substitution**
   (∫ x e^{x²} dx) → **Talk it through**. Allow the microphone.
   - Hold the **space bar** (or hold the mic button) and say: *"u equals x squared, d u equals two
     x d x"*. Let go. Your words appear, the math is typeset, and a correct step is accepted
     silently.
   - Say a wrong step, for example *"the integral of e to the u d u"* (it forgets the ½). The
     tutor rings the mistake and **speaks a hint**.
   - Ask out loud: *"Why do we pick u as x squared?"*: the answer is shown and spoken.
   - If something you say could mean two things (try *"one over two x"*), it asks
     **Did you mean…?** Pick one, or say "the first one".
4. **Check my work (Vision superpower).**
   On the start screen, click **Upload a photo** and choose a photo or screenshot of a calculus
   problem, or of handwritten work. You can also paste a screenshot with Ctrl+V. Chalkline shows
   "We read this as…".
   - Pick **Check my work**. If the photo includes a worked solution, it finds the **first slip**,
     rings it in pink and writes the fix in teal. Later lines fade with "redo after the fix".
   - **Redo step n myself** sends you into Step practice at that step.
5. **A similar problem.** Finish any problem (or click **See the summary**), then click
   **Give me a similar problem** to get a new one that uses the same technique and has been checked
   by the math engine.

A new typed or photographed problem takes about 15–30 seconds to prepare the first time (the AI
solves it and the math engine checks every line). The 29 library problems are instant.

6. **The problem library.** 29 solved problems in 6 areas (limits, derivatives, using derivatives,
   integrals, integration techniques, series), each with its technique and a difficulty. After you
   miss a few steps in Step practice or Check my work, **Picked for you** recommends problems for the
   techniques you miss most. Solved problems get a ✓.

## Track

**Social Good: education.**

## How it works

**Trigger → AI step → output**

1. **Trigger:** you bring a problem: a photo (read by Gemini's vision), typed math, your voice, or
   one of the 29 library problems.
2. **AI step: pre-solve.** Google Gemini writes a *solution package*: every step in LaTeX and in
   SymPy form, the rule used, a hint, a "why" explanation, common mistakes, and which parts of each
   expression play which role (for the colors). A **SymPy** (Python computer algebra) checker then
   verifies each line, and the AI retries if a line fails. Every mode reuses this one package.
3. **AI step: checking you.** Each step you type or say is checked twice: SymPy decides if the math
   is equal (and overrules the AI when they disagree), and Gemini explains *what* went wrong in
   tutor language. Spoken steps go through Gemini first (speech → transcript → LaTeX → your intent).
4. **Output:** the chalkboard. New lines ink in left to right, colored parts slide from one line to
   the next, mistakes get a pink ring and a hint, and the tutor speaks with the browser's voice.

```
photo / typing / voice ──► Gemini (read + pre-solve) ──► SymPy verifies every line
                                                              │
         your step (typed or spoken) ──► SymPy + Gemini check ┴──► animated board + spoken hint
```

## Superpowers

- **Vision:** reads photos and screenshots of problems *and* of handwritten solutions, then finds the
  first mistake in your work (Check my work).
- **Voice:** push-to-talk Think-aloud. You say your steps and questions, the board writes and checks
  them, and the tutor talks back with hints and explanations. Read aloud in Walkthrough.

## Why it matters to me

I always use AI to learn calculus, and I use its interactivity to find the gaps in my
understanding by asking about specific steps. I wanted a more integrated tool with features built
for understanding, plus an appealing, satisfying experience that makes me *want* to keep learning.
Seeing the algebra move, and being coached while I think out loud, is how I wish I had learned it.

## Built with

- **Next.js 16** (React 19, TypeScript, Tailwind CSS 4), deployed on **Vercel**
- **Google Gemini** (Flash and Flash-Lite): reading photos, pre-solving, checking steps and work,
  speech-to-math, "why?" answers, similar problems
- **SymPy** (Python serverless function on Vercel): checks that every line is mathematically right
- **KaTeX** (math typesetting) and **MathLive** (math input)
- **Web Speech / speechSynthesis** (the browser's voice), **MediaRecorder** (the microphone)
- Built with **Claude Code**

## Built by

Carlos ([@caquinopsu](https://github.com/caquinopsu)), bootcamp final project, November 2026.

---

## Run it locally

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in `GEMINI_API_KEY` (ElevenLabs is optional).
3. Set up the Python checker once:
   ```bash
   python -m venv .venv
   .venv\Scripts\python -m pip install -r requirements.txt
   ```
4. `npm run dev`, then open http://localhost:3000 (this starts both the app and the SymPy checker).

More detail: `CODE_GUIDE.md` (a tour of the code) and `PROGRESS.md` (what's done, known issues).

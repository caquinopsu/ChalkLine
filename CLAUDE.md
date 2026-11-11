# CLAUDE.md

## Project
**Chalkline**: an AI calculus tutor web app (Calc I + II) with animated step-by-step algebra and a
signature voice "Think-aloud" mode. The full spec is in `PLAN.md`. Read it before
starting any phase.

Deadline: Nov 13, 2026, 11:59 pm ET (bootcamp final project). Prioritize a
working demo over extra features.

## Who I am
Computational Data Sciences student at Penn State, building this solo.
Coding experience: Python basics only. This is one of my very first projects.
**You write all of the code.** I test, give feedback and make the decisions, so
explain things at a high level, give me exact click-by-click instructions for
anything I have to do myself (installing tools, creating accounts, adding API keys,
deploying), and never assume I know a JavaScript/React concept without a
one-line explanation.

## How to work with me
- Build one phase from `PLAN.md` section 8 at a time. Before coding a phase,
  briefly outline your plan for it. After finishing it, stop, tell me exactly how to
  test it, and wait for my OK.
- Explain what you're doing in plain language. Add a short comment on every
  meaningful line of code so I can learn the structure.
- When you make a technical decision I didn't specify, tell me in one line what
  you chose and why.
- Get features working before making them pretty. Design polish is its own
  later phase.
- Commit to git after every working phase with a clear message.
- Keep a short `PROGRESS.md`: which phase is done, what's next, known issues.
  Update it at the end of every phase.

## Hard rules
- Never put API keys in code, commits, the README, logs or screenshots. Use
  environment variables only (`.env.local` locally, Vercel project settings when
  deployed). Make sure `.env.local` is in `.gitignore`.
- All Anthropic and ElevenLabs calls go through server-side routes, never the browser.
- Models: `claude-sonnet-5-5` (vision, pre-solving, explanations) and
  `claude-haiku-5-5` (live step checks, speech-to-LaTeX).
- The deployed app must work with no login, in a private browser window.

## Stack
Next.js (App Router) + TypeScript + Tailwind, Framer Motion, KaTeX, a Python
SymPy serverless function, deployed on Vercel. Anthropic API + ElevenLabs
(Scribe speech-to-text + text-to-speech).

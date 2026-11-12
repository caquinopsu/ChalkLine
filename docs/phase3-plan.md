# Phase 3: Think-aloud voice (push-to-talk)

## Situation
- ElevenLabs is unusable: the account returns 401 "detected_unusual_activity" (free tier disabled).
- Tested: Gemini 3.5 Flash-Lite can transcribe a short audio clip AND convert the spoken math to LaTeX
  in one call (~2 s).
- So: Gemini listens, the browser's built-in voice (speechSynthesis) speaks. If ElevenLabs access
  comes back later, TTS can switch to it automatically, with the browser voice as the fallback
  (PLAN.md already calls for this fallback).

## Build
1. **Recording (browser):** push-to-talk mic button using MediaRecorder (hold, or tap to start/stop),
   max ~15 s per clip, sent as base64.
2. **`/api/speech-to-math` route (server):** Gemini FAST list with an audio inlineData part. Returns
   { transcript, latex, intent, alternatives }:
   - intent = step | why | choose (1 or 2) | show fix | hint | other
   - alternatives = "Did you mean...?" options when the math is ambiguous
   - Body size limit and audio type check, like read-photo.
3. **Routing the intent:**
   - step -> existing /api/check-step. Correct -> a silent check mark. Wrong -> the hint is shown AND spoken.
   - why -> existing /api/why, answer shown + spoken.
   - choose / show fix / hint -> same buttons that already exist, triggered by voice.
4. **Speaking (browser):** lib/speak.ts using speechSynthesis, picking a clear English voice,
   stripping LaTeX into speakable words ("x squared over 2"). Optional ElevenLabs path behind a
   /api/tts route that falls back to the browser voice on any error.
5. **Mic control UI (DESIGN.md section 9, frames I and J), 5 states:** idle, listening (level pulse),
   thinking, speaking, error. Transcript shown under the board so there's always text.
6. **Where voice appears:**
   - "Talk it through" start option on the start screen
   - "Think-aloud" in the Practice "Start as" row and in the mode chip
   - Walkthrough "Read aloud" toggle (reads each step with the browser voice, no AI calls)
7. **Fallbacks:** mic denied or unsupported -> message + typing stays available. Gemini busy ->
   friendly error, user can retry or type.

## Testing (lean: minimize quota use)
- During the build: free checks only (tsc, lint, build, the Read aloud toggle, UI states with a
  recorded clip mocked).
- At the end: one announced live batch of about 5-8 Gemini requests (a few spoken steps, one
  "why?", one ambiguous phrase).

## Wrap-up
- Click-by-click test instructions for the owner.
- Update PROGRESS.md and CODE_GUIDE.md.
- Commit and push; Vercel redeploys.

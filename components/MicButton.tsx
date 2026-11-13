"use client";

// The push-to-talk mic (DESIGN.md section 9): one round button whose look follows the mic's state,
// a label under it, and a quiet legend of every state with the current one lit up.
import type { VoicePhase } from "@/lib/useVoice";

type Props = {
  phase: VoicePhase;
  level: number; // microphone volume 0-1 (only used while listening)
  disabled?: boolean;
  onPress: () => void; // pointer down (or tap)
  onRelease: () => void; // pointer up
  labels?: Partial<Record<VoicePhase, string>>; // override the text under the button
  handsFree?: boolean; // hands-free mode is on
  waiting?: boolean; // hands-free: the mic is open, nobody is talking yet
  paused?: boolean; // hands-free: paused (tap to resume)
};

// Words under the button, per state.
const LABEL: Record<VoicePhase, string> = {
  idle: "Ready · hold space or the mic, or tap once",
  listening: "Listening… let go, or just stop talking",
  writing: "Writing it on the board…",
  checking: "Checking your step…",
  speaking: "Tutor speaking · tap to interrupt",
  error: "Something went wrong · tap to try again",
};

// The legend: idle · listening · writing · checking · tutor, each with its color.
const LEGEND: { phase: VoicePhase; word: string; color: string }[] = [
  { phase: "idle", word: "idle", color: "text-text" },
  { phase: "listening", word: "listening", color: "text-blue" },
  { phase: "writing", word: "writing", color: "text-blue" },
  { phase: "checking", word: "checking", color: "text-gold" },
  { phase: "speaking", word: "tutor", color: "text-teal" },
];

const BARS = [0.45, 0.8, 1, 0.65, 0.35]; // relative heights of the waveform bars on each side

// Words under the button in hands-free mode (where they differ).
function handsLabel(phase: VoicePhase, waiting: boolean, paused: boolean): string | null {
  if (paused && (phase === "idle" || phase === "error")) return "Hands-free paused · tap the mic to resume";
  if (phase === "listening") return waiting ? "Hands-free · just start talking" : "Listening… pause when you're done";
  if (phase === "idle") return "Hands-free · opening the mic…";
  return null;
}

export function MicButton({ phase, level, disabled, onPress, onRelease, labels, handsFree = false, waiting = false, paused = false }: Props) {
  // Button colors per state: chalk outline (idle), blue (listening/writing), gold (checking), teal (tutor), pink (error).
  const look =
    phase === "listening" && waiting ? "border-blue/70 bg-blue/10 text-blue" // hands-free, mic open but quiet: no glow yet
    : phase === "listening" ? "border-blue bg-blue/20 text-blue mic-glow"
    : phase === "writing" ? "border-blue bg-blue/10 text-blue"
    : phase === "checking" ? "border-gold/40 bg-gold/10 text-gold"
    : phase === "speaking" ? "border-teal bg-teal/15 text-teal"
    : phase === "error" ? "border-pink bg-pink/10 text-pink"
    : "border-text/70 bg-transparent text-text hover:bg-panel-2";
  const showWave = phase === "listening" || phase === "speaking";
  const waveColor = phase === "speaking" ? "bg-teal" : "bg-blue";
  // While listening the bars follow your voice; while the tutor talks they sway gently.
  const amp = phase === "listening" ? 0.25 + level * 0.75 : 0.6;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center gap-3">
        <Wave show={showWave} color={waveColor} amp={amp} mirrored />
        <button
          type="button"
          aria-label={
            phase === "speaking" ? "Stop the tutor"
            : handsFree ? (phase === "listening" ? (waiting ? "Pause hands-free listening" : "Send what I said now") : "Resume hands-free listening")
            : phase === "listening" ? "Stop listening" : "Hold or tap to talk"
          }
          aria-pressed={phase === "listening"}
          disabled={disabled}
          // Pointer events cover mouse, touch and pen. setPointerCapture: letting go outside the button still counts.
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            onPress();
          }}
          onPointerUp={onRelease}
          onPointerCancel={onRelease}
          onKeyDown={(e) => {
            // Keyboard: Enter works like a tap (start, then Enter again to stop). Space is handled page-wide.
            if (e.key !== "Enter" || e.repeat) return;
            e.preventDefault();
            onPress();
            onRelease();
          }}
          onContextMenu={(e) => e.preventDefault()} // long-press on a phone shouldn't open a menu
          className={`relative flex h-[84px] w-[84px] touch-none select-none items-center justify-center rounded-full border-[2.5px] text-3xl transition-colors disabled:opacity-35 ${look}`}
        >
          {phase === "checking" && (
            // The spinning gold arc around the button.
            <span aria-hidden className="mic-arc absolute -inset-[5px] rounded-full border-[3px] border-transparent border-t-gold" />
          )}
          {phase === "writing" ? <Dots /> : <span aria-hidden>{phase === "speaking" ? "🔊" : phase === "checking" ? "✓" : "🎙"}</span>}
        </button>
        <Wave show={showWave} color={waveColor} amp={amp} />
      </div>
      <span role="status" className="text-center text-[13px] text-muted">{(handsFree && handsLabel(phase, waiting, paused)) || labels?.[phase] || LABEL[phase]}</span>
      <span aria-hidden className="font-mono text-[11px] text-subtle">
        {LEGEND.map((l, i) => (
          <span key={l.phase}>
            {i > 0 && " · "}
            <span className={phase === l.phase || (l.phase === "idle" && phase === "error") ? l.color : ""}>
              {phase === l.phase && "● "}
              {l.word}
            </span>
          </span>
        ))}
      </span>
    </div>
  );
}

// Waveform bars beside the button.
function Wave({ show, color, amp, mirrored = false }: { show: boolean; color: string; amp: number; mirrored?: boolean }) {
  const bars = mirrored ? [...BARS].reverse() : BARS;
  return (
    <div aria-hidden className={`flex h-10 w-[38px] items-center gap-[3px] ${show ? "" : "invisible"}`}>
      {bars.map((h, i) => (
        <span key={i} className={`w-[3px] rounded-sm ${color} transition-[height] duration-100`} style={{ height: `${Math.max(4, h * amp * 40)}px` }} />
      ))}
    </div>
  );
}

// Three bouncing dots ("writing it on the board").
function Dots() {
  return (
    <span aria-hidden className="flex gap-1.5">
      {[0, 1, 2].map((i) => (
        <span key={i} className="mic-dot h-2 w-2 rounded-full bg-blue" style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </span>
  );
}

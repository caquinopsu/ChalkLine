"use client";

// Voice extras shared by "Talk it through" and Think-aloud:
// - useHandsFree(): the hands-free on/off switch, remembered in this browser.
// - <VoiceTools>: the hands-free switch and the "How talking works" button, shown under the mic.
// - <VoiceGuide>: the guide itself, a real modal dialog (<dialog>): it traps keyboard focus, Esc
//   closes it, and focus goes back to the button that opened it. Screen readers announce it by its title.
import { useEffect, useRef, useState } from "react";
import { Tex } from "./Tex";

const KEY = "chalkline.handsFree"; // where the switch is remembered

// The hands-free switch. Off by default; remembered per browser (if storage is blocked, it just isn't remembered).
export function useHandsFree(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "1") setOn(true); // eslint-disable-line react-hooks/set-state-in-effect -- read once after the first render (the server can't see localStorage)
    } catch {}
  }, []);
  const set = (v: boolean) => {
    setOn(v);
    try {
      localStorage.setItem(KEY, v ? "1" : "0");
    } catch {}
  };
  return [on, set];
}

// Under the mic: [ hands-free switch ]  [ ? How talking works ]
export function VoiceTools({ handsFree, onHandsFree, onOpenGuide }: { handsFree: boolean; onHandsFree: (on: boolean) => void; onOpenGuide?: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        role="switch"
        aria-checked={handsFree}
        onClick={() => onHandsFree(!handsFree)}
        title="Keep the mic open: every time you pause, what you said is sent"
        className={`flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition-colors ${handsFree ? "border-blue bg-blue/15 text-blue" : "border-white/20 text-muted hover:text-text"}`}
      >
        {/* the little switch track */}
        <span aria-hidden className={`relative h-4 w-7 rounded-full transition-colors ${handsFree ? "bg-blue" : "bg-white/25"}`}>
          <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-panel transition-[left] ${handsFree ? "left-[14px]" : "left-0.5"}`} />
        </span>
        Hands-free
      </button>
      <button
        type="button"
        onClick={() => {
          onOpenGuide?.(); // e.g. pause a hands-free mic while reading
          setOpen(true);
        }}
        aria-haspopup="dialog"
        className="flex h-9 items-center gap-1.5 rounded-full border border-white/20 px-3 text-sm font-medium text-muted hover:text-text"
      >
        <span aria-hidden className="flex h-5 w-5 items-center justify-center rounded-full border border-current text-[11px] font-bold">?</span>
        How talking works
      </button>
      {open && <VoiceGuide onClose={() => setOpen(false)} />}
    </div>
  );
}

// What you can say, and what happens (the commands table).
const COMMANDS: [string, string][] = [
  ["“scratch that” · “undo” · “go back”", "Takes back the line just written. A misheard line doesn't count against you."],
  ["“next” · “start” · “keep going”", "Moves on: starts solving, or accepts the fix that's showing."],
  ["“repeat that”", "The tutor says its last message again."],
  ["“give me a hint” · “I'm stuck”", "A nudge for this step."],
  ["“why …?”", "Ask about the step, e.g. “why is u log x?”"],
  ["“show me the fix”", "Writes the corrected line in teal."],
  ["“the first one” · “the second one”", "Picks a “Did you mean…?” option."],
  ["“pause” · “stop listening”", "Turns hands-free off until you tap the mic."],
];

// Spoken math examples: what to say, and what gets written.
const EXAMPLES: [string, string][] = [
  ["x squared over two", "\\frac{x^2}{2}"],
  ["the quantity x plus one, squared", "(x+1)^2"],
  ["one over the quantity x plus one", "\\frac{1}{x+1}"],
  ["e to the two x", "e^{2x}"],
  ["the integral of x times log x, dx", "\\int x\\ln x\\,dx"],
  ["the limit as x goes to zero of sine x over x", "\\lim_{x\\to 0}\\frac{\\sin x}{x}"],
];

export function VoiceGuide({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const opener = document.activeElement as HTMLElement | null; // focus returns here afterwards
    // Esc closed it. (A "close" event that arrives while it's open again is a stale one from React's
    // dev-mode double start, so it's ignored.)
    const closed = () => !d.open && onCloseRef.current();
    d.addEventListener("close", closed);
    d.showModal(); // modal: the page behind can't be clicked or tabbed into
    return () => {
      d.removeEventListener("close", closed); // (closing it here is cleanup, not the student closing it)
      if (d.open) d.close();
      opener?.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="voice-guide-title"
      onClick={(e) => e.target === ref.current && onClose()} // a click on the dimmed backdrop
      // Keys typed here (Space, 1, 2, Esc) must not reach the page's mic and option shortcuts.
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
      className="voice-guide m-auto max-h-[calc(88dvh/var(--ui-zoom))] w-[min(760px,calc(94vw/var(--ui-zoom)))] overflow-y-auto rounded-[24px] border border-white/10 bg-panel p-0 text-text shadow-[0_30px_80px_rgba(60,45,30,.25)] backdrop:bg-[rgba(42,37,32,.4)] backdrop:backdrop-blur-[4px]"
    >
      <div className="flex flex-col gap-7 p-6 md:p-8">
        <div className="flex items-start gap-4">
          <div className="flex-1">
            <h2 id="voice-guide-title" className="font-display text-2xl font-semibold">How talking works</h2>
            <p className="mt-1 text-base text-muted">Solve on paper and say each line out loud. The tutor writes it on the board and checks it.</p>
          </div>
          <button
            autoFocus
            onClick={onClose}
            className="flex h-11 shrink-0 items-center rounded-full border border-white/15 bg-panel-2 px-4 text-sm font-medium hover:bg-panel-3"
          >
            Close <span className="sr-only">the guide</span>
          </button>
        </div>

        <section aria-labelledby="vg-ways" className="flex flex-col gap-3">
          <h3 id="vg-ways" className="text-lg font-semibold">Three ways to use the mic</h3>
          <ul className="grid gap-3 md:grid-cols-3">
            <li className="rounded-2xl bg-panel-2 p-4">
              <strong className="block">Hold</strong>
              <span className="text-muted">Hold the mic or the space bar, talk, let go.</span>
            </li>
            <li className="rounded-2xl bg-panel-2 p-4">
              <strong className="block">Tap</strong>
              <span className="text-muted">Tap once and talk. It stops by itself when you pause (or tap again).</span>
            </li>
            <li className="rounded-2xl bg-panel-2 p-4">
              <strong className="block">Hands-free</strong>
              <span className="text-muted">Switch it on and just talk. Every pause sends what you said. Tap the mic or say “pause” to stop.</span>
            </li>
          </ul>
        </section>

        <section aria-labelledby="vg-slips" className="flex flex-col gap-2">
          <h3 id="vg-slips" className="text-lg font-semibold">Ums, slips and changing your mind</h3>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-base leading-relaxed">
            <li>Filler words like “um”, “uh” and “so” are ignored. Talk the way you normally would.</li>
            <li>Correct yourself as you go: <em>“x squared, no wait, x cubed”</em> writes only <Tex latex="x^3" />. “I mean”, “sorry” and “actually” work too.</li>
            <li>Already on the board? Say <strong>“scratch that”</strong> to take it back. It doesn’t count as a wrong try.</li>
            <li>Real math mistakes are kept as you said them, so the tutor can help you find them.</li>
            <li>Thinking out loud is fine in hands-free: only a line you clearly state goes on the board.</li>
          </ul>
        </section>

        <section aria-labelledby="vg-math" className="flex flex-col gap-2">
          <h3 id="vg-math" className="text-lg font-semibold">Saying math clearly</h3>
          <p className="text-base text-muted">Say “the quantity” where you’d open a bracket, and pause where it closes.</p>
          <table className="w-full border-separate border-spacing-y-1 text-left text-base">
            <thead className="sr-only">
              <tr><th>You say</th><th>It writes</th></tr>
            </thead>
            <tbody>
              {EXAMPLES.map(([say, tex]) => (
                <tr key={say}>
                  <td className="rounded-l-xl bg-panel-2 px-3 py-2">“{say}”</td>
                  <td className="rounded-r-xl bg-panel-2 px-3 py-2 text-xl" aria-label={say}><Tex latex={tex} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-sm text-muted">If something could be read two ways, you’ll see “Did you mean…?” with both. Say “the first one”, press 1 or 2, or click.</p>
        </section>

        <section aria-labelledby="vg-cmds" className="flex flex-col gap-2">
          <h3 id="vg-cmds" className="text-lg font-semibold">Things you can say</h3>
          <table className="w-full border-separate border-spacing-y-1 text-left text-base">
            <thead>
              <tr className="text-sm text-muted"><th className="px-3 font-medium">Say</th><th className="px-3 font-medium">What happens</th></tr>
            </thead>
            <tbody>
              {COMMANDS.map(([say, does]) => (
                <tr key={say}>
                  <td className="rounded-l-xl bg-panel-2 px-3 py-2 font-medium md:whitespace-nowrap">{say}</td>
                  <td className="rounded-r-xl bg-panel-2 px-3 py-2 text-muted">{does}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section aria-labelledby="vg-tips" className="flex flex-col gap-2">
          <h3 id="vg-tips" className="text-lg font-semibold">Good to know</h3>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-base leading-relaxed">
            <li>Each clip can be up to 15 seconds. Say one line at a time.</li>
            <li>A quiet room helps. For hands-free, headphones keep the mic from hearing the tutor.</li>
            <li>Keyboard: <kbd className="rounded border border-white/25 px-1.5 font-mono text-sm">Space</kbd> is the mic, <kbd className="rounded border border-white/25 px-1.5 font-mono text-sm">1</kbd>/<kbd className="rounded border border-white/25 px-1.5 font-mono text-sm">2</kbd> pick an option, <kbd className="rounded border border-white/25 px-1.5 font-mono text-sm">Esc</kbd> closes this guide.</li>
            <li>Everything you say is also shown as text under the line, and typing always works instead.</li>
            <li>Your audio is sent to Google Gemini only to write down what you said. It isn’t saved.</li>
          </ul>
        </section>
      </div>
    </dialog>
  );
}

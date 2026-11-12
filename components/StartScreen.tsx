"use client";

// The start screen (DESIGN.md frames A–D): choose how to bring a problem, then pick a mode.
// Layout: a live demo chalkboard, the title, three "bring a problem" cards and a demo-problem button,
// over a faint background of floating chalk math. Each choice opens a large centered sheet; the
// page behind it never moves (it just blurs), so nothing jumps.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { messageOf } from "@/lib/errors"; // friendly error sentences (Phase 5)
import { KEYS_PROBLEM, MathInput, type MathInputHandle } from "./MathInput";
import { Tex } from "./Tex";
import { Logo } from "./Logo";
import { MicButton } from "./MicButton";
import { PRESETS, loadPreset } from "@/lib/presets";
import { Board } from "./Board"; // the home-screen demo board
import { getPackage } from "@/lib/packages";
import { imageFrom, preparePhoto, readPhoto } from "@/lib/photo";
import { hear, type Clip } from "@/lib/recorder";
import { useVoice } from "@/lib/useVoice";
import type { SolutionPackage, Submission } from "@/lib/schemas";

export type StartMode = "walkthrough" | "practice" | "check" | "voice"; // "voice" = Think-aloud
export type StartChoice =
  | { kind: "preset"; presetId: string; mode: StartMode } // a demo problem
  | { kind: "typed"; latex: string; mode: StartMode; work?: Submission }; // typed or photographed (with any work in the photo)

type Panel = "none" | "upload" | "type" | "practice" | "talk"; // which sheet is open

export function StartScreen({ onStart }: { onStart: (choice: StartChoice) => void }) {
  const [panel, setPanel] = useState<Panel>("none");
  const close = () => setPanel("none");

  // Esc closes the open sheet.
  useEffect(() => {
    if (panel === "none") return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPanel("none");
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panel]);

  return (
    <div className="relative isolate flex h-full flex-col overflow-hidden">
      <ChalkBackdrop />

      {/* Header: logo and name left, a short promise right */}
      <header className="flex h-14 shrink-0 items-center justify-between px-4 md:h-[68px] md:px-10">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="font-display text-xl font-semibold">Chalkline</span>
        </div>
        <span className="hidden text-sm text-subtle md:block">Calculus I &amp; II · free · no sign-up</span>
      </header>

      <main className="no-bar fade-up flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-4 pb-6 md:justify-start md:gap-7 md:pt-[2vh] 2xl:gap-9">
        {/* Laptop: a live chalkboard that solves a demo problem on its own (hidden on phones) */}
        <div className="hidden w-full max-w-[1040px] md:block 2xl:max-w-[1240px]" aria-hidden>
          <DemoBoard />
        </div>

        <div className="relative text-center">
          {/* a soft gold glow behind the title */}
          <div aria-hidden className="absolute left-1/2 top-1/2 -z-10 h-40 w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-gold/[.06] blur-3xl" />
          <h1 className="font-display text-[34px] font-semibold leading-tight md:text-[50px] 2xl:text-[62px]">What are we solving today?</h1>
          <p className="mt-1 font-hand text-2xl text-gold md:text-[32px] 2xl:text-[38px]">See the math move.</p>
        </div>

        {/* Three ways to bring a problem */}
        <div className="grid w-full max-w-md grid-cols-1 gap-3 md:max-w-[1040px] md:grid-cols-3 md:gap-4 2xl:max-w-[1240px] 2xl:gap-5">
          <EntryCard
            icon={<CameraIcon />}
            tint="bg-blue/15 text-blue"
            title="Upload a photo"
            sub="A textbook page, screenshot or your work"
            onClick={() => setPanel("upload")}
          />
          <EntryCard
            icon={<span className="font-display text-[28px] leading-none">∫</span>}
            tint="bg-teal/15 text-teal"
            title="Type it"
            sub="Math keys and a live chalk preview"
            onClick={() => setPanel("type")}
          />
          <EntryCard
            icon={<MicIcon />}
            tint="bg-gold text-[#14181D]"
            title="Talk it through"
            badge="SIGNATURE"
            sub="Say the problem, then solve it out loud"
            gold
            onClick={() => setPanel("talk")}
          />
        </div>

        <button
          className="flex h-12 items-center gap-2 rounded-full border border-white/15 bg-room/60 px-6 text-[15px] font-semibold transition hover:-translate-y-0.5 hover:border-white/30 hover:bg-panel-2"
          onClick={() => setPanel("practice")}
        >
          <span className="text-gold">▶</span> Try a demo problem
        </button>
      </main>

      <footer className="hidden shrink-0 pb-4 text-center text-sm text-subtle md:block">
        Talk it through: hold space (or the mic) and say the problem
      </footer>

      {panel === "upload" && <Sheet title="Upload a photo" icon={<CameraIcon />} tint="bg-blue/15 text-blue" onClose={close}><UploadPanel onStart={onStart} /></Sheet>}
      {panel === "type" && <Sheet title="Type it" icon={<span className="font-display text-[26px] leading-none">∫</span>} tint="bg-teal/15 text-teal" onClose={close}><TypePanel onStart={onStart} /></Sheet>}
      {panel === "talk" && <Sheet title="Talk it through" icon={<MicIcon />} tint="bg-gold text-[#14181D]" onClose={close}><TalkPanel onStart={onStart} onType={() => setPanel("type")} /></Sheet>}
      {panel === "practice" && <Sheet title="Try a demo problem" icon={<span className="text-gold">▶</span>} tint="bg-gold/15" onClose={close}><PracticePanel onStart={onStart} /></Sheet>}
    </div>
  );
}

// A large sheet centered over the page (the page behind blurs and dims; click outside or press Esc
// to close). On phones it fills the screen (see ".sheet" in globals.css).
function Sheet({ title, icon, tint, onClose, children }: { title: string; icon: ReactNode; tint: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(10,12,15,.6)] p-4 backdrop-blur-[6px] fade-in" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="sheet no-bar flex max-h-[90vh] w-[min(1080px,94vw)] flex-col gap-6 overflow-y-auto rounded-[28px] border border-white/10 bg-panel p-6 shadow-[0_30px_80px_rgba(0,0,0,.6)] md:p-9"
        onClick={(e) => e.stopPropagation()} // clicks inside don't close it
      >
        <div className="flex items-center gap-4">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${tint}`}>{icon}</span>
          <h2 className="flex-1 font-display text-2xl font-semibold md:text-[30px]">{title}</h2>
          <button className="btn h-10" onClick={onClose} aria-label="Close">✕ Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

// One of the three big "bring a problem" cards: an icon, a title, one line of help, an arrow.
function EntryCard({ icon, tint, title, sub, badge, gold = false, onClick }: {
  icon: ReactNode; tint: string; title: string; sub: string; badge?: string; gold?: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex h-[92px] items-center gap-4 rounded-[20px] border px-4 text-left transition duration-200 hover:-translate-y-1 md:h-[108px] md:px-5 2xl:h-[124px] ${
        gold
          ? "border-gold/50 bg-panel shadow-[0_0_30px_rgba(242,201,76,.12)] hover:border-gold hover:shadow-[0_10px_40px_rgba(242,201,76,.22)]"
          : "border-white/10 bg-panel hover:border-white/25 hover:bg-panel-2 hover:shadow-[0_10px_30px_rgba(0,0,0,.35)]"
      }`}
    >
      <span className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full transition group-hover:scale-110 2xl:h-[60px] 2xl:w-[60px] ${tint}`}>{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[17px] font-semibold 2xl:text-xl">{title}</span>
        <span className="text-sm leading-snug text-muted 2xl:text-base">{sub}</span>
      </span>
      {badge && <span className="absolute -top-2.5 right-5 rounded-full bg-gold px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-[#14181D]">{badge}</span>}
      <span aria-hidden className="text-xl text-muted transition group-hover:translate-x-1 group-hover:text-text">→</span>
    </button>
  );
}

// Simple line icons (drawn with SVG so they match the chalk style better than emoji).
function CameraIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
function MicIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" />
    </svg>
  );
}

// Background decoration: faint chalk math scattered around the room, drifting slowly
// (like old notes on a classroom wall). Purely decorative; screen readers skip it.
const DOODLES: { t: string; x: string; y: string; size: number; rot: number; dur: number; color: string }[] = [
  { t: "∫ f(x) dx", x: "2%", y: "14%", size: 46, rot: -8, dur: 11, color: "text-chalk" },
  { t: "d/dx", x: "91%", y: "10%", size: 40, rot: 6, dur: 13, color: "text-blue-chalk" },
  { t: "Σ 1/n²", x: "3%", y: "58%", size: 42, rot: 5, dur: 14, color: "text-gold" },
  { t: "lim x→0", x: "88%", y: "52%", size: 38, rot: -5, dur: 12, color: "text-chalk" },
  { t: "x² + y² = r²", x: "2%", y: "86%", size: 34, rot: -3, dur: 16, color: "text-teal" },
  { t: "u = ln x", x: "89%", y: "84%", size: 36, rot: 4, dur: 10, color: "text-blue-chalk" },
  { t: "π", x: "8%", y: "34%", size: 64, rot: 10, dur: 15, color: "text-gold" },
  { t: "√2", x: "93%", y: "32%", size: 50, rot: -10, dur: 12, color: "text-teal" },
  { t: "f′(x)", x: "5%", y: "74%", size: 38, rot: 7, dur: 13, color: "text-chalk" },
  { t: "∞", x: "92%", y: "70%", size: 58, rot: -4, dur: 17, color: "text-chalk" },
];
function ChalkBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 hidden overflow-hidden md:block">
      {/* two soft colored lights so the room isn't flat */}
      <div className="absolute -left-40 top-1/4 h-[520px] w-[520px] rounded-full bg-blue/[.05] blur-3xl" />
      <div className="absolute -right-40 bottom-0 h-[520px] w-[520px] rounded-full bg-gold/[.05] blur-3xl" />
      {DOODLES.map((d, i) => (
        <span
          key={i}
          className={`doodle absolute whitespace-nowrap font-hand ${d.color}`}
          style={{ left: d.x, top: d.y, fontSize: d.size, "--rot": `${d.rot}deg`, animationDuration: `${d.dur}s`, animationDelay: `${-i * 1.7}s` } as React.CSSProperties}
        >
          {d.t}
        </span>
      ))}
    </div>
  );
}

// The work-mode cards shown in every sheet: big, colored, with what each mode does.
const MODES: { mode: StartMode; title: string; desc: string; icon: string; tone: string }[] = [
  { mode: "walkthrough", title: "Walkthrough", desc: "Watch each step appear and ask “why?”", icon: "▶", tone: "blue" },
  { mode: "practice", title: "Step practice", desc: "You write each step, the board checks it", icon: "✎", tone: "pink" },
  { mode: "check", title: "Check my work", desc: "Find the first slip in your solution", icon: "✓", tone: "teal" },
  { mode: "voice", title: "Talk it through", desc: "Say each step out loud, get spoken hints", icon: "🎙", tone: "gold" },
];
// Full class names per color (Tailwind only keeps classes it can see written out in full).
const TONE: Record<string, { icon: string; hover: string; text: string }> = {
  blue: { icon: "bg-blue/15 text-blue", hover: "hover:border-blue/70 hover:shadow-[0_10px_36px_rgba(88,196,221,.2)]", text: "text-blue" },
  pink: { icon: "bg-pink/15 text-pink", hover: "hover:border-pink/70 hover:shadow-[0_10px_36px_rgba(255,122,133,.2)]", text: "text-pink" },
  teal: { icon: "bg-teal/15 text-teal", hover: "hover:border-teal/70 hover:shadow-[0_10px_36px_rgba(79,209,181,.2)]", text: "text-teal" },
  gold: { icon: "bg-gold/20 text-gold", hover: "hover:border-gold/70 hover:shadow-[0_10px_36px_rgba(242,201,76,.2)]", text: "text-gold" },
};
function ModeCards({ disabled, onPick, hint, modes = ["walkthrough", "practice", "check", "voice"] }: {
  disabled: boolean; onPick: (mode: StartMode) => void; hint: string; modes?: StartMode[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="eyebrow text-subtle">{hint}</span>
      <div className={`grid grid-cols-2 gap-3 ${modes.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        {MODES.filter((m) => modes.includes(m.mode)).map((m) => {
          const tone = TONE[m.tone];
          return (
            <button
              key={m.mode}
              disabled={disabled}
              onClick={() => onPick(m.mode)}
              className={`group flex min-h-[132px] flex-col items-start gap-2 rounded-2xl border border-white/10 bg-panel-2 p-4 text-left transition duration-200 enabled:hover:-translate-y-1 enabled:hover:bg-panel-3 disabled:cursor-not-allowed disabled:opacity-40 ${disabled ? "" : tone.hover}`}
            >
              <span className={`flex h-11 w-11 items-center justify-center rounded-full text-lg transition group-enabled:group-hover:scale-110 ${tone.icon}`}>{m.icon}</span>
              <span className="text-lg font-semibold">{m.title}</span>
              <span className="text-sm leading-snug text-muted">{m.desc}</span>
              <span className={`mt-auto text-sm font-semibold opacity-0 transition group-enabled:group-hover:opacity-100 ${tone.text}`}>Start →</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// The home-screen chalkboard: plays the integration-by-parts demo by itself, one step every
// ~2.6 s, so a first-time visitor sees the glide, the colors and the "answer" moment right away.
// It's the real Board component with a saved solution (no AI calls).
function DemoBoard() {
  const [pkg, setPkg] = useState<SolutionPackage | null>(null);
  const [view, setView] = useState(1); // which step is showing (1-based)
  useEffect(() => {
    loadPreset("byparts").then(setPkg).catch(() => {}); // a saved file; if it fails, the board just stays empty
  }, []);
  useEffect(() => {
    if (!pkg) return;
    const last = view >= pkg.steps.length;
    const t = setTimeout(() => setView((v) => (last ? 1 : v + 1)), last ? 4500 : 2600); // linger on the answer, then start over
    return () => clearTimeout(t);
  }, [pkg, view]);
  const height = "h-[clamp(320px,38vh,470px)]";
  if (!pkg) return <div className={height} />;
  const steps = pkg.steps;
  const last = view === steps.length;
  return (
    <div className={`pointer-events-none ${height}`}>
      <Board
        problemLatex={pkg.problem_latex}
        status={last ? "solved ✓" : `step ${view} of ${steps.length}`}
        lines={view >= 2 ? [{ latex: steps[view - 2].latex, mark: "none" }] : []} // just the line before
        firstNumber={view - 1}
        current={{ latex: steps[view - 1].latex, number: view, badge: "gold", tag: steps[view - 1].rule, final: last }}
      />
    </div>
  );
}

// "Upload a photo" sheet (frame B): photo → "We read this as" + the problem → Edit / Retake → mode.
function UploadPanel({ onStart }: { onStart: (choice: StartChoice) => void }) {
  const [thumb, setThumb] = useState<string | null>(null); // the photo, shown small
  const [status, setStatus] = useState<"idle" | "reading" | "read" | "error">("idle");
  const [latex, setLatex] = useState(""); // the problem we read (editable)
  const [work, setWork] = useState<Submission | null>(null); // any solution lines found under the problem
  const [message, setMessage] = useState(""); // error or note from the reader
  const [editing, setEditing] = useState(false); // is the Edit box open?
  const [dragging, setDragging] = useState(false); // is a file being dragged over the drop zone?
  const fileInput = useRef<HTMLInputElement>(null); // the hidden <input type="file">
  const input = useRef<MathInputHandle>(null);

  // Reads one photo: shrink it, show it, send it to the AI, then start pre-solving right away.
  async function handleFile(file: File) {
    setStatus("reading");
    setEditing(false);
    setMessage("");
    try {
      const photo = await preparePhoto(file);
      setThumb(photo.thumb);
      const read = await readPhoto(photo);
      if (!read.readable || !read.problem_latex) {
        setStatus("error");
        setMessage(read.note || "I couldn't find a problem in that photo. Try another one, or type it.");
        return;
      }
      setLatex(read.problem_latex);
      setWork(
        read.lines.length
          ? { source: "photo", thumb: photo.thumb, lines: read.lines.map((l) => l.latex), unclear: read.lines.map((l) => l.unclear), note: read.note }
          : null,
      );
      setMessage(read.note);
      setStatus("read");
      getPackage(read.problem_latex).catch(() => {}); // start pre-solving now (errors show up later, when a mode is picked)
    } catch (err) {
      setStatus("error");
      setMessage(messageOf(err, "Couldn't read that photo."));
    }
  }

  // Ctrl+V of a screenshot works while this sheet is open.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = imageFrom(e.clipboardData);
      if (file) handleFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  });

  function pick(mode: StartMode) {
    if (!latex.trim()) return;
    onStart({ kind: "typed", latex, mode, work: mode === "check" && work ? work : undefined });
  }

  return (
    <>
      {/* Hidden file picker. On a phone, "image/*" offers both the camera and the photo library. */}
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = ""; // so choosing the same file again still triggers
        }}
      />

      {status === "idle" ? (
        <button
          className={`flex h-[200px] flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed transition md:h-[240px] ${dragging ? "border-gold bg-panel-3" : "border-white/20 bg-panel-2 hover:border-blue/60 hover:bg-panel-3"}`}
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = imageFrom(e.dataTransfer);
            if (file) handleFile(file);
          }}
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-blue/15 text-blue"><CameraIcon /></span>
          <span className="text-xl font-semibold md:text-2xl">Take or choose a photo</span>
          <span className="px-4 text-center text-sm text-muted md:text-base">a textbook problem, a screenshot, or your handwritten work · drag it here · or paste (Ctrl+V)</span>
        </button>
      ) : (
        <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-center">
          {thumb && (
            // eslint-disable-next-line @next/next/no-img-element -- a local data URL, nothing for next/image to optimize
            <img src={thumb} alt="Your photo" className="h-[140px] w-[200px] shrink-0 rounded-2xl object-cover" />
          )}
          <span aria-hidden className="hidden text-3xl text-subtle md:block">⇢</span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="eyebrow text-subtle">WE READ THIS AS</span>
            {status === "reading" && <span className="font-hand text-3xl text-muted">reading your photo…</span>}
            {status === "error" && <span className="text-base text-pink">{message}</span>}
            {status === "read" && !editing && (
              <div className="board-surface flex min-h-[88px] items-center rounded-2xl px-5 text-3xl"><Tex latex={latex} /></div>
            )}
            {status === "read" && editing && (
              <MathInput ref={input} initialValue={latex} onChange={setLatex} ariaLabel="Edit the problem" />
            )}
            {status === "read" && message && !editing && <span className="text-sm text-muted">{message}</span>}
          </div>
          <div className="flex shrink-0 gap-2 md:flex-col">
            {status === "read" && (
              <button className="btn h-10" onClick={() => setEditing((e) => !e)}>{editing ? "Done" : "Edit"}</button>
            )}
            <button className="btn h-10" disabled={status === "reading"} onClick={() => fileInput.current?.click()}>Retake photo</button>
          </div>
        </div>
      )}

      {status === "read" && editing && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Math keys">
          {KEYS_PROBLEM.map((k) => (
            <button key={k.label} className="h-10 min-w-11 rounded-[10px] border border-white/15 bg-panel-2 px-3" onClick={() => input.current?.insert(k.insert)}>
              {k.label}
            </button>
          ))}
        </div>
      )}

      <ModeCards
        disabled={status !== "read" || !latex.trim()}
        onPick={pick}
        hint={
          status === "read"
            ? work
              ? `LOOKS RIGHT? PICK HOW TO WORK ON IT · I ALSO FOUND ${work.lines.length} LINE${work.lines.length > 1 ? "S" : ""} OF YOUR WORK (CHECK MY WORK)`
              : "LOOKS RIGHT? PICK HOW TO WORK ON IT"
            : "SNAP THE PROBLEM, THEN PICK HOW TO WORK ON IT"
        }
      />
    </>
  );
}

// "Type it" sheet: math input + live preview + math keys + modes (frame C).
function TypePanel({ onStart }: { onStart: (choice: StartChoice) => void }) {
  const [latex, setLatex] = useState(""); // what the student has typed so far
  const input = useRef<MathInputHandle>(null); // handle for inserting math keys
  const empty = latex.trim() === "";
  return (
    <>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className="eyebrow text-subtle">TYPE THE PROBLEM</span>
          <MathInput ref={input} onChange={setLatex} ariaLabel="Type the problem" placeholder="\int x\ln x\,dx" />
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Math keys">
            {KEYS_PROBLEM.map((k) => (
              <button key={k.label} className="h-11 min-w-12 rounded-xl border border-white/15 bg-panel-2 px-3 text-lg transition hover:bg-panel-3" onClick={() => input.current?.insert(k.insert)}>
                {k.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="eyebrow text-subtle">PREVIEW</span>
          <div className="board-surface flex min-h-[140px] flex-1 items-center justify-center rounded-2xl px-5 text-3xl">
            {empty ? <span className="font-hand text-2xl text-muted">your problem appears here</span> : <Tex latex={latex} display />}
          </div>
        </div>
      </div>
      <ModeCards disabled={empty} hint="LOOKS RIGHT? PICK HOW TO WORK ON IT" onPick={(mode) => onStart({ kind: "typed", latex, mode })} />
    </>
  );
}

// "Try a demo problem" sheet: the 6 demo problems as cards, then the modes (frame D).
function PracticePanel({ onStart }: { onStart: (choice: StartChoice) => void }) {
  const [selected, setSelected] = useState<string | null>(null); // which card is picked
  return (
    <>
      <div className="flex flex-col gap-3">
        <span className="eyebrow text-subtle">1 · PICK A PROBLEM</span>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelected(p.id)}
              aria-pressed={selected === p.id}
              className={`flex h-[128px] flex-col justify-between rounded-2xl border p-4 text-left transition duration-200 hover:-translate-y-0.5 ${
                selected === p.id ? "border-gold bg-panel-3 shadow-[0_0_0_1px_var(--color-gold),0_10px_30px_rgba(242,201,76,.15)]" : "border-white/10 bg-panel-2 hover:border-white/25 hover:bg-panel-3"
              }`}
            >
              <span className="flex w-full items-center justify-between">
                <span className="rounded-full bg-blue/15 px-2.5 py-0.5 text-xs font-medium text-blue">{p.tag}</span>
                {selected === p.id && <span className="text-gold">✓</span>}
              </span>
              <span className="chalk text-2xl"><Tex latex={p.latex} /></span>
            </button>
          ))}
        </div>
      </div>
      <ModeCards
        disabled={!selected}
        hint={selected ? "2 · PICK HOW TO WORK ON IT" : "2 · PICK HOW TO WORK ON IT (CHOOSE A PROBLEM FIRST)"}
        onPick={(mode) => selected && onStart({ kind: "preset", presetId: selected, mode })}
      />
    </>
  );
}

// "Talk it through" sheet: say the problem, check how it was heard, then start Think-aloud.
function TalkPanel({ onStart, onType }: { onStart: (choice: StartChoice) => void; onType: () => void }) {
  const [latex, setLatex] = useState(""); // the problem as heard (editable)
  const [heard, setHeard] = useState<string | null>(null); // the words, as heard
  const [options, setOptions] = useState<string[] | null>(null); // "Did you mean…?" readings
  const [editing, setEditing] = useState(false);
  const input = useRef<MathInputHandle>(null);
  const voice = useVoice({ enabled: true, onClip: handleClip });

  // A clip finished: turn it into the problem's LaTeX.
  async function handleClip(clip: Clip) {
    try {
      const h = await hear(clip, { kind: "problem" });
      setHeard(h.transcript || null);
      if (!h.latex) {
        voice.fail("I didn't catch a problem there. Try again, or type it.");
        return;
      }
      setEditing(false);
      if (h.alternatives.length) {
        setOptions([h.latex, ...h.alternatives].slice(0, 2)); // ask which one before pre-solving
        setLatex("");
      } else choose(h.latex);
      voice.setPhase("idle");
    } catch (err) {
      voice.fail(messageOf(err, "I couldn't hear that. Try again, or type it."));
    }
  }

  // The problem is settled: show it and start pre-solving right away.
  function choose(problem: string) {
    setOptions(null);
    setLatex(problem);
    getPackage(problem).catch(() => {}); // errors show up later, when the session starts
  }

  // Keys 1 and 2 pick a "Did you mean…?" option.
  useEffect(() => {
    if (!options) return;
    const onKey = (e: KeyboardEvent) => {
      const k = Number(e.key);
      if (k >= 1 && k <= options.length) choose(options[k - 1]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  return (
    <>
      <div className="flex flex-col items-center gap-6 md:flex-row md:items-center md:gap-10">
        <div className="shrink-0">
          <MicButton
            phase={voice.phase}
            level={voice.level}
            onPress={voice.press}
            onRelease={voice.release}
            labels={{ idle: "Hold space or the mic, say the problem", writing: "Writing it down…" }}
          />
        </div>
        <div className="flex w-full min-w-0 flex-1 flex-col gap-2">
          <span className="eyebrow text-subtle">{options ? "DID YOU MEAN…?" : "WE HEARD THIS AS"}</span>
          {options ? (
            options.map((o, i) => (
              <button key={i} className="flex h-16 items-center justify-between rounded-2xl border border-blue/45 bg-blue/[.08] px-5 text-2xl hover:bg-blue/15" onClick={() => choose(o)}>
                <Tex latex={o} />
                <kbd className="rounded border border-white/25 px-1.5 font-mono text-[11px] text-muted">{i + 1}</kbd>
              </button>
            ))
          ) : editing ? (
            <MathInput ref={input} initialValue={latex} onChange={setLatex} ariaLabel="Edit the problem" />
          ) : (
            <div className="board-surface flex min-h-[120px] items-center rounded-2xl px-5 text-3xl">
              {latex ? <Tex latex={latex} /> : <span className="font-hand text-2xl text-muted">e.g. “the integral of x times log x, dx”</span>}
            </div>
          )}
          {voice.phase === "error" ? (
            <span className="text-sm text-pink">{voice.error}</span>
          ) : (
            heard && <span className="font-mono text-xs text-muted">“{heard}”</span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-primary" style={{ height: 52, padding: "0 24px", fontSize: 16 }} disabled={!latex.trim() || !!options} onClick={() => onStart({ kind: "typed", latex, mode: "voice" })}>
          Start solving out loud →
        </button>
        {latex && !options && <button className="btn" onClick={() => setEditing((e) => !e)}>{editing ? "Done" : "Edit"}</button>}
        <button className="btn" onClick={onType}>Type it instead</button>
      </div>
    </>
  );
}

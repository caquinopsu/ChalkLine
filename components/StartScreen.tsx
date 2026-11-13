"use client";

// The start screen (DESIGN.md frames A–D): choose how to bring a problem, then pick a mode.
// Layout: a live demo chalkboard, the title, three "bring a problem" cards and a demo-problem button,
// over a faint background of floating chalk math. Each choice opens a large centered sheet; the
// page behind it never moves (it just blurs), so nothing jumps.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { messageOf } from "@/lib/errors"; // friendly error sentences (Phase 5)
import { KEYS_PROBLEM, MathInput, type MathInputHandle } from "./MathInput";
import { RichText, Tex } from "./Tex";
import { Logo } from "./Logo";
import { MicButton } from "./MicButton";
import { PRESETS, loadPreset } from "@/lib/presets";
import { LEVELS, TOPICS, solvedIds } from "@/lib/library";
import { Board } from "./Board"; // the home-screen demo board
import { getPackage } from "@/lib/packages";
import { imageFrom, preparePhoto, readPhoto } from "@/lib/photo";
import { hear, type Clip } from "@/lib/recorder";
import { useVoice } from "@/lib/useVoice";
import { latexToWords, speak } from "@/lib/speak";
import { VoiceTools, useHandsFree } from "./VoiceGuide";
import type { SolutionPackage, Submission } from "@/lib/schemas";

export type StartMode = "walkthrough" | "practice" | "check" | "voice"; // "voice" = Think-aloud
// A worksheet read from one photo: every part, the instructions they share, and which part is open.
export type SetPart = { label: string; latex: string };
export type ProblemSet = { instructions: string; parts: SetPart[]; index: number };
export type StartChoice =
  | { kind: "preset"; presetId: string; mode: StartMode } // a demo problem
  | { kind: "typed"; latex: string; mode: StartMode; work?: Submission; set?: ProblemSet }; // typed or photographed (with any work in the photo, or a whole worksheet)

type Panel = "none" | "upload" | "type" | "talk"; // which sheet is open

export function StartScreen({ onStart, onLibrary }: { onStart: (choice: StartChoice) => void; onLibrary: () => void }) {
  const [panel, setPanel] = useState<Panel>("none");
  const close = () => setPanel("none");

  return (
    <div className="relative isolate flex h-full flex-col overflow-hidden">
      <ChalkBackdrop />

      {/* Header: logo and name */}
      <header className="flex h-14 shrink-0 items-center px-4 md:h-[68px] md:px-10">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="font-display text-xl font-semibold">Chalkline</span>
        </div>
      </header>

      <main className="fade-up flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-hidden px-4 pb-6 md:justify-start md:gap-7 md:pt-[2vh] 2xl:gap-9">
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
            sub="Say the problem, then solve it out loud"
            gold
            onClick={() => setPanel("talk")}
          />
        </div>

        {/* The problem library: solved problems by concept, plus picks for your weak spots */}
        <button
          onClick={onLibrary}
          className="group flex w-full max-w-md items-center gap-4 rounded-[20px] border border-white/10 bg-gradient-to-r from-panel to-panel-2 px-5 py-3.5 text-left transition duration-200 hover:-translate-y-1 hover:border-gold/50 hover:shadow-[0_10px_36px_rgba(242,201,76,.14)] md:max-w-[1040px] 2xl:max-w-[1240px]"
        >
          <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold transition group-hover:scale-110"><BookIcon /></span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[17px] font-semibold 2xl:text-xl">Problem library</span>
            <span className="text-sm text-muted 2xl:text-base">{PRESETS.length} solved problems by concept, and picks for the steps you miss</span>
          </span>
          <span className="ml-auto hidden items-center gap-2 xl:flex">
            {TOPICS.map((t) => (
              <span key={t} className="whitespace-nowrap rounded-full border border-white/10 px-3 py-1 font-hand text-lg text-muted transition group-hover:border-white/20 group-hover:text-text">{t.toLowerCase()}</span>
            ))}
          </span>
          <span aria-hidden className="text-xl text-muted transition group-hover:translate-x-1 group-hover:text-text">→</span>
        </button>
      </main>

      <footer className="hidden shrink-0 pb-4 text-center text-sm text-subtle md:block">
        Talk it through: hold space (or the mic) and say the problem
      </footer>

      {panel === "upload" && <Sheet title="Upload a photo" icon={<CameraIcon />} tint="bg-blue/15 text-blue" onClose={close}><UploadPanel onStart={onStart} /></Sheet>}
      {panel === "type" && <Sheet title="Type it" icon={<span className="font-display text-[26px] leading-none">∫</span>} tint="bg-teal/15 text-teal" onClose={close}><TypePanel onStart={onStart} /></Sheet>}
      {panel === "talk" && <Sheet title="Talk it through" icon={<MicIcon />} tint="bg-gold text-[#14181D]" onClose={close}><TalkPanel onStart={onStart} onType={() => setPanel("type")} /></Sheet>}

    </div>
  );
}

// "New problem" from inside a session: the same four ways to bring a problem, as tabs in one sheet
// over the board, so the student never has to go back to the start screen. Opens on Upload a photo.
type PickTab = "upload" | "type" | "talk" | "practice";
export function NewProblemSheet({ onStart, onClose }: { onStart: (choice: StartChoice) => void; onClose: () => void }) {
  const [tab, setTab] = useState<PickTab>("upload");
  const TABS: { id: PickTab; label: string; icon: ReactNode; on: string }[] = [
    { id: "upload", label: "Upload a photo", icon: <CameraIcon />, on: "border-blue/70 bg-blue/10 text-text" },
    { id: "type", label: "Type it", icon: <span className="font-display text-xl leading-none">∫</span>, on: "border-teal/70 bg-teal/10 text-text" },
    { id: "talk", label: "Talk it through", icon: <MicIcon />, on: "border-gold/70 bg-gold/10 text-text" },
    { id: "practice", label: "From the library", icon: <BookIcon />, on: "border-gold/70 bg-gold/10 text-text" },
  ];
  return (
    <Sheet title="New problem" icon={<span className="text-2xl leading-none">+</span>} tint="bg-gold/15 text-gold" onClose={onClose}>
      <div role="tablist" aria-label="How to bring the problem" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex h-12 items-center gap-2.5 rounded-full border px-5 text-[15px] font-semibold transition ${tab === t.id ? t.on : "border-white/12 text-muted hover:border-white/30 hover:text-text"}`}
          >
            <span className="flex h-6 w-6 items-center justify-center [&_svg]:h-5 [&_svg]:w-5">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "upload" && <UploadPanel onStart={onStart} />}
      {tab === "type" && <TypePanel onStart={onStart} />}
      {tab === "talk" && <TalkPanel onStart={onStart} onType={() => setTab("type")} />}
      {tab === "practice" && <PracticePanel onStart={onStart} />}
    </Sheet>
  );
}

// A large sheet centered over the page (the page behind blurs and dims; click outside or press Esc
// to close). On phones it fills the screen (see ".sheet" in globals.css).
// Closing plays a short exit animation first (fold up + fade), then really closes.
export function Sheet({ title, icon, tint, onClose, children }: { title: string; icon: ReactNode; tint: string; onClose: () => void; children: ReactNode }) {
  const [leaving, setLeaving] = useState(false); // true while the exit animation plays
  const exit = () => {
    if (leaving) return;
    setLeaving(true);
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setTimeout(onClose, calm ? 0 : 220); // wait for the animation (0.22 s) before removing it
  };
  // Esc closes the sheet.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && exit();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  return (
    <div className={`fixed inset-0 z-40 flex items-center justify-center bg-[rgba(42,37,32,.35)] p-4 backdrop-blur-[6px] ${leaving ? "fade-out" : "fade-in"}`} onClick={exit}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`sheet ${leaving ? "sheet-out" : ""} no-bar flex max-h-[90vh] w-[min(1080px,94vw)] flex-col gap-6 overflow-y-auto rounded-[28px] border border-white/10 bg-panel p-6 shadow-[0_30px_80px_rgba(60,45,30,.25)] md:p-9`}
        onClick={(e) => e.stopPropagation()} // clicks inside don't close it
      >
        <div className="flex items-center gap-4">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${tint}`}>{icon}</span>
          <h2 className="flex-1 font-display text-2xl font-semibold md:text-[30px]">{title}</h2>
          {/* round close button: the ✕ turns a quarter turn on hover */}
          <button
            onClick={exit}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-panel-2 text-muted transition duration-200 hover:rotate-90 hover:border-white/35 hover:bg-panel-3 hover:text-text"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
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
          : "border-white/10 bg-panel hover:border-white/25 hover:bg-panel-2 hover:shadow-[0_10px_30px_rgba(60,45,30,.15)]"
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
export function BookIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" />
      <path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" />
      <path d="M9 8h7M9 11.5h5" />
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

// The work-mode cards shown in every sheet: each one is a small chalkboard with a chalk sketch of
// what the mode does (it re-draws itself when you hover), a handwritten title and one line of help.
const MODES: { mode: StartMode; title: string; desc: string; tone: string }[] = [
  { mode: "walkthrough", title: "Walkthrough", desc: "Watch each step appear and see why it works", tone: "blue" },
  { mode: "practice", title: "Step practice", desc: "You write each step, the board checks it", tone: "pink" },
  { mode: "check", title: "Check my work", desc: "Find the first slip in your solution", tone: "teal" },
  { mode: "voice", title: "Talk it through", desc: "Say each step out loud, get spoken hints", tone: "gold" },
];
// Full class names per color (Tailwind only keeps classes it can see written out in full).
const TONE: Record<string, { hover: string; text: string; bar: string }> = {
  blue: { hover: "hover:shadow-[0_14px_40px_rgba(88,196,221,.28)] hover:outline-blue/70", text: "text-blue", bar: "bg-blue" },
  pink: { hover: "hover:shadow-[0_14px_40px_rgba(255,122,133,.28)] hover:outline-pink/70", text: "text-pink", bar: "bg-pink" },
  teal: { hover: "hover:shadow-[0_14px_40px_rgba(79,209,181,.28)] hover:outline-teal/70", text: "text-teal", bar: "bg-teal" },
  gold: { hover: "hover:shadow-[0_14px_40px_rgba(242,201,76,.28)] hover:outline-gold/70", text: "text-gold", bar: "bg-gold" },
};
export function ModeCards({ disabled, onPick, hint, modes = ["walkthrough", "practice", "check", "voice"] }: {
  disabled: boolean; onPick: (mode: StartMode) => void; hint: string; modes?: StartMode[];
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="eyebrow text-muted">{hint}</span>
      <div className={`grid grid-cols-2 gap-4 ${modes.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        {MODES.filter((m) => modes.includes(m.mode)).map((m) => {
          const tone = TONE[m.tone];
          return (
            <button
              key={m.mode}
              disabled={disabled}
              onClick={() => onPick(m.mode)}
              className={`mode-card group flex flex-col overflow-hidden rounded-2xl border-[5px] border-wood text-left outline outline-2 outline-transparent transition duration-200 enabled:hover:-translate-y-1.5 disabled:cursor-not-allowed ${disabled ? "mode-off" : tone.hover}`}
            >
              {/* the board: a sketch of the mode, then the title and what it does */}
              <span className="board-surface flex flex-1 flex-col gap-1.5 px-4 pb-3 pt-3.5">
                <ModeSketch mode={m.mode} />
                <span className="mt-1 font-hand text-[30px] leading-none text-chalk">{m.title}</span>
                <span className="text-[15px] leading-snug text-muted">{m.desc}</span>
              </span>
              {/* the ledge, with a stick of chalk in the mode's color and "start" */}
              <span className="flex h-9 items-center justify-between bg-ledge px-4">
                <span className={`h-1.5 w-8 rounded ${tone.bar}`} />
                <span className={`font-hand text-xl transition ${disabled ? "text-subtle" : `${tone.text} group-hover:translate-x-1`}`}>{disabled ? "waiting…" : "start →"}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// A tiny chalk sketch of each mode (handwriting + a few marks). The pieces with "sk" draw themselves
// in one after another when the card is hovered (see .mode-card in globals.css).
function ModeSketch({ mode }: { mode: StartMode }) {
  const line = "sk flex items-center gap-2 font-hand text-[19px] leading-tight text-chalk/90";
  const n = (k: number) => <span className="w-3 text-center text-[16px] text-muted">{k}</span>;
  const d = (i: number) => ({ "--d": `${i * 0.28}s` }) as React.CSSProperties; // each piece starts a little later
  return (
    <span aria-hidden className="flex h-[82px] flex-col justify-center gap-1">
      {mode === "walkthrough" && (
        <>
          <span className={line} style={d(0)}>{n(1)}u = <span className="text-blue-chalk">ln x</span></span>
          <span className={line} style={d(1)}>{n(2)}<span className="text-gold">½x²</span> ln x − ∫ ½x dx</span>
          <span className={`${line} rounded-md bg-white/[.06] pr-2`} style={d(2)}>{n(3)}½x² ln x − ¼x² <span className="text-teal">+ C</span></span>
        </>
      )}
      {mode === "practice" && (
        <>
          <span className={line} style={d(0)}>{n(1)}u = ln x <span className="text-teal">✓</span></span>
          <span className={line} style={d(1)}>{n(2)}du = <span className="text-teal">1/x dx</span> <span className="text-teal">✓</span></span>
          <span className={line} style={d(2)}>
            {n(3)}<span className="sk-caret inline-block h-5 w-[2px] bg-pink" /><span className="text-pink">✎</span> <span className="text-muted">your step</span>
          </span>
        </>
      )}
      {mode === "check" && (
        <>
          <span className={line} style={d(0)}>{n(1)}u = x² <span className="text-teal">✓</span></span>
          <span className={line} style={d(1)}>{n(2)}∫ eᵘ du <span className="text-teal">✓</span></span>
          <span className={line} style={d(2)}>
            {n(3)}<span className="sk-ring rounded-full px-1 outline outline-2 outline-pink">2</span>eˣ² + C <span className="text-pink">← here</span>
          </span>
        </>
      )}
      {mode === "voice" && (
        <>
          <span className="sk flex h-9 items-end gap-[3px]" style={d(0)}>
            {[10, 22, 34, 18, 28, 14, 30, 20, 12, 26, 16].map((h, i) => (
              <span key={i} className="sk-bar w-[5px] rounded-full bg-gold/80" style={{ height: h, animationDelay: `${i * 0.07}s` }} />
            ))}
          </span>
          <span className={line} style={d(1)}>“u equals <span className="text-blue-chalk">ln x</span>”</span>
        </>
      )}
    </span>
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
  const height = "h-[clamp(240px,33vh,460px)]"; // shrinks on short screens so the home page never scrolls
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

// "Upload a photo" sheet (frame B): photo → "We read this as" (every part on the page, plus the
// worksheet's instructions) → Edit / Retake → pick a part → mode.
function UploadPanel({ onStart }: { onStart: (choice: StartChoice) => void }) {
  const [thumb, setThumb] = useState<string | null>(null); // the photo, shown small
  const [status, setStatus] = useState<"idle" | "reading" | "read" | "error">("idle");
  const [parts, setParts] = useState<SetPart[]>([]); // every problem found on the page (editable)
  const [pickI, setPickI] = useState(0); // which part to start with
  const [instructions, setInstructions] = useState(""); // the task the parts share ("" if none)
  const [work, setWork] = useState<Submission | null>(null); // any solution lines found under the problem
  const [message, setMessage] = useState(""); // error or note from the reader
  const [editing, setEditing] = useState(false); // is the Edit box open?
  const [dragging, setDragging] = useState(false); // is a file being dragged over the drop zone?
  const fileInput = useRef<HTMLInputElement>(null); // the hidden <input type="file">
  const input = useRef<MathInputHandle>(null);
  const latex = parts[pickI]?.latex ?? ""; // the part that will start
  const setLatex = (v: string) => setParts((ps) => ps.map((p, i) => (i === pickI ? { ...p, latex: v } : p)));

  // Reads one photo: shrink it, show it, send it to the AI, then start pre-solving the first part right away.
  async function handleFile(file: File) {
    setStatus("reading");
    setEditing(false);
    setMessage("");
    try {
      const photo = await preparePhoto(file);
      setThumb(photo.thumb);
      const read = await readPhoto(photo);
      // older replies (or a single problem) may come without parts: fall back to problem_latex
      const found = read.parts?.length ? read.parts : read.problem_latex ? [{ label: "1", latex: read.problem_latex }] : [];
      if (!read.readable || !found.length) {
        setStatus("error");
        setMessage(read.note || "I couldn't find a problem in that photo. Try another one, or type it.");
        return;
      }
      setParts(found);
      setPickI(0);
      setInstructions(read.instructions ?? "");
      setWork(
        read.lines.length && found.length === 1
          ? { source: "photo", thumb: photo.thumb, lines: read.lines.map((l) => l.latex), unclear: read.lines.map((l) => l.unclear), note: read.note }
          : null,
      );
      setMessage(read.note);
      setStatus("read");
      getPackage(found[0].latex, read.instructions ?? "").catch(() => {}); // start pre-solving part 1 now (errors show up later)
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
    const set = parts.length > 1 || instructions ? { instructions, parts, index: pickI } : undefined; // a worksheet: remember every part
    onStart({ kind: "typed", latex, mode, work: mode === "check" && work ? work : undefined, set });
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
          <span className="px-4 text-center text-sm text-muted md:text-base">a worksheet, a textbook problem, a screenshot, or your handwritten work · drag it here · or paste (Ctrl+V)</span>
        </button>
      ) : (
        <div className="flex flex-col items-stretch gap-4 md:flex-row md:items-start">
          {thumb && (
            // eslint-disable-next-line @next/next/no-img-element -- a local data URL, nothing for next/image to optimize
            <img src={thumb} alt="Your photo" className="h-[140px] w-[200px] shrink-0 rounded-2xl object-cover" />
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="eyebrow text-muted">
              {parts.length > 1 ? `WE FOUND ${parts.length} PARTS · PICK ONE TO START` : "WE READ THIS AS"}
            </span>
            {status === "reading" && <span className="font-hand text-3xl text-muted">reading your photo…</span>}
            {status === "error" && <span className="text-base text-pink">{message}</span>}
            {status === "read" && instructions && <RichText className="text-lg leading-snug text-text" text={instructions} />}
            {status === "read" && parts.length > 1 && !editing && (
              // every part as a chalk card; the gold one starts (you can switch parts later from the board)
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {parts.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => setPickI(i)}
                    aria-pressed={pickI === i}
                    className={`board-surface flex min-h-[72px] items-center gap-3 rounded-2xl px-4 text-left text-[22px] transition ${pickI === i ? "outline outline-[2.5px] outline-gold" : "opacity-75 hover:opacity-100"}`}
                  >
                    <span className={`font-hand text-2xl ${pickI === i ? "text-gold" : "text-muted"}`}>{p.label}.</span>
                    <span className="min-w-0 overflow-hidden whitespace-nowrap py-1"><Tex latex={p.latex} /></span>
                  </button>
                ))}
              </div>
            )}
            {status === "read" && parts.length <= 1 && !editing && (
              <div className="board-surface flex min-h-[88px] items-center rounded-2xl px-5 text-3xl"><Tex latex={latex} /></div>
            )}
            {status === "read" && editing && (
              <MathInput key={pickI} ref={input} initialValue={latex} onChange={setLatex} ariaLabel="Edit the problem" />
            )}
            {status === "read" && message && !editing && <span className="text-sm text-muted">{message}</span>}
          </div>
          <div className="flex shrink-0 gap-2 md:flex-col">
            {status === "read" && (
              <button className="btn h-10" onClick={() => setEditing((e) => !e)}>{editing ? "Done" : parts.length > 1 ? `Edit part ${parts[pickI]?.label}` : "Edit"}</button>
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
              : parts.length > 1
                ? `PICK HOW TO WORK ON PART ${parts[pickI]?.label}`
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
          <span className="eyebrow text-muted">TYPE THE PROBLEM</span>
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
          <span className="eyebrow text-muted">PREVIEW</span>
          <div className="board-surface flex min-h-[140px] flex-1 items-center justify-center rounded-2xl px-5 text-3xl">
            {empty ? <span className="font-hand text-2xl text-muted">your problem appears here</span> : <Tex latex={latex} display />}
          </div>
        </div>
      </div>
      <ModeCards disabled={empty} hint="LOOKS RIGHT? PICK HOW TO WORK ON IT" onPick={(mode) => onStart({ kind: "typed", latex, mode })} />
    </>
  );
}

// "From the library" (in the New problem sheet): filter by topic, pick a problem, pick a mode.
function PracticePanel({ onStart }: { onStart: (choice: StartChoice) => void }) {
  const [topic, setTopic] = useState<string>(TOPICS[0]); // which topic's problems are showing
  const [selected, setSelected] = useState<string | null>(null); // which card is picked
  const [solved] = useState(solvedIds); // problems already solved get a ✓ (read once)
  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {TOPICS.map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className={`rounded-full border px-4 py-1.5 font-hand text-xl transition ${topic === t ? "border-gold/70 bg-gold/10 text-gold" : "border-white/12 text-muted hover:border-white/30 hover:text-text"}`}
            >
              {t.toLowerCase()}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
          {PRESETS.filter((p) => p.topic === topic).map((p) => (
            <ProblemCard key={p.id} problem={p} solved={solved.has(p.id)} selected={selected === p.id} onClick={() => setSelected(p.id)} />
          ))}
        </div>
      </div>
      <ModeCards
        disabled={!selected}
        hint={selected ? "pick how to work on it" : "pick a problem, then how to work on it"}
        onPick={(mode) => selected && onStart({ kind: "preset", presetId: selected, mode })}
      />
    </>
  );
}

// One library problem as a small chalkboard: the technique, how hard it is, and the problem itself.
export function ProblemCard({ problem, solved, selected = false, onClick }: { problem: (typeof PRESETS)[number]; solved: boolean; selected?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={selected}
      className={`board-surface group flex h-[150px] w-full flex-col justify-between rounded-2xl border-[4px] border-wood p-4 text-left outline outline-2 transition duration-200 hover:-translate-y-1 ${
        selected ? "outline-gold shadow-[0_10px_30px_rgba(242,201,76,.2)]" : "outline-transparent hover:outline-white/25"
      }`}
    >
      <span className="flex w-full items-center gap-2">
        <span className="min-w-0 truncate rounded-full bg-blue/15 px-3 py-0.5 text-sm font-semibold text-blue">{problem.tag}</span>
        <span className="flex shrink-0 gap-[3px]" title={LEVELS[problem.level]} aria-label={LEVELS[problem.level]}>
          {[1, 2, 3].map((k) => <span key={k} className={`h-2 w-2 rounded-full ${k <= problem.level ? "bg-gold" : "bg-white/15"}`} />)}
        </span>
        {solved && <span className="ml-auto shrink-0 whitespace-nowrap font-hand text-xl leading-none text-teal" title="Solved">✓ solved</span>}
      </span>
      <span className="chalk block max-w-full overflow-hidden whitespace-nowrap py-1 text-[28px] leading-none"><Tex latex={problem.latex} /></span>
      <span className="truncate font-hand text-lg text-gold/80"><RichText text={problem.task} /></span>
    </button>
  );
}

// "Talk it through" sheet: say the problem, check how it was heard, then start Think-aloud.
// Spoken commands work here too: "next" starts solving, "scratch that" clears it, "the first one" picks.
function TalkPanel({ onStart, onType }: { onStart: (choice: StartChoice) => void; onType: () => void }) {
  const [latex, setLatex] = useState(""); // the problem as heard (editable)
  const [heard, setHeard] = useState<string | null>(null); // the words, as heard
  const [note, setNote] = useState<string | null>(null); // a short reply to a spoken command
  const [options, setOptions] = useState<string[] | null>(null); // "Did you mean…?" readings
  const [editing, setEditing] = useState(false);
  const [handsFree, setHandsFree] = useHandsFree(); // keep the mic open (shared with Think-aloud)
  const input = useRef<MathInputHandle>(null);
  const voice = useVoice({ enabled: true, onClip: handleClip, handsFree });

  // A clip finished: turn it into the problem's LaTeX, or do the command that was said.
  async function handleClip(clip: Clip) {
    try {
      const h = await hear(clip, { kind: "problem", choices: options?.length ?? 0, handsFree });
      setHeard(h.transcript || null);
      setNote(null);
      if (h.intent === "next") {
        if (latex.trim() && !options) return onStart({ kind: "typed", latex, mode: "voice" }); // hands-free: "next" = start solving
        setNote(options ? "Pick one first: say “the first one” or “the second one”." : "Say the problem first, then “next”.");
      } else if (h.intent === "undo") {
        setOptions(null); // "scratch that": clear it and listen again
        setLatex("");
        setNote("Okay, cleared. Say the problem again.");
      } else if (h.intent === "choose") {
        const pick = options?.[(h.choice ?? 0) - 1];
        if (pick) choose(pick);
        else setNote("There's nothing to choose right now.");
      } else if (h.intent === "repeat") {
        if (latex) speak(`I heard: ${latexToWords(latex)}.`);
        else setNote("I haven't heard a problem yet.");
      } else if (h.intent === "pause") {
        if (handsFree) voice.pause();
        setNote("Paused. Tap the mic when you're ready.");
      } else if (h.latex) {
        setEditing(false);
        if (h.alternatives.length) {
          setOptions([h.latex, ...h.alternatives].slice(0, 2)); // ask which one before pre-solving
          setLatex("");
        } else choose(h.latex);
      } else if (!handsFree) {
        voice.fail("I didn't catch a problem there. Try again, or type it.");
        return;
      } // (hands-free: thinking out loud is ignored)
      if (!(handsFree && h.intent === "pause")) voice.setPhase("idle");
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
        <div className="flex shrink-0 flex-col items-center gap-3">
          <MicButton
            phase={voice.phase}
            level={voice.level}
            onPress={voice.press}
            onRelease={voice.release}
            labels={{ idle: "Hold space or the mic (or tap), say the problem", writing: "Writing it down…" }}
            handsFree={handsFree}
            waiting={voice.waiting}
            paused={voice.paused}
          />
          <VoiceTools handsFree={handsFree} onHandsFree={setHandsFree} onOpenGuide={() => handsFree && voice.pause()} />
        </div>
        <div className="flex w-full min-w-0 flex-1 flex-col gap-2">
          <span className="eyebrow text-muted">{options ? "DID YOU MEAN…?" : "WE HEARD THIS AS"}</span>
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
          <span aria-live="polite" className="flex flex-col gap-1">
            {voice.phase === "error" ? (
              <span className="text-sm text-pink">{voice.error}</span>
            ) : (
              heard && <span className="font-mono text-xs text-muted">“{heard}”</span>
            )}
            {note && <span className="text-sm text-text">{note}</span>}
          </span>
          {latex && !options && <span className="text-sm text-muted">Looks right? Say “next” or press Start. Wrong? Say “scratch that”.</span>}
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

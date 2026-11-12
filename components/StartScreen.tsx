"use client";

// The start screen (DESIGN.md frames A–D): choose how to bring a problem, then pick a mode.
import { useEffect, useRef, useState } from "react";
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

type Panel = "none" | "upload" | "type" | "practice" | "talk"; // which dropdown is open

export function StartScreen({ onStart }: { onStart: (choice: StartChoice) => void }) {
  const [panel, setPanel] = useState<Panel>("none");
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? "none" : p)); // click again to close
  const open = panel !== "none";
  const dim = open ? "opacity-40 pointer-events-none" : ""; // dim everything except the open panel
  const fade = (p: Panel) => (open && panel !== p ? "pointer-events-none opacity-35" : ""); // the other entry cards

  return (
    <div className="flex h-full flex-col">
      {/* Header: logo and name left, a short promise right */}
      <header className={`flex h-14 shrink-0 items-center justify-between px-4 transition-opacity md:h-[68px] md:px-10 ${dim}`}>
        <div className="flex items-center gap-3">
          <Logo />
          <span className="font-display text-xl font-semibold">Chalkline</span>
        </div>
        <span className="hidden text-sm text-subtle md:block">Calculus I &amp; II · free · no sign-up</span>
      </header>

      {/* The page never jumps: everything stays put, and when a dropdown opens the demo board
          rolls up smoothly (its grid row shrinks to 0) so the dropdown has room below the buttons. */}
      <main className="no-bar fade-up flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-4 pb-6 md:justify-start md:gap-7 md:overflow-visible md:pt-[2vh]">
        {/* Laptop: a live chalkboard that solves a demo problem on its own (hidden on phones) */}
        <div
          className={`hidden w-full max-w-[1040px] transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(.3,.7,.3,1)] md:grid ${
            open ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100"
          }`}
          aria-hidden
        >
          <div className="min-h-0 overflow-hidden">
            <DemoBoard paused={open} />
          </div>
        </div>

        <div className={`text-center transition-opacity ${dim}`}>
          <h1 className="font-display text-[34px] font-semibold leading-tight md:text-[50px]">What are we solving today?</h1>
          <p className="mt-1 font-hand text-2xl text-gold md:text-[32px]">See the math move.</p>
        </div>

        {/* Three ways to bring a problem. The dropdowns open under this row. */}
        <div className="relative grid w-full max-w-md grid-cols-1 gap-3 md:max-w-[1040px] md:grid-cols-3 md:gap-4">
          <EntryCard
            icon={<CameraIcon />}
            tint="bg-blue/15 text-blue"
            title="Upload a photo"
            sub="A textbook page, screenshot or your work"
            open={panel === "upload"}
            className={fade("upload")}
            onClick={() => toggle("upload")}
          />
          <EntryCard
            icon={<span className="font-display text-[28px] leading-none">∫</span>}
            tint="bg-teal/15 text-teal"
            title="Type it"
            sub="Math keys and a live chalk preview"
            open={panel === "type"}
            className={fade("type")}
            onClick={() => toggle("type")}
          />
          <EntryCard
            icon={<MicIcon />}
            tint="bg-gold text-[#14181D]"
            title="Talk it through"
            badge="SIGNATURE"
            sub="Say the problem, then solve it out loud"
            open={panel === "talk"}
            gold
            className={fade("talk")}
            onClick={() => toggle("talk")}
          />

          {panel === "talk" && <TalkPanel onStart={onStart} onType={() => setPanel("type")} />}
          {panel === "upload" && <UploadPanel onStart={onStart} />}
          {panel === "type" && <TypePanel onStart={onStart} />}
        </div>

        <div className="relative flex w-full max-w-md flex-col items-center md:max-w-[1040px]">
          <button
            className={`flex h-12 items-center gap-2 rounded-full border border-white/15 px-6 text-[15px] font-semibold transition hover:bg-panel-2 ${panel === "practice" ? "bg-panel-3" : ""} ${fade("practice")}`}
            aria-expanded={panel === "practice"}
            onClick={() => toggle("practice")}
          >
            <span className="text-gold">▶</span> Try a demo problem <span aria-hidden className="text-muted">{panel === "practice" ? "▴" : "▾"}</span>
          </button>
          {panel === "practice" && <PracticePanel onStart={onStart} />}
        </div>
      </main>

      {/* Phones: panels open as full-screen sheets that cover their button, so give them a close button */}
      {open && (
        <div className="fixed right-3 top-2 z-50 md:hidden">
          <button className="btn h-10 bg-panel" onClick={() => setPanel("none")} aria-label="Close panel">✕ Close</button>
        </div>
      )}

      <footer className={`hidden shrink-0 pb-4 text-center text-sm text-subtle transition-opacity md:block ${dim}`}>
        Talk it through: hold space (or the mic) and say the problem
      </footer>
    </div>
  );
}

// One of the three big "bring a problem" cards: an icon, a title, one line of help, a ▾.
function EntryCard({ icon, tint, title, sub, badge, open, gold = false, className = "", onClick }: {
  icon: React.ReactNode; tint: string; title: string; sub: string; badge?: string; open: boolean; gold?: boolean; className?: string; onClick: () => void;
}) {
  return (
    <button
      aria-expanded={open}
      onClick={onClick}
      className={`group relative flex h-[92px] items-center gap-4 rounded-[20px] border px-4 text-left transition duration-200 md:h-[104px] md:px-5 ${
        open
          ? "border-gold/70 bg-panel-3"
          : gold
            ? "border-gold/50 bg-panel shadow-[0_0_30px_rgba(242,201,76,.12)] hover:-translate-y-0.5 hover:border-gold"
            : "border-white/10 bg-panel hover:-translate-y-0.5 hover:border-white/25 hover:bg-panel-2"
      } ${className}`}
    >
      <span className={`flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full ${tint}`}>{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2 text-[17px] font-semibold">
          {title}
          {badge && <span className="absolute -top-2.5 right-5 rounded-full bg-gold px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-[#14181D]">{badge}</span>}
        </span>
        <span className="text-sm leading-snug text-muted">{sub}</span>
      </span>
      <span aria-hidden className="text-muted transition group-hover:text-text">{open ? "▴" : "▾"}</span>
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

// The home-screen chalkboard: plays the integration-by-parts demo by itself, one step every
// ~2.6 s, so a first-time visitor sees the glide, the colors and the "answer" moment right away.
// It's the real Board component with a saved solution (no AI calls). It pauses while a dropdown is open.
function DemoBoard({ paused }: { paused: boolean }) {
  const [pkg, setPkg] = useState<SolutionPackage | null>(null);
  const [view, setView] = useState(1); // which step is showing (1-based)
  useEffect(() => {
    loadPreset("byparts").then(setPkg).catch(() => {}); // a saved file; if it fails, the board just stays empty
  }, []);
  useEffect(() => {
    if (!pkg || paused) return;
    const last = view >= pkg.steps.length;
    const t = setTimeout(() => setView((v) => (last ? 1 : v + 1)), last ? 4500 : 2600); // linger on the answer, then start over
    return () => clearTimeout(t);
  }, [pkg, view, paused]);
  if (!pkg) return <div className="h-[370px]" />;
  const steps = pkg.steps;
  const last = view === steps.length;
  return (
    <div className="pointer-events-none h-[370px]">
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

// The three mode buttons shown at the bottom of every panel.
function ModeButtons({ disabled, onPick }: { disabled: boolean; onPick: (mode: StartMode) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      <button className="btn" disabled={disabled} onClick={() => onPick("walkthrough")}>Walkthrough</button>
      <button className="btn" disabled={disabled} onClick={() => onPick("practice")}>Step practice</button>
      <button className="btn" disabled={disabled} onClick={() => onPick("check")}>Check my work</button>
    </div>
  );
}

// "Upload a photo" dropdown (frame B): photo → "We read this as" + the problem → Edit / Retake → mode.
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

  // Ctrl+V of a screenshot works while this panel is open.
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
    <div className="absolute left-1/2 top-full z-20 mt-3 sheet flex w-[760px] md:-translate-x-1/2 flex-col gap-4 rounded-[20px] border border-white/10 bg-panel p-5 shadow-2xl">
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
          className={`flex h-[150px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed ${dragging ? "border-gold bg-panel-3" : "border-white/20 bg-panel-2 hover:bg-panel-3"}`}
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
          <span className="text-lg font-semibold">Take or choose a photo</span>
          <span className="text-sm text-muted">a textbook problem, a screenshot, or your handwritten work · or drag it here · or paste (Ctrl+V)</span>
        </button>
      ) : (
        <div className="flex items-center gap-4">
          {thumb && (
            // eslint-disable-next-line @next/next/no-img-element -- a local data URL, nothing for next/image to optimize
            <img src={thumb} alt="Your photo" className="h-[110px] w-[150px] shrink-0 rounded-xl object-cover" />
          )}
          <span aria-hidden className="text-2xl text-subtle">⇢</span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="eyebrow text-subtle">WE READ THIS AS</span>
            {status === "reading" && <span className="font-hand text-2xl text-muted">reading your photo…</span>}
            {status === "error" && <span className="text-sm text-pink">{message}</span>}
            {status === "read" && !editing && (
              <div className="board-surface flex min-h-[64px] items-center rounded-xl px-4 text-2xl"><Tex latex={latex} /></div>
            )}
            {status === "read" && editing && (
              <MathInput ref={input} initialValue={latex} onChange={setLatex} ariaLabel="Edit the problem" />
            )}
            {status === "read" && message && !editing && <span className="text-xs text-muted">{message}</span>}
          </div>
          <div className="flex shrink-0 flex-col gap-2">
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
            <button key={k.label} className="h-9 min-w-10 rounded-[10px] border border-white/15 bg-panel-2 px-3" onClick={() => input.current?.insert(k.insert)}>
              {k.label}
            </button>
          ))}
        </div>
      )}

      <p className="text-sm text-muted">
        {status === "read"
          ? work
            ? `Looks right? Pick how you want to work on it. (I also found ${work.lines.length} line${work.lines.length > 1 ? "s" : ""} of your work: pick Check my work to check them.)`
            : "Looks right? Pick how you want to work on it."
          : "Snap the problem, then pick how you want to work on it."}
      </p>
      <ModeButtons disabled={status !== "read" || !latex.trim()} onPick={pick} />
    </div>
  );
}

// "Type it" dropdown: math input + live preview + math keys + mode buttons (frame C).
function TypePanel({ onStart }: { onStart: (choice: StartChoice) => void }) {
  const [latex, setLatex] = useState(""); // what the student has typed so far
  const input = useRef<MathInputHandle>(null); // handle for inserting math keys
  const empty = latex.trim() === "";
  return (
    <div className="absolute left-1/2 top-full z-20 mt-3 sheet flex w-[760px] md:-translate-x-1/2 flex-col gap-4 rounded-[20px] border border-white/10 bg-panel p-5 shadow-2xl">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <span className="eyebrow text-subtle">TYPE THE PROBLEM</span>
          <MathInput ref={input} onChange={setLatex} ariaLabel="Type the problem" placeholder="\int x\ln x\,dx" />
        </div>
        <div className="flex flex-col gap-2">
          <span className="eyebrow text-subtle">PREVIEW</span>
          <div className="board-surface flex min-h-[80px] items-center justify-center rounded-xl px-4 text-2xl">
            {empty ? <span className="font-hand text-xl text-muted">your problem appears here</span> : <Tex latex={latex} display />}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Math keys">
        {KEYS_PROBLEM.map((k) => (
          <button key={k.label} className="h-10 min-w-11 rounded-[10px] border border-white/15 bg-panel-2 px-3" onClick={() => input.current?.insert(k.insert)}>
            {k.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted">Looks right? Pick how you want to work on it.</p>
      <ModeButtons disabled={empty} onPick={(mode) => onStart({ kind: "typed", latex, mode })} />
    </div>
  );
}

// "Practice" dropdown: the 6 demo problems as cards, then "Start as" (frame D).
function PracticePanel({ onStart }: { onStart: (choice: StartChoice) => void }) {
  const [selected, setSelected] = useState<string | null>(null); // which card is picked
  return (
    <div className="absolute left-1/2 top-full z-20 mt-3 sheet flex w-[760px] flex-col md:-translate-x-1/2 gap-4 rounded-[20px] border border-white/10 bg-panel p-5 shadow-2xl">
      <span className="eyebrow text-subtle">PICK A DEMO PROBLEM</span>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p.id)}
            aria-pressed={selected === p.id}
            className={`flex h-[100px] flex-col justify-between rounded-2xl border p-3 text-left ${
              selected === p.id ? "border-gold bg-panel-3" : "border-white/10 bg-panel-2 hover:bg-panel-3"
            }`}
          >
            <span className="self-start rounded-full bg-blue/15 px-2 py-0.5 text-[11px] font-medium text-blue">{p.tag}</span>
            <span className="chalk text-xl"><Tex latex={p.latex} /></span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-muted">Start as:</span>
        <button className="btn border-gold/60 text-gold" disabled={!selected} onClick={() => selected && onStart({ kind: "preset", presetId: selected, mode: "voice" })}>
          Talk it through
        </button>
        <ModeButtons disabled={!selected} onPick={(mode) => selected && onStart({ kind: "preset", presetId: selected, mode })} />
      </div>
    </div>
  );
}

// "Talk it through" dropdown: say the problem, check how it was heard, then start Think-aloud.
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
    <div className="absolute left-1/2 top-full z-20 mt-3 sheet flex w-[760px] md:-translate-x-1/2 flex-col gap-4 rounded-[20px] border border-white/10 bg-panel p-5 shadow-2xl">
      <div className="flex items-center gap-6">
        <MicButton
          phase={voice.phase}
          level={voice.level}
          onPress={voice.press}
          onRelease={voice.release}
          labels={{ idle: "Hold space or the mic, say the problem", writing: "Writing it down…" }}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="eyebrow text-subtle">{options ? "DID YOU MEAN…?" : "WE HEARD THIS AS"}</span>
          {options ? (
            options.map((o, i) => (
              <button key={i} className="flex h-14 items-center justify-between rounded-xl border border-blue/45 bg-blue/[.08] px-4 text-xl hover:bg-blue/15" onClick={() => choose(o)}>
                <Tex latex={o} />
                <kbd className="rounded border border-white/25 px-1.5 font-mono text-[11px] text-muted">{i + 1}</kbd>
              </button>
            ))
          ) : editing ? (
            <MathInput ref={input} initialValue={latex} onChange={setLatex} ariaLabel="Edit the problem" />
          ) : (
            <div className="board-surface flex min-h-[64px] items-center rounded-xl px-4 text-2xl">
              {latex ? <Tex latex={latex} /> : <span className="font-hand text-xl text-muted">e.g. “the integral of x times log x, dx”</span>}
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
        <button className="btn btn-primary" disabled={!latex.trim() || !!options} onClick={() => onStart({ kind: "typed", latex, mode: "voice" })}>
          Start solving out loud
        </button>
        {latex && !options && <button className="btn" onClick={() => setEditing((e) => !e)}>{editing ? "Done" : "Edit"}</button>}
        <button className="btn" onClick={onType}>Type it instead</button>
      </div>
    </div>
  );
}

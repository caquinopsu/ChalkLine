"use client";

// The start screen (DESIGN.md frames A–D): choose how to bring a problem, then pick a mode.
import { useEffect, useRef, useState } from "react";
import { KEYS_PROBLEM, MathInput, type MathInputHandle } from "./MathInput";
import { Tex } from "./Tex";
import { Logo } from "./Logo";
import { PRESETS } from "@/lib/presets";
import { getPackage } from "@/lib/packages";
import { imageFrom, preparePhoto, readPhoto } from "@/lib/photo";
import type { Submission } from "@/lib/schemas";

export type StartMode = "walkthrough" | "practice" | "check"; // the modes built so far
export type StartChoice =
  | { kind: "preset"; presetId: string; mode: StartMode } // a demo problem
  | { kind: "typed"; latex: string; mode: StartMode; work?: Submission }; // typed or photographed (with any work in the photo)

type Panel = "none" | "upload" | "type" | "practice"; // which dropdown is open

export function StartScreen({ onStart }: { onStart: (choice: StartChoice) => void }) {
  const [panel, setPanel] = useState<Panel>("none");
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? "none" : p)); // click again to close
  const dim = panel !== "none" ? "opacity-40 pointer-events-none" : ""; // dim everything except the open panel

  return (
    <div className="flex h-full flex-col">
      {/* Header: logo left, skills/history right (stretch features, not built yet) */}
      <header className={`flex h-[72px] items-center justify-between px-10 ${dim}`}>
        <div className="flex items-center gap-3">
          <Logo />
          <span className="font-display text-xl font-semibold">Chalkline</span>
        </div>
        <div className="flex gap-2">
          <button className="btn" disabled title="Coming later">My skills</button>
          <button className="btn" disabled title="Coming later">History</button>
        </div>
      </header>

      {/* The rail the board is "rolled up" in */}
      <div className={`relative mx-20 h-4 rounded bg-wood ${dim}`}>
        <span className="absolute left-1/2 top-full h-3 w-10 -translate-x-1/2 rounded-b bg-wood" />
      </div>

      {/* Centered when resting; moves up when a dropdown is open so the panel fits without scrolling */}
      <main className={`flex flex-1 flex-col items-center gap-8 px-4 ${panel === "none" ? "justify-center" : "justify-start pt-8"}`}>
        <div className={`text-center ${dim}`}>
          <h1 className="font-display text-[56px] font-semibold leading-tight">What are we solving today?</h1>
          <p className="mt-2 text-xl italic text-[#C9C3B5]">See the math move.</p>
        </div>

        {/* The action row */}
        <div className="relative flex items-end gap-6">
          <div className="flex flex-col gap-2">
            <span className={`eyebrow text-subtle ${dim}`}>BRING A PROBLEM</span>
            <div className="flex gap-2 rounded-[18px] bg-panel p-2">
              <button
                className={`btn h-16 w-[230px] justify-between ${panel === "upload" ? "bg-panel-3" : panel === "type" ? dim : ""}`}
                aria-expanded={panel === "upload"}
                onClick={() => toggle("upload")}
              >
                Upload a photo <span aria-hidden>{panel === "upload" ? "▴" : "▾"}</span>
              </button>
              <button
                className={`btn h-16 w-[230px] justify-between ${panel === "type" ? "bg-panel-3" : panel === "upload" ? dim : ""}`}
                aria-expanded={panel === "type"}
                onClick={() => toggle("type")}
              >
                Type it <span aria-hidden>{panel === "type" ? "▴" : "▾"}</span>
              </button>
            </div>
          </div>
          <span className={`pb-5 text-muted ${dim}`}>or</span>
          <button
            className={`flex h-24 items-center gap-4 rounded-[22px] border border-gold/60 bg-panel px-5 text-left ${panel === "none" ? "opacity-60" : "pointer-events-none opacity-30"}`}
            disabled
            title="Think-aloud voice mode arrives in Phase 3"
          >
            <span className="flex h-[60px] w-[60px] items-center justify-center rounded-full bg-gold text-2xl text-[#14181D]">🎙</span>
            <span className="flex flex-col">
              <span className="flex items-center gap-2 font-semibold">
                Talk it through <span className="rounded-full bg-gold/15 px-2 py-0.5 text-[10px] text-gold">SIGNATURE · SOON</span>
              </span>
              <span className="text-sm text-muted">Say the problem, solve it on paper, out loud</span>
            </span>
          </button>

          {panel === "upload" && <UploadPanel onStart={onStart} />}
          {panel === "type" && <TypePanel onStart={onStart} />}
          {panel === "practice" && <PracticePanel onStart={onStart} />}
        </div>

        <button
          className={`btn ${panel === "practice" ? "bg-panel-3" : ""} ${panel === "type" || panel === "upload" ? dim : ""}`}
          aria-expanded={panel === "practice"}
          onClick={() => toggle("practice")}
        >
          Practice · demo problems <span aria-hidden>{panel === "practice" ? "▴" : "▾"}</span>
        </button>
      </main>

      <footer className={`pb-5 text-center text-sm text-subtle ${dim}`}>Voice mode (hold space to talk) is coming soon</footer>
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
      setMessage(err instanceof Error ? err.message : "Couldn't read that photo.");
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
    <div className="absolute left-0 top-full z-20 mt-3 flex w-[760px] flex-col gap-4 rounded-[20px] border border-white/10 bg-panel p-5 shadow-2xl">
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
    <div className="absolute left-0 top-full z-20 mt-3 flex w-[760px] flex-col gap-4 rounded-[20px] border border-white/10 bg-panel p-5 shadow-2xl">
      <div className="grid grid-cols-2 gap-4">
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
    <div className="absolute left-1/2 top-full z-20 mt-16 flex w-[760px] -translate-x-1/2 flex-col gap-4 rounded-[20px] border border-white/10 bg-panel p-5 shadow-2xl">
      <span className="eyebrow text-subtle">PICK A DEMO PROBLEM</span>
      <div className="grid grid-cols-3 gap-3">
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
            <span className="text-lg"><Tex latex={p.latex} /></span>
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-sm text-muted">Start as:</span>
        <button className="btn" disabled title="Coming in Phase 3">Talk it through</button>
        <ModeButtons disabled={!selected} onPick={(mode) => selected && onStart({ kind: "preset", presetId: selected, mode })} />
      </div>
    </div>
  );
}

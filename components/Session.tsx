"use client";

// The session screen (DESIGN.md frames F, G, K): header + board + tray.
// Holds all the state for Walkthrough (Mode A), Step practice (Mode C) and the finish board.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Board, Mark, type BoardLine, type CurrentLine } from "./Board";
import { KEYS_PRACTICE, MathInput, type MathInputHandle } from "./MathInput";
import { RichText, Tex, ringError } from "./Tex";
import { Logo } from "./Logo";
import { logAttempt } from "@/lib/attempts";
import type { CheckResult, SolutionPackage } from "@/lib/schemas";

export type SessionMode = "walkthrough" | "practice" | "finished";

// A line in Step practice progress (what's been accepted on the board).
type ProgressLine = BoardLine & { sympy: string | null };

type Overlay = { kind: "why" | "side"; stepIndex: number } | null; // the panel over the board

type Props = {
  pkg: SolutionPackage | null; // null while the solution is still being prepared
  problemId: string; // preset id or "custom"
  problemLatex: string; // shown in the header row even before pkg arrives
  initialMode: "walkthrough" | "practice";
  loadError: string | null; // if preparing the solution failed
  onNewProblem: () => void; // back to the start screen
};

export function Session({ pkg, problemId, problemLatex, initialMode, loadError, onNewProblem }: Props) {
  const [mode, setMode] = useState<SessionMode>(initialMode);
  const [view, setView] = useState(1); // Walkthrough: how many reference steps are shown
  const [playing, setPlaying] = useState(false); // Walkthrough autoplay on/off
  const [progress, setProgress] = useState<ProgressLine[]>([]); // Step practice: accepted lines
  const [expected, setExpected] = useState(0); // Step practice: index of the reference step expected next
  const [draft, setDraft] = useState(""); // Step practice: what's being typed (LaTeX)
  const [attempt, setAttempt] = useState(1); // tries at the current step
  const [hintUsed, setHintUsed] = useState(false); // asked for Hint or "show me" on the current step
  const [showHint, setShowHint] = useState(false); // is the hint text revealed?
  const [result, setResult] = useState<CheckResult | null>(null); // the last check's verdict
  const [wrongLine, setWrongLine] = useState<string | null>(null); // the rejected line (with its pink ring)
  const [checkedDraft, setCheckedDraft] = useState(""); // the text that was rejected (the ring shows until they edit it)
  const [showFix, setShowFix] = useState(false); // show the teal corrected line?
  const [checking, setChecking] = useState(false); // waiting for /api/check-step
  const [checkError, setCheckError] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [stats, setStats] = useState({ firstTry: 0, hints: 0 }); // for the finish summary
  const [finishedFrom, setFinishedFrom] = useState<"walkthrough" | "practice">(initialMode);
  const input = useRef<MathInputHandle>(null);

  const steps = pkg?.steps ?? [];
  const total = steps.length;

  // Walkthrough autoplay: reveal the next step every 2.5 seconds until the end.
  useEffect(() => {
    if (!playing || mode !== "walkthrough" || view >= total) return;
    const timer = setTimeout(() => {
      setView(view + 1); // reveal the next step
      if (view + 1 >= total) setPlaying(false); // stop at the last step
    }, 2500);
    return () => clearTimeout(timer); // cancel if the user pauses or leaves
  }, [playing, view, total, mode]);

  // ---- Mode switching (the header chip) ----
  function goWalkthrough() {
    setView(Math.max(1, Math.min(total, expected))); // show the reference up to where they are
    setOverlay(null);
    setMode("walkthrough");
  }
  function goPractice(fromStep: number) {
    // Start Step practice with the tutor's first `fromStep` lines already on the board.
    setProgress(steps.slice(0, fromStep).map((s) => ({ latex: s.latex, sympy: s.sympy, mark: "none" })));
    setExpected(fromStep);
    resetStepState();
    setOverlay(null);
    setPlaying(false);
    setMode(fromStep >= total ? "finished" : "practice");
  }
  function resetStepState() {
    setDraft("");
    input.current?.clear();
    setAttempt(1);
    setHintUsed(false);
    setShowHint(false);
    setResult(null);
    setWrongLine(null);
    setShowFix(false);
    setCheckError(null);
  }
  function finish(from: "walkthrough" | "practice") {
    setFinishedFrom(from);
    setPlaying(false);
    setOverlay(null);
    setMode("finished");
  }

  // ---- Step practice actions ----
  async function checkThisStep() {
    if (!pkg || !draft.trim() || checking) return;
    setChecking(true);
    setCheckError(null);
    try {
      const res = await fetch("/api/check-step", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pkg,
          expectedIndex: expected,
          board: progress.map((l) => ({ latex: l.latex, sympy: l.sympy })),
          studentLatex: draft,
          attempt,
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      const r: CheckResult = data.result;
      const valid = r.status === "correct" || r.status === "correct_alternate";
      logAttempt({
        ts: Date.now(),
        problemId,
        skills: pkg.techniques,
        stepId: steps[expected]?.id ?? null,
        correct: valid,
        hintUsed,
        mode: "practice",
      });
      if (valid) {
        // Accept the line: it joins the board with a ✓ (or ⚠ if they needed help), and we move on.
        const mark: BoardLine["mark"] = hintUsed || attempt > 1 ? "hinted" : r.status === "correct_alternate" ? "alternate" : "correct";
        setProgress((p) => [...p, { latex: r.interpreted_latex, sympy: r.student_sympy, mark }]);
        if (!hintUsed && attempt === 1) setStats((s) => ({ ...s, firstTry: s.firstTry + 1 }));
        const matchedIndex = steps.findIndex((s) => s.id === r.matched_step_id);
        const next = matchedIndex >= 0 ? matchedIndex + 1 : expected; // alternates stay aimed at the same step
        resetStepState();
        setResult(r); // keep the confirmation visible in the Focus card
        setExpected(Math.min(next, total));
        if (r.finished || next >= total) finish("practice");
      } else {
        // Not accepted: ring the wrong piece, show the hint; after a second miss, show the fix.
        setResult(r);
        setCheckedDraft(draft);
        setWrongLine(r.status === "incorrect" ? ringError(r.interpreted_latex, r.error_latex) : r.interpreted_latex);
        if (attempt >= 2) setShowFix(true);
        setAttempt((a) => a + 1);
      }
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : "Couldn't check that step.");
    } finally {
      setChecking(false);
    }
  }

  function revealHint() {
    setShowHint(true);
    if (!hintUsed) setStats((s) => ({ ...s, hints: s.hints + 1 }));
    setHintUsed(true);
  }

  // "Stuck? Show me this step": the tutor writes the expected line (marked ⚠) and we move on.
  function showMeThisStep() {
    const step = steps[expected];
    if (!step) return;
    if (!hintUsed) setStats((s) => ({ ...s, hints: s.hints + 1 }));
    logAttempt({ ts: Date.now(), problemId, skills: pkg!.techniques, stepId: step.id, correct: false, hintUsed: true, mode: "practice" });
    setProgress((p) => [...p, { latex: step.latex, sympy: step.sympy, mark: "hinted" }]);
    resetStepState();
    if (expected + 1 >= total) finish("practice");
    else setExpected(expected + 1);
  }

  // ---- What to draw ----
  const chip = mode === "walkthrough" ? "Walkthrough" : mode === "practice" ? "Step practice" : "Solved";
  const chipColor =
    mode === "walkthrough" ? "text-[#8FDCEE] bg-blue/15" : mode === "practice" ? "text-[#FF9AA3] bg-pink/15" : "text-teal bg-teal/15";

  let lines: BoardLine[] = [];
  let current: CurrentLine | null = null;
  let status = "";
  let ghost: string | null = null;
  if (pkg && mode === "walkthrough") {
    lines = steps.slice(0, view - 1).map((s) => ({ latex: s.latex, mark: "none" }));
    current = { latex: steps[view - 1].latex, number: view, badge: "gold" };
    status = `step ${view} of ${total}`;
    ghost = view < total ? `next: ${steps[view].rule.toLowerCase()}` : "that's the answer";
  } else if (pkg && mode === "practice") {
    lines = progress;
    const n = progress.length + 1;
    const wrongNow = wrongLine !== null && draft === checkedDraft; // show the ringed line until they edit it
    current = {
      latex: wrongNow ? wrongLine! : draft,
      number: n,
      badge: "pink",
      placeholder: `type step ${n} below`,
      note: wrongNow && result ? (
        <span className="flex items-center gap-2 text-gold">
          <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-gold">?</span>
          {result.status === "unclear_input" ? "say that again?" : "look here"}
        </span>
      ) : draft ? (
        <span className="text-[rgba(236,232,221,.45)]">writing…</span>
      ) : null,
      fixLatex: wrongNow && showFix ? steps[expected]?.latex : null,
    };
    status = `your turn · step ${n}`;
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header: logo, mode chip (switch modes), new problem */}
      <header className="flex h-16 shrink-0 items-center justify-between px-10">
        <div className="flex items-center gap-3.5">
          <button aria-label="Chalkline home" onClick={onNewProblem}><Logo /></button>
          <ModeChip label={chip} color={chipColor} disabled={!pkg} onPick={switchMode} />
        </div>
        <button className="btn h-10" onClick={onNewProblem}>New problem</button>
      </header>

      {/* Board area: fills the remaining height */}
      <div className="min-h-0 flex-1 px-10">
        <Board
          problemLatex={pkg?.problem_latex ?? problemLatex}
          status={!pkg ? (loadError ? "couldn't prepare it" : "preparing…") : mode === "finished" ? "the whole solution" : status}
          lines={lines}
          current={current}
          ghost={ghost}
          overlay={pkg && overlay ? <OverlayPanel pkg={pkg} overlay={overlay} onClose={() => setOverlay(null)} /> : null}
        >
          {!pkg ? (
            <div className="flex flex-1 items-center justify-center font-hand text-3xl text-muted">
              {loadError ?? "Preparing the board… (a new problem takes about half a minute)"}
            </div>
          ) : mode === "finished" ? (
            <FinishBoard pkg={pkg} lines={finishedFrom === "practice" ? progress : steps.map((s) => ({ latex: s.latex, mark: "none" as const }))} />
          ) : undefined}
        </Board>
      </div>

      {/* Tray: three cards, contents depend on the mode */}
      <section aria-label="Tray" className="grid h-[220px] shrink-0 grid-cols-3 gap-4 px-10 pb-5 pt-4">
        {pkg && mode === "walkthrough" && (
          <>
            <Card>
              <span className="eyebrow text-gold">STEP {view} · FOCUS</span>
              <span className="text-lg font-semibold">{steps[view - 1].rule}</span>
              <RichText className="text-sm leading-relaxed text-muted" text={steps[view - 1].summary} />
              <div className="mt-auto flex gap-2">
                <button className="btn h-10" onClick={() => setOverlay({ kind: "why", stepIndex: view - 1 })}>Why?</button>
                <button className="btn h-10" disabled={!steps[view - 1].side_work} onClick={() => setOverlay({ kind: "side", stepIndex: view - 1 })}>Side work</button>
              </div>
            </Card>
            <Card center>
              <div className="flex items-center gap-3.5">
                <RoundButton label="Previous step" disabled={view <= 1} onClick={() => { setPlaying(false); setView((v) => Math.max(1, v - 1)); }}>‹</RoundButton>
                <RoundButton big label={playing ? "Pause autoplay" : "Autoplay"} disabled={view >= total} onClick={() => setPlaying((p) => !p)}>
                  {playing ? "❚❚" : "▶"}
                </RoundButton>
                <RoundButton label="Next step" disabled={view >= total} onClick={() => { setPlaying(false); setView((v) => Math.min(total, v + 1)); }}>›</RoundButton>
              </div>
              <label className="flex items-center gap-2 text-[13px] text-muted" title="Coming in Phase 3">
                Read aloud <input type="checkbox" disabled className="h-4 w-4" />
              </label>
            </Card>
            <Card center>
              {view < total ? (
                <>
                  <button className="btn btn-primary h-[52px] w-full text-[15px]" onClick={() => goPractice(view)}>Let me try the next step</button>
                  <span className="text-center text-[13px] text-muted">You write step {view + 1}, and the board checks it.</span>
                </>
              ) : (
                <>
                  <button className="btn btn-primary h-[52px] w-full text-[15px]" onClick={() => finish("walkthrough")}>See the summary</button>
                  <span className="text-center text-[13px] text-muted">That&apos;s the whole solution.</span>
                </>
              )}
            </Card>
          </>
        )}

        {pkg && mode === "practice" && steps[expected] && (
          <>
            <Card>
              <span className="eyebrow text-[#FF9AA3]">STEP {progress.length + 1} · YOUR TURN</span>
              <PracticeFocus result={result} wrong={wrongLine !== null} showHint={showHint} hint={steps[expected].hint} summary={steps[expected].summary} error={checkError} />
              <div className="mt-auto flex gap-2">
                <button className="btn h-10" onClick={revealHint} disabled={showHint}>Hint</button>
                <button className="btn h-10" disabled={!steps[expected].side_work} onClick={() => setOverlay({ kind: "side", stepIndex: expected })}>Side work</button>
                {wrongLine !== null && !showFix && <button className="btn h-10" onClick={() => setShowFix(true)}>Show the fix</button>}
              </div>
            </Card>
            <Card>
              <label className="text-xs uppercase tracking-[.06em] text-muted">Type step {progress.length + 1}</label>
              <MathInput ref={input} onChange={setDraft} onSubmit={checkThisStep} ariaLabel={`Type step ${progress.length + 1}`} />
              <button className="btn btn-primary h-[46px]" disabled={!draft.trim() || checking} onClick={checkThisStep}>
                {checking ? "Checking…" : "Check this step"}
              </button>
            </Card>
            <Card>
              <div role="group" aria-label="Math keys" className="grid grid-cols-5 gap-2">
                {KEYS_PRACTICE.map((k) => (
                  <button key={k.label} className="h-10 rounded-[10px] border border-white/15 bg-panel-2 text-[17px]" onClick={() => input.current?.insert(k.insert)}>
                    {k.label}
                  </button>
                ))}
              </div>
              <button className="mt-auto h-10 text-left text-[13px] font-medium text-muted hover:text-text" onClick={showMeThisStep}>
                Stuck? Show me this step →
              </button>
            </Card>
          </>
        )}

        {pkg && mode === "finished" && (
          <>
            <Card>
              <span className="eyebrow text-teal">TECHNIQUES USED</span>
              <div className="flex flex-wrap gap-2">
                {pkg.techniques.map((t) => (
                  <span key={t} className="rounded-full bg-teal/15 px-3 py-1 text-sm text-teal">{t}</span>
                ))}
              </div>
            </Card>
            <Card center>
              {finishedFrom === "practice" ? (
                <div className="flex gap-8 text-center">
                  <Stat n={progress.filter((l) => l.mark !== "none").length} label="steps you wrote" />
                  <Stat n={stats.firstTry} label="right first try" />
                  <Stat n={stats.hints} label="hints" />
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-center">
                  <Stat n={total} label="steps in this solution" />
                  <button className="btn h-10" onClick={() => goPractice(0)}>Now try it yourself</button>
                </div>
              )}
            </Card>
            <Card center>
              <button className="btn btn-primary h-[52px] w-full" disabled title="Coming in Phase 2">Give me a similar problem</button>
              <button className="btn h-10" onClick={onNewProblem}>New problem</button>
            </Card>
          </>
        )}
      </section>
    </div>
  );

  // The header chip: switch modes mid-problem, keeping your place.
  function switchMode(m: "walkthrough" | "practice") {
    if (m === mode) return; // already there
    if (m === "walkthrough") goWalkthrough();
    else goPractice(mode === "walkthrough" ? view : 0); // from Walkthrough: continue after the steps shown
  }
}

// ---------- Small building blocks ----------

function Card({ children, center = false }: { children: ReactNode; center?: boolean }) {
  return (
    <div className={`flex min-h-0 flex-col gap-2 overflow-hidden rounded-2xl border border-white/[.09] bg-panel px-5 py-4 ${center ? "items-center justify-center gap-3.5" : ""}`}>
      {children}
    </div>
  );
}

function RoundButton({ children, label, big = false, disabled, onClick }: { children: ReactNode; label: string; big?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center justify-center rounded-full border text-lg disabled:opacity-35 ${
        big ? "h-[60px] w-[60px] border-text bg-text text-[#14181D]" : "h-12 w-12 border-white/20 hover:bg-panel-2"
      }`}
    >
      {children}
    </button>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-display text-3xl font-semibold">{n}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

// Clickable mode chip in the header: switch between Walkthrough and Step practice mid-problem.
function ModeChip({ label, color, disabled, onPick }: { label: string; color: string; disabled: boolean; onPick: (m: "walkthrough" | "practice") => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button disabled={disabled} aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`rounded-full px-3 py-[7px] text-[13px] font-semibold ${color}`}>
        {label} ▾
      </button>
      {open && (
        <div className="absolute left-0 top-10 z-30 flex w-44 flex-col rounded-xl border border-white/10 bg-panel p-1.5 shadow-xl">
          {(["walkthrough", "practice"] as const).map((m) => (
            <button key={m} className="rounded-lg px-3 py-2 text-left text-sm hover:bg-panel-2" onClick={() => { setOpen(false); onPick(m); }}>
              {m === "walkthrough" ? "Walkthrough" : "Step practice"}
            </button>
          ))}
          <span className="px-3 py-2 text-sm text-subtle">Check my work · soon</span>
        </div>
      )}
    </div>
  );
}

// The Focus card body in Step practice: the latest feedback, or what to do next.
function PracticeFocus({ result, wrong, showHint, hint, summary, error }: { result: CheckResult | null; wrong: boolean; showHint: boolean; hint: string; summary: string; error: string | null }) {
  if (error) return <span className="text-sm text-pink">{error}</span>;
  return (
    <div className="flex min-h-0 flex-col gap-1 overflow-y-auto text-sm leading-relaxed">
      {result && wrong && <RichText className="text-text" text={result.display_feedback} />}
      {result && !wrong && <RichText className="text-teal" text={`✓ ${result.display_feedback}`} />}
      {!result && <RichText className="text-muted" text={summary} />}
      {showHint && <RichText className="text-gold" text={`Hint: ${(wrong && result?.hint) || hint}`} />}
    </div>
  );
}

// The finish board (frame K): every line in one column, and the boxed answer to the right.
function FinishBoard({ pkg, lines }: { pkg: SolutionPackage; lines: BoardLine[] }) {
  return (
    <div className="flex min-h-0 flex-1 items-center gap-10 py-4">
      <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden opacity-75">
        {lines.map((l, i) => (
          <div key={i} className="flex min-w-0 items-center gap-4">
            <span className="w-[22px] shrink-0 font-mono text-[13px] text-muted">{i + 1}</span>
            <span className="min-w-0 truncate text-xl"><Tex latex={l.latex} /></span>
            <Mark mark={l.mark} size={20} />
            {l.mark === "hinted" && <span className="font-hand text-lg text-gold">fixed</span>}
          </div>
        ))}
      </div>
      <div className="flex shrink-0 flex-col items-center gap-2">
        <span className="font-hand text-2xl text-muted">answer</span>
        <span className="-rotate-1 rounded-lg border-[2.5px] border-teal px-6 py-4 text-[40px]"><Tex latex={pkg.final_answer_latex} /></span>
      </div>
    </div>
  );
}

// The Why? / Side work panel over the right third of the board.
function OverlayPanel({ pkg, overlay, onClose }: { pkg: SolutionPackage; overlay: NonNullable<Overlay>; onClose: () => void }) {
  const step = pkg.steps[overlay.stepIndex];
  const [question, setQuestion] = useState(""); // follow-up question text
  const [answer, setAnswer] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  async function ask() {
    if (!question.trim() || asking) return;
    setAsking(true);
    try {
      const res = await fetch("/api/why", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pkg, stepIndex: overlay.stepIndex, question }),
      });
      const data = await res.json();
      setAnswer(data.ok ? data.answer : data.error);
    } catch {
      setAnswer("Couldn't reach the tutor. Try again.");
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="absolute bottom-4 right-4 top-16 z-20 flex w-[36%] flex-col gap-3 overflow-y-auto rounded-2xl border border-white/10 bg-panel/95 p-5 text-text shadow-2xl">
      <div className="flex items-center justify-between">
        <span className="eyebrow text-gold">{overlay.kind === "why" ? `WHY? · STEP ${overlay.stepIndex + 1}` : `SIDE WORK · STEP ${overlay.stepIndex + 1}`}</span>
        <button className="btn h-8 px-3" onClick={onClose} aria-label="Close panel">✕</button>
      </div>
      {overlay.kind === "why" ? (
        <>
          <div className="board-surface rounded-xl px-4 py-3 text-xl"><Tex latex={step.latex} /></div>
          <span className="font-semibold">{step.rule}</span>
          <RichText className="text-sm leading-relaxed text-muted" text={step.why} />
          <div className="mt-auto flex flex-col gap-2">
            {answer && <RichText className="whitespace-pre-line text-sm leading-relaxed" text={answer} />}
            <div className="flex gap-2">
              <input
                className="h-10 min-w-0 flex-1 rounded-xl border border-white/20 bg-[#12161B] px-3 text-sm"
                placeholder="Ask a follow-up… (e.g. why not u = x?)"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && ask()}
              />
              <button className="btn h-10" disabled={asking || !question.trim()} onClick={ask}>{asking ? "…" : "Ask"}</button>
            </div>
          </div>
        </>
      ) : step.side_work ? (
        <>
          <span className="font-semibold">{step.side_work.title}</span>
          <div className="board-surface flex flex-col gap-2 rounded-xl px-4 py-3 text-xl">
            {step.side_work.lines.map((l, i) => <Tex key={i} latex={l} />)}
          </div>
        </>
      ) : (
        <span className="text-sm text-muted">No side work for this step.</span>
      )}
    </div>
  );
}

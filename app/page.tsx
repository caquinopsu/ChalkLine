"use client"; // the whole app is interactive, so this page runs in the browser

import { useState } from "react";
import { Session } from "@/components/Session";
import { NewProblemSheet, StartScreen, type ProblemSet, type StartChoice, type StartMode } from "@/components/StartScreen";
import { PRESETS, loadPreset } from "@/lib/presets";
import { getPackage, rememberPackage } from "@/lib/packages";
import type { SolutionPackage, Submission } from "@/lib/schemas";
import { messageOf } from "@/lib/errors";

// Everything the session screen needs to know about the problem being worked on.
type Active = {
  key: number; // changes for every new problem, so the session starts fresh
  problemId: string; // preset id or "custom"
  problemLatex: string; // shown on the board right away
  mode: StartMode;
  work: Submission | null; // solution lines already read from a photo (Check my work)
  pkg: SolutionPackage | null; // null while loading
  error: string | null; // set if loading failed
  choice: StartChoice; // what was picked, so "Try again" can repeat it
  set: ProblemSet | null; // the worksheet this problem is a part of (null for a single problem)
};

export default function Home() {
  const [active, setActive] = useState<Active | null>(null); // null = show the start screen
  const [picking, setPicking] = useState(false); // is the "New problem" sheet open over the session?
  const [solved, setSolved] = useState<Record<string, boolean>>({}); // worksheet parts already solved ("instructions|latex" -> true)
  const partKey = (set: ProblemSet, i: number) => `${set.instructions}|${set.parts[i]?.latex}`;

  // Called when the student picks a problem and a mode (on the start screen, or after "similar problem").
  async function start(choice: StartChoice) {
    const key = Date.now(); // a fresh id for this session
    const preset = choice.kind === "preset" ? PRESETS.find((p) => p.id === choice.presetId) : null;
    const problemLatex = preset ? preset.latex : choice.kind === "typed" ? choice.latex : "";
    const work = choice.kind === "typed" ? choice.work ?? null : null;
    const set = choice.kind === "typed" ? choice.set ?? null : null;
    setActive({ key, problemId: preset?.id ?? "custom", problemLatex, mode: choice.mode, work, pkg: null, error: null, choice, set });
    setPicking(false);

    // A worksheet: start solving the next part in the background too, so moving on is instant.
    const next = set?.parts[set.index + 1];
    if (set && next) getPackage(next.latex, set.instructions).catch(() => {});

    try {
      // Presets are saved files (instant). Anything else is pre-solved, or was already started early.
      const pkg = choice.kind === "preset" ? await loadPreset(choice.presetId) : await getPackage(choice.latex, set?.instructions ?? "");
      // Only apply the result if the student hasn't moved on to another problem meanwhile.
      setActive((a) => (a && a.key === key ? { ...a, pkg } : a));
    } catch (err) {
      const message = messageOf(err, "Couldn't prepare this problem.");
      setActive((a) => (a && a.key === key ? { ...a, error: message } : a));
    }
  }

  // "Give me a similar problem": the package is already built and checked, so it starts instantly.
  function startSimilar(pkg: SolutionPackage, mode: StartMode) {
    rememberPackage(pkg.problem_latex, pkg);
    start({ kind: "typed", latex: pkg.problem_latex, mode });
  }

  // Switch to another part of the same worksheet (the part chips, or "Next part").
  function openPart(i: number, mode: StartMode) {
    const set = active?.set;
    if (!set || !set.parts[i]) return;
    start({ kind: "typed", latex: set.parts[i].latex, mode, set: { ...set, index: i } });
  }

  if (!active) return <StartScreen onStart={start} />;
  const set = active.set;
  return (
    <>
    <Session
      key={active.key}
      pkg={active.pkg}
      problemId={active.problemId}
      problemLatex={active.problemLatex}
      initialMode={active.mode}
      initialWork={active.work}
      loadError={active.error}
      onRetry={() => start(active.choice)} // pre-solve failed: ask again (failed requests aren't cached)
      onNewProblem={() => setPicking(true)} // opens the New problem sheet over the board
      onHome={() => setActive(null)} // the logo: back to the start screen
      onSimilar={startSimilar}
      set={set ? { ...set, solved: set.parts.map((_, i) => !!solved[partKey(set, i)]) } : null}
      onPickPart={openPart}
      onSolved={() => set && setSolved((s) => ({ ...s, [partKey(set, set.index)]: true }))}
    />
    {picking && <NewProblemSheet onStart={start} onClose={() => setPicking(false)} />}
    </>
  );
}

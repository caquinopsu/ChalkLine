"use client"; // the whole app is interactive, so this page runs in the browser

import { useState } from "react";
import { Session } from "@/components/Session";
import { StartScreen, type StartChoice, type StartMode } from "@/components/StartScreen";
import { PRESETS, loadPreset } from "@/lib/presets";
import { getPackage, rememberPackage } from "@/lib/packages";
import type { SolutionPackage, Submission } from "@/lib/schemas";

// Everything the session screen needs to know about the problem being worked on.
type Active = {
  key: number; // changes for every new problem, so the session starts fresh
  problemId: string; // preset id or "custom"
  problemLatex: string; // shown on the board right away
  mode: StartMode;
  work: Submission | null; // solution lines already read from a photo (Check my work)
  pkg: SolutionPackage | null; // null while loading
  error: string | null; // set if loading failed
};

export default function Home() {
  const [active, setActive] = useState<Active | null>(null); // null = show the start screen

  // Called when the student picks a problem and a mode (on the start screen, or after "similar problem").
  async function start(choice: StartChoice) {
    const key = Date.now(); // a fresh id for this session
    const preset = choice.kind === "preset" ? PRESETS.find((p) => p.id === choice.presetId) : null;
    const problemLatex = preset ? preset.latex : choice.kind === "typed" ? choice.latex : "";
    const work = choice.kind === "typed" ? choice.work ?? null : null;
    setActive({ key, problemId: preset?.id ?? "custom", problemLatex, mode: choice.mode, work, pkg: null, error: null });

    try {
      // Presets are saved files (instant). Anything else is pre-solved, or was already started early.
      const pkg = choice.kind === "preset" ? await loadPreset(choice.presetId) : await getPackage(choice.latex);
      // Only apply the result if the student hasn't moved on to another problem meanwhile.
      setActive((a) => (a && a.key === key ? { ...a, pkg } : a));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't prepare this problem.";
      setActive((a) => (a && a.key === key ? { ...a, error: message } : a));
    }
  }

  // "Give me a similar problem": the package is already built and checked, so it starts instantly.
  function startSimilar(pkg: SolutionPackage, mode: StartMode) {
    rememberPackage(pkg.problem_latex, pkg);
    start({ kind: "typed", latex: pkg.problem_latex, mode });
  }

  if (!active) return <StartScreen onStart={start} />;
  return (
    <Session
      key={active.key}
      pkg={active.pkg}
      problemId={active.problemId}
      problemLatex={active.problemLatex}
      initialMode={active.mode}
      initialWork={active.work}
      loadError={active.error}
      onNewProblem={() => setActive(null)}
      onSimilar={startSimilar}
    />
  );
}

"use client"; // the whole app is interactive, so this page runs in the browser

import { useState } from "react";
import { Session } from "@/components/Session";
import { StartScreen, type StartChoice } from "@/components/StartScreen";
import { PRESETS, loadPreset } from "@/lib/presets";
import type { SolutionPackage } from "@/lib/schemas";

// Everything the session screen needs to know about the problem being worked on.
type Active = {
  key: number; // changes for every new problem, so the session starts fresh
  problemId: string; // preset id or "custom"
  problemLatex: string; // shown on the board right away
  mode: "walkthrough" | "practice";
  pkg: SolutionPackage | null; // null while loading
  error: string | null; // set if loading failed
};

export default function Home() {
  const [active, setActive] = useState<Active | null>(null); // null = show the start screen

  // Called when the student picks a problem and a mode on the start screen.
  async function start(choice: StartChoice) {
    const key = Date.now(); // a fresh id for this session
    const preset = choice.kind === "preset" ? PRESETS.find((p) => p.id === choice.presetId) : null;
    const problemLatex = preset ? preset.latex : choice.kind === "typed" ? choice.latex : "";
    setActive({ key, problemId: preset?.id ?? "custom", problemLatex, mode: choice.mode, pkg: null, error: null });

    try {
      let pkg: SolutionPackage;
      if (choice.kind === "preset") {
        pkg = await loadPreset(choice.presetId); // saved file: instant
      } else {
        const res = await fetch("/api/presolve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ problem: choice.latex }),
        });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        pkg = data.pkg;
      }
      // Only apply the result if the student hasn't moved on to another problem meanwhile.
      setActive((a) => (a && a.key === key ? { ...a, pkg } : a));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Couldn't prepare this problem.";
      setActive((a) => (a && a.key === key ? { ...a, error: message } : a));
    }
  }

  if (!active) return <StartScreen onStart={start} />;
  return (
    <Session
      key={active.key}
      pkg={active.pkg}
      problemId={active.problemId}
      problemLatex={active.problemLatex}
      initialMode={active.mode}
      loadError={active.error}
      onNewProblem={() => setActive(null)}
    />
  );
}

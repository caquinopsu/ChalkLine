"use client";

// The problem library: every solved problem, grouped by concept, plus "Picked for you" (problems
// for the techniques you miss most, from your own step history in this browser).
// Pick a problem -> a sheet shows it big with the four ways to work on it.
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { Tex, RichText } from "./Tex";
import { BookIcon, ModeCards, ProblemCard, Sheet, type StartChoice } from "./StartScreen";
import { PRESETS, type PresetMeta } from "@/lib/presets";
import { LEVELS, TOPICS, picksForYou, solvedIds, weakSpots, type Pick, type WeakSpot } from "@/lib/library";

export function Library({ onStart, onHome, focus }: { onStart: (choice: StartChoice) => void; onHome: () => void; focus?: string }) {
  const [topic, setTopic] = useState<string | null>(null); // null = all topics
  const [open, setOpen] = useState<PresetMeta | null>(null); // the problem whose sheet is open
  // Browser-only data (localStorage), read once when the library opens. (The library only ever
  // opens after a click, in the browser, so localStorage is always there.)
  const [solved] = useState<Set<string>>(solvedIds);
  const [picks] = useState<Pick[]>(() => picksForYou(3));
  const [spots] = useState<WeakSpot[]>(() => weakSpots(3));

  // Coming from a summary's "More … problems": scroll to the first problem with that technique.
  useEffect(() => {
    if (!focus) return;
    const target = PRESETS.find((p) => p.tag.toLowerCase().includes(focus.toLowerCase()) || focus.toLowerCase().includes(p.tag.toLowerCase()));
    if (target) document.getElementById(`p-${target.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focus]);

  const shown = topic ? [topic] : TOPICS;
  const done = PRESETS.filter((p) => solved.has(p.id)).length;

  return (
    <div className="no-bar h-full overflow-y-auto">
      {/* Header: logo (home), and how far you've got */}
      <header className="sticky top-0 z-20 flex h-[68px] items-center gap-3 bg-room/85 px-10 backdrop-blur">
        <button aria-label="Chalkline home" onClick={onHome} className="flex items-center gap-3">
          <Logo />
          <span className="font-display text-xl font-semibold">Chalkline</span>
        </button>
        <span className="ml-auto font-hand text-2xl text-muted">{done} of {PRESETS.length} solved</span>
      </header>

      <main className="fade-up mx-auto flex max-w-[1240px] flex-col gap-10 px-10 pb-16 pt-4">
        {/* Title + topic filter */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 text-gold"><BookIcon /></span>
            <div>
              <h1 className="font-display text-[42px] font-semibold leading-tight">Problem library</h1>
              <p className="font-hand text-2xl text-gold">every problem fully solved, step by step: watch it, or solve it yourself</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <TopicChip label="everything" on={topic === null} onClick={() => setTopic(null)} />
            {TOPICS.map((t) => <TopicChip key={t} label={t.toLowerCase()} on={topic === t} onClick={() => setTopic(t)} />)}
          </div>
        </div>

        {/* Picked for you: problems for your weak spots */}
        <section className="relative overflow-hidden rounded-[26px] border border-gold/25 bg-gradient-to-br from-panel-2 to-panel p-7">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h2 className="font-hand text-[34px] leading-none text-gold">picked for you</h2>
            <span className="text-base text-muted">
              {spots.length
                ? <>based on the steps you&apos;ve missed: {spots.map((s) => s.skill.toLowerCase()).join(", ")}</>
                : "solve a few steps yourself (Step practice or Check my work) and the problems you need most will show up here"}
            </span>
          </div>
          {picks.length > 0 ? (
            <div className="mt-5 grid grid-cols-3 gap-4">
              {picks.map((k) => (
                <div key={k.problem.id} className="flex flex-col gap-2">
                  <ProblemCard problem={k.problem} solved={solved.has(k.problem.id)} onClick={() => setOpen(k.problem)} />
                  <span className="pl-1 font-hand text-lg text-muted">↑ {k.reason}</span>
                </div>
              ))}
            </div>
          ) : (
            // no history yet: three warm-ups to start with, one per area
            <div className="mt-5 grid grid-cols-3 gap-4">
              {["limit-factor", "product", "usub"].map((id) => PRESETS.find((p) => p.id === id)).filter((p): p is PresetMeta => !!p).map((p) => (
                <ProblemCard key={p.id} problem={p} solved={solved.has(p.id)} onClick={() => setOpen(p)} />
              ))}
            </div>
          )}
        </section>

        {/* Every topic, with its problems */}
        {shown.map((t) => (
          <section key={t} className="flex flex-col gap-4">
            <div className="flex items-baseline gap-3 border-b border-white/[.08] pb-2">
              <h2 className="font-hand text-[34px] leading-none text-chalk">{t.toLowerCase()}</h2>
              <span className="text-sm text-muted">
                {PRESETS.filter((p) => p.topic === t).length} problems · {PRESETS.filter((p) => p.topic === t && solved.has(p.id)).length} solved
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 xl:grid-cols-4">
              {PRESETS.filter((p) => p.topic === t).map((p) => (
                <div key={p.id} id={`p-${p.id}`}>
                  <ProblemCard problem={p} solved={solved.has(p.id)} onClick={() => setOpen(p)} />
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* The chosen problem, big, with the ways to work on it */}
      {open && (
        <Sheet title={open.tag} icon={<BookIcon />} tint="bg-gold/15 text-gold" onClose={() => setOpen(null)}>
          <div className="board-surface flex flex-col gap-3 rounded-2xl border-[5px] border-wood px-8 py-6">
            <div className="flex items-center gap-3">
              <span className="font-hand text-[28px] text-gold"><RichText text={open.task} /></span>
              <span className="ml-auto font-hand text-xl text-muted">{open.topic.toLowerCase()} · {LEVELS[open.level]}</span>
            </div>
            <span className="chalk overflow-x-auto py-2 text-[44px]"><Tex latex={open.latex} display /></span>
          </div>
          <ModeCards disabled={false} hint="how do you want to work on it?" onPick={(mode) => onStart({ kind: "preset", presetId: open.id, mode })} />
        </Sheet>
      )}
    </div>
  );
}

function TopicChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-4 py-1.5 font-hand text-[22px] transition ${on ? "border-gold/70 bg-gold/10 text-gold" : "border-white/12 text-muted hover:border-white/30 hover:text-text"}`}
    >
      {label}
    </button>
  );
}

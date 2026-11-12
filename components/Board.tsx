"use client";

// The chalkboard (DESIGN.md section 6): problem on top, then a step stack where only the
// current line is big. Older lines shrink and dim, and anything older folds into one pill.
// Motion: when you move to another step, every line glides from where it was to its new spot
// (the finished line floats up and shrinks into the stack), and the new line fades in.
// ✓ marks draw on, wrong parts shake, and the last step (the answer) gets a teal frame.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Tex } from "./Tex";

// true if the visitor asked their system for less motion (then we skip the JavaScript animations;
// the CSS ones are switched off in globals.css).
const calm = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// One finished line on the board.
export type BoardLine = {
  latex: string; // what's written
  mark: "none" | "correct" | "alternate" | "hinted"; // ✓, ✓ + "another way", ⚠, or no mark (tutor lines)
};

// The big line at the bottom of the stack.
export type CurrentLine = {
  latex: string; // what's written ("" shows the placeholder)
  number: number; // step number in the badge
  badge: "gold" | "pink" | "blue"; // gold = walkthrough, pink = your turn / error, blue = listening
  placeholder?: string; // Caveat text when empty, e.g. "type step 4 below"
  note?: ReactNode; // short Caveat note beside it (hint "?" or "writing…")
  fixLatex?: string | null; // the corrected line, written in teal beside it
  tag?: string; // a small rule label pointing at the line ("Chain rule")
  final?: boolean; // this line is the answer: teal frame, ✓ badge, "the answer" label
};

type Props = {
  problemLatex: string;
  status: string; // Caveat label top-right ("step 3 of 4")
  lines: BoardLine[]; // finished lines, oldest first
  current: CurrentLine | null;
  ghost?: string | null; // faint Caveat line under the current one ("next: ...")
  overlay?: ReactNode; // the Why? / Side work panel, drawn over the right third
  speaking?: boolean; // the tutor is talking: the colored parts glow while it speaks
  children?: ReactNode; // anything extra (e.g. the finish layout)
  firstNumber?: number; // the step number of lines[0] (the home-screen demo passes only the last line)
  nav?: { prev?: () => void; next?: () => void }; // Walkthrough: big ‹ › arrows on the board's edges (laptops)
};

const BADGE = { gold: "bg-gold", pink: "bg-pink", blue: "bg-blue" };

export function Board({ problemLatex, status, lines, current, ghost, overlay, speaking, children, firstNumber = 1, nav }: Props) {
  const [expanded, setExpanded] = useState(false); // is the "earlier steps" overlay open?
  const stack = useRef<HTMLDivElement>(null); // the step stack, to find lines to glide
  const spots = useRef(new Map<string, DOMRect>()); // where each step's line was drawn last time
  // "fresh" for the first moments after the board drops, so step 1 waits for the drop to finish.
  const [fresh, setFresh] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setFresh(false), 1600);
    return () => clearTimeout(t); // clean up if the board goes away first
  }, []);

  // Glide between steps (a "FLIP" animation: First, Last, Invert, Play). After React moves the
  // lines, we measure where each step's line is now, start it at its old spot and size, and let it
  // ease into the new one. The line you just finished floats up and shrinks into the stack.
  const shape = `${lines.length}|${current?.number ?? 0}|${children ? 1 : 0}`; // changes only when lines move (not while typing)
  useLayoutEffect(() => {
    if (!stack.current) { spots.current.clear(); return; } // summary showing: start fresh next time
    const now = new Map<string, DOMRect>();
    stack.current.querySelectorAll<HTMLElement>("[data-n]").forEach((el) => {
      const key = el.dataset.n!; // the step number
      const after = el.getBoundingClientRect();
      now.set(key, after);
      const before = spots.current.get(key);
      if (!before || calm() || !after.height) return; // new on the board: its own fade-in handles it
      const dx = before.left - after.left;
      const dy = before.top - after.top;
      const s = before.height / after.height; // old size relative to the new one
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1 && Math.abs(s - 1) < 0.02) return; // didn't move
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px) scale(${s})` }, { transform: "none" }],
        { duration: 520, easing: "cubic-bezier(.25,.8,.25,1)" },
      );
    });
    spots.current = now;
  }, [shape]);

  // When there's a current line, show the last 2 finished lines; otherwise the last 3.
  const keep = current ? 2 : 3;
  const hidden = lines.length > keep ? lines.slice(0, lines.length - keep) : []; // folded into the pill
  const visible = lines.slice(hidden.length); // shown, shrinking with age
  const sizes = visible.length === 3 ? [24, 30, 36] : [26, 32]; // font sizes, oldest -> newest
  const opacity = visible.length === 3 ? [0.45, 0.6, 0.75] : [0.5, 0.72];
  const offset = sizes.length - visible.length; // with only 1 visible line, use the larger size

  return (
    <div className="flex h-full flex-col">
      <div aria-hidden className="h-3 rounded bg-wood" /> {/* the rail */}
      {/* board-drop: the board (and its ledge) unroll down from the rail when a problem opens */}
      <div className={`board-drop flex min-h-0 flex-1 flex-col ${fresh ? "board-fresh" : ""}`}>
      <div className="board-surface relative mx-2.5 flex min-h-0 flex-1 flex-col rounded-b-lg border-x-[6px] border-b-[6px] border-wood px-4 py-3 md:border-x-[12px] md:border-b-[12px] md:px-14 md:py-5">
        {/* Header row: the problem and a handwritten status */}
        <div className="flex items-center justify-between gap-4 border-b border-[rgba(236,232,221,.14)] pb-3">
          <span className="problem-ink flex min-w-0 flex-1"><FitTex latex={problemLatex} size={32} min={16} /></span>
          <span className="shrink-0 font-hand text-2xl font-semibold text-muted md:text-[34px]">{status}</span>
        </div>

        {children ?? (
          <div ref={stack} className={`flex min-h-0 flex-1 flex-col justify-center gap-5 pb-4 ${speaking ? "board-speaking" : ""}`}>
            {hidden.length > 0 && (
              <div className="relative">
                <button
                  className="flex h-10 items-center gap-2.5 rounded-full border border-dashed border-white/20 bg-white/[.03] px-4 font-hand text-xl text-muted"
                  aria-expanded={expanded}
                  onClick={() => setExpanded((e) => !e)}
                >
                  <span aria-hidden>{expanded ? "⌄" : "⌃"}</span>
                  {hidden.length} earlier step{hidden.length > 1 ? "s" : ""}
                  <span className="font-sans text-[16px] text-subtle"><Tex latex={hidden[0].latex} /></span>
                </button>
                {expanded && (
                  // The hidden lines, drawn over the top of the board (never pushes the layout).
                  <div className="board-surface absolute left-0 top-12 z-10 flex flex-col gap-3 rounded-xl border border-white/10 p-4">
                    {hidden.map((l, i) => (
                      <Row key={i} n={firstNumber + i} line={l} size={24} opacity={0.85} />
                    ))}
                  </div>
                )}
              </div>
            )}
            {visible.map((l, i) => (
              <Row key={firstNumber + hidden.length + i} n={firstNumber + hidden.length + i} line={l} size={sizes[i + offset]} opacity={opacity[i + offset]} glide />
            ))}
            {/* key = step number, so a new step mounts fresh and fades in (typing doesn't re-animate) */}
            {current && <Current key={current.number} line={current} />}
            {ghost && <span className="truncate pl-12 font-hand text-2xl text-[rgba(236,232,221,.38)] md:text-[32px]">{ghost}</span>}
          </div>
        )}
        {/* Step arrows on the board's edges: big, easy targets right next to the math */}
        {nav && (
          <>
            <EdgeArrow side="left" onClick={nav.prev} />
            <EdgeArrow side="right" onClick={nav.next} />
          </>
        )}
        {overlay}
      </div>
      {/* The chalk ledge with a few decorative chalk sticks */}
      <div aria-hidden className="mx-0.5 flex h-[18px] items-center gap-3 rounded-b-lg bg-ledge pl-6 md:pl-14">
        <span className="h-1.5 w-[34px] rounded bg-[#E9E5DA]" />
        <span className="h-1.5 w-[22px] rounded bg-gold" />
        <span className="h-1.5 w-[26px] rounded bg-blue-chalk" />
      </div>
      </div>
    </div>
  );
}

// A round arrow button on the left or right edge of the board (hidden when there's nowhere to go).
function EdgeArrow({ side, onClick }: { side: "left" | "right"; onClick?: () => void }) {
  return (
    <button
      aria-label={side === "left" ? "Previous step" : "Next step"}
      disabled={!onClick}
      onClick={onClick}
      className={`absolute top-1/2 z-10 hidden h-14 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-[rgba(17,20,25,.55)] text-3xl text-chalk backdrop-blur transition hover:scale-110 hover:border-gold/60 hover:text-gold disabled:pointer-events-none disabled:opacity-0 md:flex ${
        side === "left" ? "-left-10" : "-right-10"
      }`}
    >
      <span aria-hidden className="-mt-1">{side === "left" ? "‹" : "›"}</span>
    </button>
  );
}

// An older (finished) line: number, math, mark. glide = take part in the step-to-step glide.
function Row({ n, line, size, opacity, glide = false }: { n: number; line: BoardLine; size: number; opacity: number; glide?: boolean }) {
  return (
    <div
      data-row
      data-n={glide ? n : undefined}
      className="flex min-w-0 origin-top-left items-center gap-4 transition-opacity duration-500"
      style={{ opacity }}
    >
      <span className="w-7 shrink-0 text-center font-hand text-2xl text-muted">{n}</span>
      <FitTex latex={line.latex} size={size} min={16} grow={false} />
      <Mark mark={line.mark} size={size} />
    </div>
  );
}

// The current (big) line, in its tinted block with a numbered badge.
function Current({ line }: { line: CurrentLine }) {
  const el = useRef<HTMLDivElement>(null);
  const wrong = line.latex.includes("part-error"); // a pink ring is showing on this line
  // Gentle shake when a ring appears (or moves to a new wrong attempt).
  useLayoutEffect(() => {
    if (!wrong || !el.current || calm()) return;
    el.current.animate(
      [{ transform: "translateX(0)" }, { transform: "translateX(-7px)" }, { transform: "translateX(6px)" }, { transform: "translateX(-3px)" }, { transform: "translateX(0)" }],
      { duration: 380, easing: "ease-in-out" },
    );
  }, [wrong, line.latex]);
  return (
    <div
      ref={el}
      data-current
      data-n={line.number}
      className={`relative -ml-2 flex min-w-0 origin-top-left items-center gap-3 rounded-[14px] px-3 py-3 md:-ml-6 md:gap-5 md:px-6 md:py-4 ${
        line.final
          ? "answer-frame bg-teal/[.07] shadow-[inset_0_0_0_2.5px_var(--color-teal)]" // the answer: a teal chalk frame
          : "bg-white/[.04] shadow-[inset_0_0_0_1.5px_rgba(236,232,221,.10)]"
      }`}
    >
      <span className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full font-mono text-[16px] font-semibold text-[#14181D] ${line.final ? "bg-teal" : BADGE[line.badge]}`}>
        {line.final ? "✓" : line.number}
      </span>
      {line.latex ? (
        // "ink" = a soft fade-in, played once when this step appears
        <span className="ink flex min-w-0 flex-1"><FitTex latex={line.latex} size={52} min={18} /></span>
      ) : (
        <span className="font-hand text-3xl text-[rgba(236,232,221,.4)] md:text-[40px]">{line.placeholder}</span>
      )}
      {line.fixLatex && (
        <span className="ink flex min-w-0 items-center gap-3 text-teal">
          <span aria-hidden className="text-3xl">→</span>
          <FitTex latex={line.fixLatex} size={36} min={18} />
        </span>
      )}
      {/* Rule tag: a handwritten label with a pointer, saying what this step did */}
      {line.final ? (
        <span className="tag-in ml-auto hidden shrink-0 font-hand text-[34px] font-semibold text-teal md:inline">← the answer!</span>
      ) : line.tag && !line.note ? (
        <span className="tag-in ml-auto hidden shrink-0 font-hand text-[30px] text-gold md:inline">← {line.tag}</span>
      ) : null}
      {line.note && <span className="ml-auto shrink-0 font-hand text-[28px]">{line.note}</span>}
      {line.final && <ChalkDust />}
    </div>
  );
}

// A small puff of chalk dust that bursts out of the answer frame once (pure CSS, see globals.css).
// delay = how long to wait (ms) before the burst.
export function ChalkDust({ delay = 450 }: { delay?: number }) {
  // 14 specks, each flying out at its own angle and distance (set as CSS variables).
  const specks = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2;
    const dist = 70 + (i % 3) * 30;
    return { x: Math.cos(angle) * dist * 1.8, y: Math.sin(angle) * dist * 0.7, d: (i % 4) * 40 };
  });
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {specks.map((p, i) => (
        <span
          key={i}
          className={`dust ${i % 3 === 0 ? "bg-teal" : i % 3 === 1 ? "bg-gold" : "bg-chalk"}`}
          style={{ "--dx": `${p.x}px`, "--dy": `${p.y}px`, animationDelay: `${delay + p.d}ms` } as React.CSSProperties}
        />
      ))}
    </span>
  );
}

// Math that shrinks (down to `min` px) instead of wrapping or overflowing (DESIGN.md "shrink-to-fit").
// grow = take all the free width (false = only as wide as the math, so a mark can sit right after it).
// overflow-x-clip only cuts off the sides, so tall math (fractions, integrals, limits) is never
// cut at the top or bottom; the vertical padding gives tall pieces room inside the line.
export function FitTex({ latex, size, min, grow = true }: { latex: string; size: number; min: number; grow?: boolean }) {
  const box = useRef<HTMLSpanElement>(null); // the space we're allowed to use
  const inner = useRef<HTMLSpanElement>(null); // the rendered math
  const [fontSize, setFontSize] = useState(size);

  useLayoutEffect(() => {
    const fit = () => {
      if (!box.current || !inner.current) return;
      const natural = inner.current.scrollWidth / (fontSize / size); // width at the full size
      const available = box.current.clientWidth;
      const next = natural > available ? Math.max(min, Math.floor((size * available) / natural)) : size;
      if (next !== fontSize) setFontSize(next);
    };
    fit();
    const observer = new ResizeObserver(fit); // re-fit when the window resizes
    if (box.current) observer.observe(box.current);
    return () => observer.disconnect();
  }, [latex, size, min, fontSize]);

  return (
    <span ref={box} className={`min-w-0 overflow-x-clip whitespace-nowrap py-[0.15em] ${grow ? "flex-1" : "flex-initial"}`}>
      <span ref={inner} className="inline-block px-[0.1em]" style={{ fontSize }}>
        <Tex latex={latex} />
      </span>
    </span>
  );
}

// The little status mark after a line.
export function Mark({ mark, size }: { mark: BoardLine["mark"]; size: number }) {
  const s = Math.max(18, size * 0.8);
  if (mark === "correct" || mark === "alternate") {
    return (
      <span className="flex shrink-0 items-center gap-2">
        <svg width={s} height={s * 0.8} viewBox="0 0 30 24" role="img" aria-label="Correct">
          {/* pathLength=1 lets the CSS "check-draw" animation draw the stroke on from start to end */}
          <path className="check-draw" pathLength={1} d="M3 13l8 7L27 3" stroke="#4FD1B5" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {mark === "alternate" && <span className="font-hand text-2xl text-teal">another way</span>}
      </span>
    );
  }
  if (mark === "hinted") {
    return <span role="img" aria-label="Hint used" className="shrink-0 text-gold" style={{ fontSize: s * 0.8 }}>⚠</span>;
  }
  return null;
}

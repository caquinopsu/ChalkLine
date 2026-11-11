"use client";

// The chalkboard (DESIGN.md section 6): problem on top, then a step stack where only the
// current line is big. Older lines shrink and dim, and anything older folds into one pill.
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Tex } from "./Tex";

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
};

type Props = {
  problemLatex: string;
  status: string; // Caveat label top-right ("step 3 of 4")
  lines: BoardLine[]; // finished lines, oldest first
  current: CurrentLine | null;
  ghost?: string | null; // faint Caveat line under the current one ("next: ...")
  overlay?: ReactNode; // the Why? / Side work panel, drawn over the right third
  children?: ReactNode; // anything extra (e.g. the finish layout)
};

const BADGE = { gold: "bg-gold", pink: "bg-pink", blue: "bg-blue" };

export function Board({ problemLatex, status, lines, current, ghost, overlay, children }: Props) {
  const [expanded, setExpanded] = useState(false); // is the "earlier steps" overlay open?
  // When there's a current line, show the last 2 finished lines; otherwise the last 3.
  const keep = current ? 2 : 3;
  const hidden = lines.length > keep ? lines.slice(0, lines.length - keep) : []; // folded into the pill
  const visible = lines.slice(hidden.length); // shown, shrinking with age
  const sizes = visible.length === 3 ? [22, 28, 34] : [22, 28]; // font sizes, oldest -> newest
  const opacity = visible.length === 3 ? [0.45, 0.6, 0.75] : [0.45, 0.7];
  const offset = sizes.length - visible.length; // with only 1 visible line, use the larger size

  return (
    <div className="flex h-full flex-col">
      <div aria-hidden className="h-3 rounded bg-wood" /> {/* the rail */}
      <div className="board-surface relative mx-2.5 flex min-h-0 flex-1 flex-col rounded-b-lg border-x-[12px] border-b-[12px] border-wood px-14 py-6">
        {/* Header row: the problem and a handwritten status */}
        <div className="flex items-center justify-between border-b border-[rgba(236,232,221,.14)] pb-3">
          <span className="text-[28px]"><Tex latex={problemLatex} /></span>
          <span className="font-hand text-2xl text-muted">{status}</span>
        </div>

        {children ?? (
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-5 pb-4">
            {hidden.length > 0 && (
              <div className="relative">
                <button
                  className="flex h-9 items-center gap-2.5 rounded-full border border-dashed border-white/20 bg-white/[.03] px-3.5 text-[13px] font-medium text-muted"
                  aria-expanded={expanded}
                  onClick={() => setExpanded((e) => !e)}
                >
                  <span aria-hidden>{expanded ? "⌄" : "⌃"}</span>
                  {hidden.length} earlier step{hidden.length > 1 ? "s" : ""}
                  <span className="text-[15px] text-subtle"><Tex latex={hidden[0].latex} /></span>
                </button>
                {expanded && (
                  // The hidden lines, drawn over the top of the board (never pushes the layout).
                  <div className="board-surface absolute left-0 top-11 z-10 flex flex-col gap-3 rounded-xl border border-white/10 p-4">
                    {hidden.map((l, i) => (
                      <Row key={i} n={i + 1} line={l} size={22} opacity={0.85} />
                    ))}
                  </div>
                )}
              </div>
            )}
            {visible.map((l, i) => (
              <Row key={hidden.length + i} n={hidden.length + i + 1} line={l} size={sizes[i + offset]} opacity={opacity[i + offset]} />
            ))}
            {current && <Current line={current} />}
            {ghost && <span className="pl-10 font-hand text-[26px] text-[rgba(236,232,221,.35)]">{ghost}</span>}
          </div>
        )}
        {overlay}
      </div>
      {/* The chalk ledge with a few decorative chalk sticks */}
      <div aria-hidden className="mx-0.5 flex h-[18px] items-center gap-3 rounded-b-lg bg-ledge pl-14">
        <span className="h-1.5 w-[34px] rounded bg-[#E9E5DA]" />
        <span className="h-1.5 w-[22px] rounded bg-gold" />
        <span className="h-1.5 w-[26px] rounded bg-blue-chalk" />
      </div>
    </div>
  );
}

// An older (finished) line: number, math, mark.
function Row({ n, line, size, opacity }: { n: number; line: BoardLine; size: number; opacity: number }) {
  return (
    <div className="flex min-w-0 items-center gap-4" style={{ opacity }}>
      <span className="w-[22px] shrink-0 font-mono text-[13px] text-muted">{n}</span>
      <FitTex latex={line.latex} size={size} min={16} />
      <Mark mark={line.mark} size={size} />
    </div>
  );
}

// The current (big) line, in its tinted block with a numbered badge.
function Current({ line }: { line: CurrentLine }) {
  return (
    <div className="-ml-6 flex min-w-0 items-center gap-5 rounded-[14px] bg-white/[.04] px-6 py-4 shadow-[inset_0_0_0_1.5px_rgba(236,232,221,.10)]">
      <span className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full font-mono text-[15px] font-semibold text-[#14181D] ${BADGE[line.badge]}`}>
        {line.number}
      </span>
      {line.latex ? (
        <FitTex latex={line.latex} size={48} min={26} />
      ) : (
        <span className="font-hand text-3xl text-[rgba(236,232,221,.4)]">{line.placeholder}</span>
      )}
      {line.fixLatex && (
        <span className="flex min-w-0 items-center gap-3 text-teal">
          <span aria-hidden className="text-3xl">→</span>
          <FitTex latex={line.fixLatex} size={34} min={18} />
        </span>
      )}
      {line.note && <span className="ml-auto shrink-0 font-hand text-[22px]">{line.note}</span>}
    </div>
  );
}

// Math that shrinks (down to `min` px) instead of wrapping or overflowing (DESIGN.md "shrink-to-fit").
export function FitTex({ latex, size, min }: { latex: string; size: number; min: number }) {
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
    <span ref={box} className="min-w-0 flex-1 overflow-hidden whitespace-nowrap">
      <span ref={inner} className="inline-block" style={{ fontSize }}>
        <Tex latex={latex} />
      </span>
    </span>
  );
}

// The little status mark after a line.
export function Mark({ mark, size }: { mark: BoardLine["mark"]; size: number }) {
  const s = Math.max(16, size * 0.8);
  if (mark === "correct" || mark === "alternate") {
    return (
      <span className="flex shrink-0 items-center gap-2">
        <svg width={s} height={s * 0.8} viewBox="0 0 30 24" role="img" aria-label="Correct">
          <path d="M3 13l8 7L27 3" stroke="#4FD1B5" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {mark === "alternate" && <span className="font-hand text-lg text-teal">another way</span>}
      </span>
    );
  }
  if (mark === "hinted") {
    return <span role="img" aria-label="Hint used" className="shrink-0 text-gold" style={{ fontSize: s * 0.8 }}>⚠</span>;
  }
  return null;
}

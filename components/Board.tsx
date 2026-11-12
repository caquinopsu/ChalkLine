"use client";

// The chalkboard (DESIGN.md section 6): problem on top, then a step stack where only the
// current line is big. Older lines shrink and dim, and anything older folds into one pill.
// Phase 4 adds the motion (DESIGN.md section 10): new lines ink in, older lines shrink smoothly,
// colored parts slide from the previous line into the new one, ✓ marks draw on, wrong parts shake.
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Tex } from "./Tex";

// true if the visitor asked their system for less motion (then we skip the JavaScript animations;
// the CSS ones are switched off in globals.css).
const calm = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// The colored part classes the AI uses (\htmlClass{role-a}{...}); matched parts slide between lines.
const ROLES = ["role-a", "role-b", "role-c"];

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
};

const BADGE = { gold: "bg-gold", pink: "bg-pink", blue: "bg-blue" };

export function Board({ problemLatex, status, lines, current, ghost, overlay, speaking, children }: Props) {
  const [expanded, setExpanded] = useState(false); // is the "earlier steps" overlay open?
  const stack = useRef<HTMLDivElement>(null); // the step stack, to find parts to slide
  const prevCount = useRef(lines.length); // how many finished lines there were last time
  // "fresh" for the first moments after the board drops, so step 1 waits for the drop to finish.
  const [fresh, setFresh] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setFresh(false), 1600);
    return () => clearTimeout(t); // clean up if the board goes away first
  }, []);

  // Carry-over slide: when a step is finished (one more line), each colored part of the line that
  // just moved up flies down to the same-colored part of the new current line.
  useLayoutEffect(() => {
    const grew = lines.length === prevCount.current + 1; // exactly one new finished line (not typing, not a reset)
    prevCount.current = lines.length;
    if (!grew || !current || !stack.current || calm()) return;
    const rows = stack.current.querySelectorAll("[data-row]");
    const from = rows[rows.length - 1]; // the line that just finished
    const to = stack.current.querySelector("[data-current]");
    if (!from || !to) return;
    for (const role of ROLES) slidePart(from.querySelector(`.${role}`), to.querySelector(`.${role}`));
  }, [lines.length, current]);
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
      {/* board-drop: the board (and its ledge) unroll down from the rail when a problem opens */}
      <div className={`board-drop flex min-h-0 flex-1 flex-col ${fresh ? "board-fresh" : ""}`}>
      <div className="board-surface relative mx-2.5 flex min-h-0 flex-1 flex-col rounded-b-lg border-x-[6px] border-b-[6px] border-wood px-4 py-3 md:border-x-[12px] md:border-b-[12px] md:px-14 md:py-6">
        {/* Header row: the problem and a handwritten status */}
        <div className="flex items-center justify-between border-b border-[rgba(236,232,221,.14)] pb-3">
          <span className="problem-ink min-w-0 truncate text-[20px] md:text-[28px]"><Tex latex={problemLatex} /></span>
          <span className="shrink-0 pl-3 font-hand text-lg text-muted md:text-2xl">{status}</span>
        </div>

        {children ?? (
          <div ref={stack} className={`flex min-h-0 flex-1 flex-col justify-center gap-5 pb-4 ${speaking ? "board-speaking" : ""}`}>
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
            {/* key = step number, so a new step mounts fresh and inks in (typing doesn't re-ink) */}
            {current && <Current key={current.number} line={current} />}
            {ghost && <span className="truncate pl-10 font-hand text-xl md:text-[26px] text-[rgba(236,232,221,.35)]">{ghost}</span>}
          </div>
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

// An older (finished) line: number, math, mark.
function Row({ n, line, size, opacity }: { n: number; line: BoardLine; size: number; opacity: number }) {
  const el = useRef<HTMLDivElement>(null);
  const prevSize = useRef(size); // the size this line had before
  // Shrink-on-arrival: when the line gets smaller, ease it from its old size instead of jumping.
  useLayoutEffect(() => {
    const before = prevSize.current;
    prevSize.current = size;
    if (before === size || !el.current || calm()) return;
    el.current.animate(
      [{ transform: `scale(${before / size})` }, { transform: "scale(1)" }],
      { duration: 400, easing: "cubic-bezier(.2,.7,.2,1)" },
    );
  }, [size]);
  return (
    <div ref={el} data-row className="flex min-w-0 origin-left items-center gap-4 transition-opacity duration-400" style={{ opacity }}>
      <span className="w-[22px] shrink-0 font-mono text-[13px] text-muted">{n}</span>
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
    <div ref={el} data-current className="-ml-2 flex min-w-0 items-center gap-3 rounded-[14px] bg-white/[.04] px-3 py-3 md:-ml-6 md:gap-5 md:px-6 md:py-4 shadow-[inset_0_0_0_1.5px_rgba(236,232,221,.10)]">
      <span className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full font-mono text-[15px] font-semibold text-[#14181D] ${BADGE[line.badge]}`}>
        {line.number}
      </span>
      {line.latex ? (
        // "ink" = the left-to-right chalk reveal, played once when this step appears
        <span className="ink flex min-w-0 flex-1"><FitTex latex={line.latex} size={48} min={18} /></span>
      ) : (
        <span className="font-hand text-3xl text-[rgba(236,232,221,.4)]">{line.placeholder}</span>
      )}
      {line.fixLatex && (
        <span className="ink flex min-w-0 items-center gap-3 text-teal">
          <span aria-hidden className="text-3xl">→</span>
          <FitTex latex={line.fixLatex} size={34} min={18} />
        </span>
      )}
      {/* Rule tag: a small handwritten label with a pointer, saying what this step did */}
      {line.tag && !line.note && (
        <span className="tag-in ml-auto hidden shrink-0 font-hand text-[22px] text-gold md:inline">← {line.tag}</span>
      )}
      {line.note && <span className="ml-auto shrink-0 font-hand text-[22px]">{line.note}</span>}
    </div>
  );
}

// Flies a copy of one colored part from its spot in the old line to its spot in the new line,
// then shows the real one. (The copy lives on top of the page for ~0.7 s and is then removed.)
function slidePart(from: Element | null, to: Element | null) {
  if (!(from instanceof HTMLElement) || !(to instanceof HTMLElement)) return;
  const a = from.getBoundingClientRect();
  const b = to.getBoundingClientRect();
  if (!a.width || !b.width) return;
  const copy = document.createElement("span");
  copy.className = "katex"; // so the copied math keeps KaTeX's fonts and spacing
  copy.innerHTML = from.outerHTML;
  Object.assign(copy.style, {
    position: "fixed", left: `${a.left}px`, top: `${a.top}px`, margin: "0", zIndex: "50",
    pointerEvents: "none", transformOrigin: "top left", whiteSpace: "nowrap",
    fontSize: getComputedStyle(from).fontSize, color: "var(--color-chalk)",
  });
  document.body.appendChild(copy);
  to.style.visibility = "hidden"; // the real part waits until the copy lands
  const scale = b.height / a.height; // the new line is bigger
  const run = copy.animate(
    [{ transform: "translate(0,0) scale(1)" }, { transform: `translate(${b.left - a.left}px, ${b.top - a.top}px) scale(${scale})` }],
    { duration: 700, easing: "cubic-bezier(.45,0,.25,1)" },
  );
  const done = () => { copy.remove(); to.style.visibility = ""; };
  run.onfinish = done;
  run.oncancel = done;
}

// Math that shrinks (down to `min` px) instead of wrapping or overflowing (DESIGN.md "shrink-to-fit").
// grow = take all the free width (false = only as wide as the math, so a mark can sit right after it).
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
    <span ref={box} className={`min-w-0 overflow-hidden whitespace-nowrap ${grow ? "flex-1" : "flex-initial"}`}>
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
          {/* pathLength=1 lets the CSS "check-draw" animation draw the stroke on from start to end */}
          <path className="check-draw" pathLength={1} d="M3 13l8 7L27 3" stroke="#4FD1B5" strokeWidth="3.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
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

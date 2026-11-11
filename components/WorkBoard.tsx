"use client";

// The board in Check my work (DESIGN.md frame H). Before checking: the student's lines, tap one to edit it.
// After checking: ✓ on correct lines, a pink ring + teal fix on the first slip, and later lines faded.
import { FitTex, Mark } from "./Board";
import { ringError } from "./Tex";
import type { WorkResult } from "@/lib/schemas";

type Props = {
  lines: string[]; // the submitted lines (LaTeX)
  unclear: boolean[]; // per line: hard to read in the photo?
  draft: string; // the line being typed right now
  editIndex: number | null; // which line is being edited (null = adding a new one)
  result: WorkResult | null; // the check result, once there is one
  onPickLine: (i: number) => void; // tap a line to edit it (before checking)
};

// Fewer lines = bigger chalk. The board always fits without scrolling for typical solutions.
function sizeFor(count: number) {
  return count <= 3 ? 34 : count <= 5 ? 28 : count <= 8 ? 22 : 18;
}

export function WorkBoard({ lines, unclear, draft, editIndex, result, onPickLine }: Props) {
  if (result) return <CheckedLines result={result} />;

  const showDraft = editIndex === null; // a new line is being written at the bottom
  const count = lines.length + (showDraft ? 1 : 0);
  const size = sizeFor(count);
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 overflow-y-auto py-4">
      {lines.map((latex, i) => (
        <button
          key={i}
          onClick={() => onPickLine(i)}
          title="Edit this line"
          className={`flex min-w-0 items-center gap-4 rounded-xl px-3 py-1 text-left hover:bg-white/[.04] ${editIndex === i ? "bg-white/[.06] shadow-[inset_0_0_0_1.5px_rgba(244,195,90,.5)]" : ""}`}
        >
          <span className="w-[22px] shrink-0 font-mono text-[13px] text-muted">{i + 1}</span>
          <FitTex latex={editIndex === i ? draft || latex : latex} size={size} min={14} />
          {unclear[i] && editIndex !== i && (
            <span className="flex shrink-0 items-center gap-2 font-hand text-xl text-gold">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-gold text-sm">?</span>
              check this line
            </span>
          )}
          {editIndex === i && <span className="shrink-0 font-hand text-xl text-gold">editing…</span>}
        </button>
      ))}
      {showDraft && (
        <div className="flex min-w-0 items-center gap-4 rounded-xl border border-dashed border-white/15 px-3 py-1">
          <span className="w-[22px] shrink-0 font-mono text-[13px] text-muted">{lines.length + 1}</span>
          {draft ? (
            <>
              <FitTex latex={draft} size={size} min={14} />
              <span className="shrink-0 font-hand text-xl text-[rgba(236,232,221,.45)]">writing…</span>
            </>
          ) : (
            <span className="font-hand text-2xl text-[rgba(236,232,221,.4)]">
              {lines.length === 0 ? "write your solution below, one line at a time" : "next line (or press Check my work)"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// After checking: top to bottom, ✓ … first slip (ringed, with the fix) … faded lines to redo.
function CheckedLines({ result }: { result: WorkResult }) {
  const size = sizeFor(result.lines.length);
  const noteLine = result.slipIndex === null ? -1 : result.slipIndex + 1; // the first faded line gets the "redo after the fix" note
  return (
    <div className="flex min-h-0 flex-1 flex-col justify-center gap-3 overflow-y-auto py-4">
      {result.lines.map((line, i) => {
        if (line.verdict === "slip") {
          const ringed = result.errorLatex ? ringError(line.latex, result.errorLatex) : line.latex;
          return (
            <div key={i} className="-ml-3 flex min-w-0 items-center gap-4 rounded-[14px] bg-white/[.04] px-3 py-3 shadow-[inset_0_0_0_1.5px_rgba(255,107,122,.35)]">
              <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-pink font-mono text-[14px] font-semibold text-[#14181D]">{i + 1}</span>
              <FitTex latex={ringed} size={size + 6} min={16} grow={false} />
              {result.fixLatex && (
                <span className="flex min-w-0 flex-1 items-center gap-3 text-teal">
                  <span aria-hidden className="text-3xl">→</span>
                  <FitTex latex={result.fixLatex} size={size + 2} min={14} />
                </span>
              )}
              {result.fixNote && <span className="shrink-0 font-hand text-[22px] text-teal">{result.fixNote}</span>}
            </div>
          );
        }
        const faded = line.verdict === "after";
        const note = i === noteLine;
        return (
          <div key={i} className="flex min-w-0 items-center gap-4 px-0" style={{ opacity: faded ? 0.28 : 0.8 }}>
            <span className="w-[22px] shrink-0 font-mono text-[13px] text-muted">{i + 1}</span>
            <FitTex latex={line.latex} size={size} min={14} grow={false} />
            {line.verdict === "correct" && <Mark mark="correct" size={size} />}
            {note && <span className="shrink-0 font-hand text-xl text-muted">redo after the fix</span>}
          </div>
        );
      })}
    </div>
  );
}

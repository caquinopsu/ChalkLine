// Renders LaTeX as math using KaTeX, plus helpers for text that mixes words and $math$.
import katex from "katex"; // the math typesetting library
import { useMemo } from "react";

// LaTeX -> HTML. Only \htmlClass and \htmlId are "trusted" (they add CSS classes for colors and
// the pink error ring); everything else that could inject HTML stays disabled.
export function texToHtml(latex: string, display = false): string {
  try {
    return katex.renderToString(latex, {
      throwOnError: false, // show bad LaTeX in red instead of crashing
      displayMode: display, // true = big centered style (for \sum, \int limits)
      strict: "ignore", // don't warn about non-standard LaTeX
      trust: (ctx) => ctx.command === "\\htmlClass" || ctx.command === "\\htmlId",
    });
  } catch {
    return latex.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!); // show raw text safely
  }
}

// <Tex latex="x^2" /> draws x² inline.
export function Tex({ latex, display = false, className }: { latex: string; display?: boolean; className?: string }) {
  const html = useMemo(() => texToHtml(latex, display), [latex, display]); // only re-render math when it changes
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

// <RichText text="Pull out the $\frac12$ first." /> draws the words and the inline math.
export function RichText({ text, className }: { text: string; className?: string }) {
  const pieces = text.split(/\$([^$]+)\$/g); // odd-numbered pieces are the math between $...$
  return (
    <span className={className}>
      {pieces.map((piece, i) => (i % 2 === 1 ? <Tex key={i} latex={piece} /> : <span key={i}>{piece}</span>))}
    </span>
  );
}

// Removes the color markup: \htmlClass{role-a}{u} -> u (repeats for nested markup).
export function stripMarkup(latex: string): string {
  let out = latex;
  for (let i = 0; i < 5 && out.includes("\\htmlClass"); i++) {
    out = out.replace(/\\htmlClass\{[^{}]*\}\{((?:[^{}]|\{[^{}]*\})*)\}/g, "$1");
  }
  return out;
}

// Wraps the wrong piece of a line in a pink ring, if that piece appears in the line with balanced braces.
export function ringError(latex: string, wrong: string | null): string {
  if (!wrong || !latex.includes(wrong)) return latex; // nothing to ring
  let depth = 0; // brace balance check: "{x" alone would break the LaTeX
  for (const ch of wrong) {
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth < 0) return latex;
  }
  if (depth !== 0) return latex;
  return latex.replace(wrong, `\\htmlClass{part-error}{${wrong}}`); // ring the first occurrence
}

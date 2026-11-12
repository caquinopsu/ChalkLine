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
// Math the AI forgot to put in $...$ ("u = ln x", "(x-1)", "a = 1") is found and typeset too (mathify).
export function RichText({ text, className }: { text: string; className?: string }) {
  const pieces = mathify(text).split(/\$([^$]+)\$/g); // odd-numbered pieces are the math between $...$
  return (
    <span className={className}>
      {pieces.map((piece, i) => (i % 2 === 1 ? <Tex key={i} latex={piece} /> : <span key={i}>{piece}</span>))}
    </span>
  );
}

// Function names and differentials that count as math when written as plain words.
const FUNCS = new Set(["ln", "log", "sin", "cos", "tan", "sec", "csc", "cot", "arcsin", "arccos", "arctan", "lim", "exp", "dx", "du", "dv", "dy", "dt", "dθ"]);
const VARS = new Set(["x", "u", "v", "y", "t", "n", "k", "C", "f", "g", "e"]); // single letters that are math on their own
const OPS = /[=+\-−*/^·<>≤≥]/; // operator characters

// Is this one word math? Only digits, operators, brackets and letters, where every run of letters is a
// single letter or a known function ("x^2", "(x-1)", "ln", "2x" yes; "is", "first-year" no).
function mathWord(w: string): boolean {
  if (!/^[()[\]{}\\0-9a-zA-Zθπ=+\-−*/^·.<>≤≥|′']+$/.test(w)) return false;
  const runs = w.replace(/\\[a-zA-Z]+/g, "").match(/[a-zA-Zθ]+/g) ?? []; // LaTeX commands like \int always count
  return runs.every((r) => r.length === 1 || FUNCS.has(r));
}

// Wraps plain-text math in $...$ so it gets typeset. Text already inside $...$ is left alone.
// A group of math words is only converted when it clearly is math: it has an operator, a function
// name, or is a lone variable like "x" or "u". English words like "a" and "I" only count next to an operator.
export function mathify(text: string): string {
  return text
    .split(/(\$[^$]+\$)/g)
    .map((part) => (part.startsWith("$") ? part : mathifyPlain(part)))
    .join("");
}
function mathifyPlain(text: string): string {
  const tokens = text.split(/(\s+)/); // words and the spaces between them
  const out: string[] = [];
  let group: string[] = []; // consecutive math words (with their spaces)
  const flush = () => {
    if (!group.length) return;
    // keep trailing spaces outside the math
    let tail = "";
    while (group.length && /^\s+$/.test(group[group.length - 1])) tail = group.pop() + tail;
    const raw = group.join("");
    const words = group.filter((g) => !/^\s+$/.test(g));
    const isMath =
      OPS.test(raw) || /\\[a-zA-Z]/.test(raw) || words.some((w) => (w.match(/[a-zA-Zθ]+/g) ?? []).some((r) => FUNCS.has(r))) ||
      (words.length === 1 && VARS.has(words[0])) || /\d[a-zA-Z]|[a-zA-Z]\d/.test(raw);
    out.push(isMath ? `$${toLatex(raw)}$` : raw, tail);
    group = [];
  };
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    if (/^\s+$/.test(tok)) {
      (group.length ? group : out).push(tok);
      continue;
    }
    // split off punctuation at the ends ("x," "(x-1)." ) so it stays text
    const m = tok.match(/^(.*?)([.,;:!?"”’]*)$/)!;
    let word = m[1];
    const punct = m[2];
    let lead = "";
    if (/^[“"]/.test(word)) { lead = word[0]; word = word.slice(1); }
    const englishLetter = /^(a|A|I)$/.test(word); // "a", "A", "I" are math only beside an operator
    const nextWord = tokens.slice(i + 1).find((t) => !/^\s+$/.test(t)) ?? "";
    const prevWord = [...group].reverse().find((t) => !/^\s+$/.test(t)) ?? "";
    const nearOp = OPS.test(nextWord.slice(0, 1)) || OPS.test(prevWord.slice(-1));
    if (word && !lead && mathWord(word) && (!englishLetter || nearOp)) {
      group.push(word);
      if (punct) { flush(); out.push(punct); }
    } else {
      flush();
      out.push(tok);
    }
  }
  flush();
  return out.join("");
}

// Plain math -> LaTeX: function names get a backslash, * and · become a centered dot, ^10 gets braces.
function toLatex(raw: string): string {
  return raw
    .replace(/−/g, "-")
    .replace(/\b(arcsin|arccos|arctan|ln|log|sin|cos|tan|sec|csc|cot|lim|exp)\b/g, "\\$1 ")
    .replace(/[*·]/g, "\\cdot ")
    .replace(/≤/g, "\\le ").replace(/≥/g, "\\ge ")
    .replace(/\^(\d{2,}|[a-zA-Z]{2,})/g, "^{$1}")
    .replace(/\bd([xuvyt])\b/g, "\\,d$1");
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

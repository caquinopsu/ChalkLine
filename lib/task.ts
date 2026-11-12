// What a problem asks ("Find the antiderivative."), shown in gold before the problem on the board.
// The solution package says it (pkg.task); this is the fallback for older packages and for the few
// seconds before a typed problem's solution arrives: a guess from the problem's LaTeX.
export function guessTask(latex: string): string {
  const s = latex.replace(/\s+/g, "");
  if (/\\lim/.test(s)) return "Evaluate the limit.";
  if (/\\int_/.test(s)) return "Evaluate the integral.";
  if (/\\int/.test(s)) return "Find the antiderivative.";
  if (/\\frac\{d\}\{d[a-z]\}|\\frac\{d/.test(s)) return "Find the derivative.";
  if (/\\sum/.test(s)) return "Decide whether the series converges.";
  return ""; // not sure: show nothing rather than a wrong instruction
}

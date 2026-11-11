"use client"; // runs in the browser: it's an interactive input

// A math input box powered by MathLive: typing "/" makes a fraction, "^" a power, and it gives us LaTeX.
import type { MathfieldElement } from "mathlive"; // type only (the real code is loaded in the browser below)
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

// Things a parent component can do to the input (via a "ref", a handle to the component).
export type MathInputHandle = {
  insert: (latex: string) => void; // insert a snippet at the cursor (used by the math keys)
  clear: () => void; // empty the box
  focus: () => void; // put the cursor in the box
};

type Props = {
  onChange: (latex: string) => void; // called on every edit with the current LaTeX
  onSubmit?: () => void; // called when the user presses Enter
  placeholder?: string; // gray hint text when empty (LaTeX)
  ariaLabel: string; // name for screen readers
  className?: string;
};

export const MathInput = forwardRef<MathInputHandle, Props>(function MathInput(
  { onChange, onSubmit, placeholder, ariaLabel, className },
  handle,
) {
  const ref = useRef<MathfieldElement>(null); // the <math-field> element on the page
  const [ready, setReady] = useState(false); // true once MathLive's code has loaded
  const onChangeRef = useRef(onChange); // keep the latest callbacks without re-attaching listeners
  const onSubmitRef = useRef(onSubmit);
  useEffect(() => {
    onChangeRef.current = onChange;
    onSubmitRef.current = onSubmit;
  });

  // Load MathLive only in the browser (it needs `window`, which doesn't exist on the server).
  useEffect(() => {
    let cancelled = false;
    import("mathlive").then(({ MathfieldElement }) => {
      MathfieldElement.fontsDirectory = null; // reuse KaTeX's fonts (already loaded by katex.min.css)
      MathfieldElement.soundsDirectory = null; // no keyboard click sounds
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Once loaded: configure the field and listen for typing and Enter.
  useEffect(() => {
    const mf = ref.current;
    if (!ready || !mf) return;
    mf.mathVirtualKeyboardPolicy = "manual"; // don't pop up MathLive's on-screen keyboard; we have our own keys
    mf.menuItems = []; // hide MathLive's right-click menu
    const handleInput = () => onChangeRef.current(mf.value); // mf.value is the LaTeX
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault(); // don't insert a new line
        onSubmitRef.current?.();
      }
    };
    mf.addEventListener("input", handleInput);
    mf.addEventListener("keydown", handleKey, { capture: true });
    return () => {
      mf.removeEventListener("input", handleInput);
      mf.removeEventListener("keydown", handleKey, { capture: true });
    };
  }, [ready]);

  // The actions the parent can call.
  useImperativeHandle(handle, () => ({
    insert: (latex) => {
      const mf = ref.current;
      if (!mf) return;
      mf.insert(latex, { selectionMode: "placeholder", focus: true }); // #? in the snippet becomes a box to type in
      onChangeRef.current(mf.value);
    },
    clear: () => {
      if (!ref.current) return;
      ref.current.value = "";
      onChangeRef.current("");
    },
    focus: () => ref.current?.focus(),
  }));

  return (
    <math-field
      ref={ref}
      aria-label={ariaLabel}
      placeholder={placeholder}
      className={className}
      suppressHydrationWarning // MathLive changes the element after the page loads; that's expected
    />
  );
});

// The math keys shown under/next to the input. `insert` is the LaTeX snippet; #? marks a slot to fill.
export const KEYS_PRACTICE = [
  { label: "∫", insert: "\\int " },
  { label: "a⁄b", insert: "\\frac{#@}{#?}" },
  { label: "xⁿ", insert: "#@^{#?}" },
  { label: "ln", insert: "\\ln " },
  { label: "√", insert: "\\sqrt{#?}" },
  { label: "π", insert: "\\pi" },
  { label: "e", insert: "e" },
  { label: "+C", insert: "+C" },
  { label: "(", insert: "(" },
  { label: ")", insert: ")" },
];

export const KEYS_PROBLEM = [
  { label: "∫", insert: "\\int " },
  { label: "√", insert: "\\sqrt{#?}" },
  { label: "xⁿ", insert: "#@^{#?}" },
  { label: "a⁄b", insert: "\\frac{#@}{#?}" },
  { label: "π", insert: "\\pi" },
  { label: "∞", insert: "\\infty" },
  { label: "Σ", insert: "\\sum_{#?}^{#?}" },
  { label: "ln", insert: "\\ln " },
  { label: "sin", insert: "\\sin " },
  { label: "lim", insert: "\\lim_{#?\\to #?}" },
];

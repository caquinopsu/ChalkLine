// Browser helpers for the tutor's voice.
// speak() / speakSequence() try Cartesia through our /api/tts route (only if the server has a key), and
// fall back to the browser's built-in voice (speechSynthesis) on ANY problem. latexToWords() turns math into
// something a voice can read: "\frac{x^2}{2}" -> "x squared over 2".

let ttsOff = false; // set once /api/tts says Cartesia isn't set up, so we stop asking
let audio: HTMLAudioElement | null = null; // the Cartesia clip that's playing, if any
let finishCurrent: (() => void) | null = null; // ends the promise of whatever is speaking now
let token = 0; // goes up every time speech is stopped, so a running sequence knows to quit

// Can this browser speak at all?
export function canSpeak(): boolean {
  return typeof window !== "undefined" && ("speechSynthesis" in window || typeof Audio !== "undefined");
}

// Stops whatever the tutor is saying (the "tap to interrupt" button, or leaving the screen).
export function stopSpeaking() {
  token++; // any sequence in progress stops after the current piece
  if (audio) {
    audio.pause(); // stop the Cartesia clip
    audio = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel(); // stop the browser voice
  finishCurrent?.(); // let anyone waiting for the speech know it's over
  finishCurrent = null;
}

// Says `text` out loud. The promise resolves when it's done (or was interrupted). Never throws.
export async function speak(text: string): Promise<void> {
  return speakSequence([{ text }]);
}

// One piece of a longer reading, and what to light up on screen while it's being said.
export type SpeechPiece = { text: string; onStart?: () => void };

// Says several pieces one after another, calling each piece's onStart just as it begins
// (Read aloud uses this to light up the part of the board being talked about).
// With Cartesia, every piece is requested at once up front, so there are no gaps between them.
export async function speakSequence(pieces: SpeechPiece[]): Promise<void> {
  stopSpeaking(); // one voice at a time
  const mine = token; // if this changes, someone stopped us
  const list = pieces.map((p) => ({ ...p, text: p.text.trim() })).filter((p) => p.text);
  if (!list.length) return;
  // The nicer voice: fetch the pieces' audio ahead of time, 2 at a time (Cartesia's free plan allows
  // 2 requests at once). Each is null if it failed.
  const clips = ttsOff ? null : fetchAhead(list.map((p) => p.text), 2);
  for (let i = 0; i < list.length; i++) {
    if (token !== mine) break; // stopped
    const url = clips ? await clips[i] : null;
    if (token !== mine) break;
    list[i].onStart?.();
    if (url) await playClip(url);
    else await speakBrowser(list[i].text); // this piece failed (or no Cartesia): the browser voice says it
  }
  clips?.forEach((c) => c.then((u) => u && URL.revokeObjectURL(u))); // free the audio memory
}

// Starts fetching every text's audio, at most `limit` at a time, in order. Returns one promise per text.
function fetchAhead(texts: string[], limit: number): Promise<string | null>[] {
  const starters: (() => void)[] = [];
  let running = 0;
  const next = () => {
    while (running < limit && starters.length) starters.shift()!();
  };
  const promises = texts.map(
    (t) =>
      new Promise<string | null>((resolve) => {
        starters.push(() => {
          running++;
          fetchClip(t).then((url) => {
            running--;
            resolve(url);
            next(); // a slot is free: start the next piece
          });
        });
      }),
  );
  next();
  return promises;
}

// Asks our server route for one piece of Cartesia audio. Returns a temporary local link, or null.
async function fetchClip(text: string): Promise<string | null> {
  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(9000), // don't keep the student waiting
    });
    if (res.status === 501) ttsOff = true; // no Cartesia key on the server: never ask again this visit
    if (!res.ok) return null;
    return URL.createObjectURL(await res.blob()); // the MP3 as a temporary local link
  } catch {
    return null; // network error, timeout, ...: the browser voice takes over
  }
}

// Plays one clip; resolves when it ends or is stopped.
function playClip(url: string): Promise<void> {
  const clip = new Audio(url);
  audio = clip;
  return new Promise<void>((resolve) => {
    const done = () => {
      if (audio === clip) audio = null;
      resolve();
    };
    finishCurrent = done;
    clip.onended = done;
    clip.onerror = done;
    clip.play().catch(done); // autoplay can be blocked; then we just end
  });
}

// The voices we like best, in order (names differ per browser and operating system).
const PREFERRED = ["Google US English", "Samantha", "Microsoft Aria Online (Natural)", "Microsoft Jenny Online (Natural)", "Natural", "Google UK English Female", "Karen", "Daniel"];

// Picks a clear English voice from the ones this browser has.
function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
  for (const name of PREFERRED) {
    const v = voices.find((x) => x.name.includes(name));
    if (v) return v;
  }
  return voices.find((v) => v.lang.toLowerCase() === "en-us") ?? voices[0] ?? null;
}

// The browser's built-in voice. Works offline and costs nothing.
function speakBrowser(text: string): Promise<void> {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return Promise.resolve(); // no voice: the text is on screen anyway
  return new Promise<void>((resolve) => {
    let ended = false;
    const done = () => {
      if (ended) return;
      ended = true;
      clearTimeout(safety);
      resolve();
    };
    finishCurrent = done;
    const u = new SpeechSynthesisUtterance(text); // one thing to say
    const voice = pickVoice();
    if (voice) u.voice = voice;
    u.lang = voice?.lang ?? "en-US";
    u.rate = 1.0; // normal speed
    u.onend = done;
    u.onerror = done;
    // Some browsers occasionally never fire "end"; don't let that freeze the mic.
    const safety = setTimeout(done, 3000 + text.length * 90);
    window.speechSynthesis.speak(u);
  });
}

// Voices load in the background in some browsers; asking early makes the first sentence use the right one.
if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.getVoices();

// ---------- Math to words ----------

// Words for single LaTeX commands.
const WORDS: Record<string, string> = {
  ln: "natural log of", log: "log of", exp: "e to the", sin: "sine", cos: "cosine", tan: "tangent", sec: "secant",
  csc: "cosecant", cot: "cotangent", arcsin: "arc sine", arccos: "arc cosine", arctan: "arc tangent",
  sinh: "hyperbolic sine", cosh: "hyperbolic cosine", cdot: "times", times: "times", div: "divided by", pi: "pi",
  infty: "infinity", theta: "theta", alpha: "alpha", beta: "beta", lambda: "lambda", to: "goes to", pm: "plus or minus",
  le: "is at most", leq: "is at most", ge: "is at least", geq: "is at least", neq: "does not equal", ne: "does not equal",
  approx: "is about", Rightarrow: "so", implies: "so", ldots: "and so on", cdots: "and so on", dots: "and so on",
  partial: "partial", lvert: "", rvert: "", vert: "", mid: "", quad: "", qquad: "", displaystyle: "", left: "", right: "",
  big: "", Big: "", bigl: "", bigr: "", limits: "", int: "the integral of",
};

const SYMBOLS: Record<string, string> = { "+": "plus", "-": "minus", "=": "equals", "<": "is less than", ">": "is greater than", "/": "over", "!": "factorial", ",": ",", "*": "times", "|": "" };

// Reads a {group} (or a single character / command) starting at s[i]. Returns its contents and where it ends.
function readArg(s: string, i: number): [string, number] {
  while (s[i] === " ") i++;
  if (s[i] === "{") {
    let depth = 0;
    for (let j = i; j < s.length; j++) {
      if (s[j] === "{") depth++;
      else if (s[j] === "}" && --depth === 0) return [s.slice(i + 1, j), j + 1];
    }
    return [s.slice(i + 1), s.length]; // unbalanced: take the rest
  }
  if (s[i] === "\\") {
    const m = /^\\[a-zA-Z]+/.exec(s.slice(i));
    if (m) return [m[0], i + m[0].length];
  }
  return [s[i] ?? "", i + 1];
}

// Finds the bracket that closes the one at s[i] (or the end of the string).
function matching(s: string, i: number): number {
  const open = s[i], close = open === "(" ? ")" : "]";
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    if (s[j] === open) depth++;
    else if (s[j] === close && --depth === 0) return j;
  }
  return s.length;
}

// Reads an optional _{...} and ^{...} after \int, \sum or \lim (in either order).
function readLimits(s: string, i: number): { sub: string | null; sup: string | null; end: number } {
  let sub: string | null = null;
  let sup: string | null = null;
  for (let k = 0; k < 2; k++) {
    while (s[i] === " ") i++;
    if (s[i] === "_") [sub, i] = readArg(s, i + 1);
    else if (s[i] === "^") [sup, i] = readArg(s, i + 1);
  }
  return { sub, sup, end: i };
}

// Says a power: ^2 "squared", ^3 "cubed", otherwise "to the n".
function power(p: string): string {
  const t = p.trim();
  if (t === "2") return "squared";
  if (t === "3") return "cubed";
  const w = convert(t);
  return w.includes(" ") ? `to the ${w},` : `to the ${w}`; // a pause after long exponents
}

// The core: LaTeX in, words out (recursive for fractions, roots, ...).
function convert(s: string): string {
  const out: string[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === "\\") {
      const m = /^\\([a-zA-Z]+|.)/.exec(s.slice(i));
      const name = m ? m[1] : "";
      i += m ? m[0].length : 1;
      if (name === "frac" || name === "dfrac" || name === "tfrac") {
        let a: string, b: string;
        [a, i] = readArg(s, i);
        [b, i] = readArg(s, i);
        if (a.trim() === "d" && /^d\s*[a-z]$/.test(b.trim())) out.push(`the derivative with respect to ${b.trim().slice(-1)} of`); // d/dx
        else {
          const top = convert(a), bottom = convert(b);
          const long = top.includes(" ") || bottom.includes(" ");
          out.push(long ? `${top}, over ${bottom},` : `${top} over ${bottom}`); // commas = small pauses
        }
      } else if (name === "sqrt") {
        let n = "";
        if (s[i] === "[") {
          const close = s.indexOf("]", i);
          n = s.slice(i + 1, close);
          i = close + 1;
        }
        let a: string;
        [a, i] = readArg(s, i);
        out.push(n ? `the ${convert(n)} root of ${convert(a)},` : `the square root of ${convert(a)},`);
      } else if (name === "int") {
        const { sub, sup, end } = readLimits(s, i);
        i = end;
        out.push(sub !== null && sup !== null ? `the integral from ${convert(sub)} to ${convert(sup)} of` : "the integral of");
      } else if (name === "sum") {
        const { sub, sup, end } = readLimits(s, i);
        i = end;
        out.push(sub !== null && sup !== null ? `the sum from ${convert(sub)} to ${convert(sup)} of` : "the sum of");
      } else if (name === "lim") {
        const { sub, end } = readLimits(s, i);
        i = end;
        out.push(sub !== null ? `the limit as ${convert(sub)} of` : "the limit of");
      } else if (name === "text" || name === "mathrm" || name === "operatorname" || name === "mathbf" || name === "boxed") {
        let a: string;
        [a, i] = readArg(s, i);
        out.push(name === "text" ? a : convert(a));
      } else if (name === "htmlClass") {
        [, i] = readArg(s, i); // skip the class name
        let a: string;
        [a, i] = readArg(s, i);
        out.push(convert(a)); // keep the colored piece itself
      } else if (name in WORDS && s[i] === "^" && /^(ln|log|sin|cos|tan|sec|csc|cot)$/.test(name)) {
        // A power on a function: \ln^3 x -> "natural log cubed of x", \sin^2 x -> "sine squared x"
        let p: string;
        [p, i] = readArg(s, i + 1);
        const base = WORDS[name].replace(/ of$/, "");
        out.push(`${base} ${power(p).replace(/,$/, "")}${WORDS[name].endsWith(" of") ? " of" : ""}`);
      } else if (name in WORDS) {
        out.push(WORDS[name]);
      } else if (/^[,;:! ]$/.test(name)) {
        // thin spaces like \, : nothing to say
      } else if (name === "{" || name === "}") {
        // escaped braces: nothing to say
      } else {
        out.push(name); // unknown command: say its name
      }
    } else if (c === "^") {
      let a: string;
      [a, i] = readArg(s, i + 1);
      out.push(power(a));
    } else if (c === "_") {
      let a: string;
      [a, i] = readArg(s, i + 1);
      out.push(`sub ${convert(a)}`);
    } else if (c === "{" || c === "}") {
      i++; // plain grouping braces
    } else if (c === "(" || c === "[") {
      // Brackets around a sum are "the quantity ...", other brackets are just a short pause.
      const close = matching(s, i);
      const inner = s.slice(i + 1, close);
      const last = out[out.length - 1] ?? "";
      const joined = /(^|\s)(of|plus|minus|equals|over|times|negative|,|the|to)$/.test(last) || !last; // nothing to multiply by
      out.push(/[+-]/.test(inner) ? `${joined ? "" : "times "}the quantity ${convert(inner)},` : `${convert(inner)},`);
      i = close + 1;
    } else if (c === ")" || c === "]") {
      i++; // a stray closing bracket
    } else if (/[0-9.]/.test(c)) {
      const m = /^[0-9.]+/.exec(s.slice(i))!; // numbers stay together: "12", not "1 2"
      out.push(m[0]);
      i += m[0].length;
    } else if (c in SYMBOLS) {
      out.push(c === "-" && out.length === 0 ? "negative" : SYMBOLS[c]); // a leading minus is "negative"
      i++;
    } else if (/\s/.test(c)) {
      i++;
    } else {
      out.push(c); // a letter: said on its own ("d x", not "dx")
      i++;
    }
  }
  return out.join(" ");
}

// Turns a LaTeX expression into words a voice can read.
export function latexToWords(latex: string): string {
  return convert(latex)
    .replace(/\s+,/g, ",") // no space before commas
    .replace(/,(\s*,)+/g, ",") // no double pauses
    .replace(/^,\s*|,\s*$/g, "") // no pause at the very start or end
    .replace(/\s+/g, " ")
    .trim();
}

// Turns a sentence that may contain $inline math$ (like the "why" texts) into plain speakable words.
export function speakable(text: string): string {
  return text
    .replace(/\$\$?([^$]+)\$\$?/g, (_, m: string) => latexToWords(m)) // math parts -> words
    .replace(/[*_`#]/g, "") // markdown symbols
    .replace(/\s+/g, " ")
    .trim();
}

// Splits a step's LaTeX at its colored parts (\htmlClass{role-a}{...}), in reading order:
// "u = \htmlClass{role-a}{\ln x}" -> [{ latex: "u = ", role: null }, { latex: "\ln x", role: "a" }].
// Read aloud says each piece separately and lights up that piece on the board.
export function splitParts(latex: string): { latex: string; role: "a" | "b" | "c" | null }[] {
  const out: { latex: string; role: "a" | "b" | "c" | null }[] = [];
  const tag = "\\htmlClass{";
  let i = 0;
  let plain = "";
  while (i < latex.length) {
    if (latex.startsWith(tag, i)) {
      const close = latex.indexOf("}", i + tag.length);
      const cls = latex.slice(i + tag.length, close); // "role-a"
      const [inner, end] = readArg(latex, close + 1); // the colored math itself
      const role = /^role-([abc])$/.exec(cls)?.[1] as "a" | "b" | "c" | undefined;
      if (role) {
        if (plain) out.push({ latex: plain, role: null });
        plain = "";
        out.push({ latex: inner, role });
      } else plain += inner; // some other class (e.g. the error ring): just math
      i = end;
    } else plain += latex[i++];
  }
  if (plain) out.push({ latex: plain, role: null });
  return out;
}

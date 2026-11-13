"use client";

// The microphone for Think-aloud and "Talk it through": the mic button, the space bar, and the mic's state.
// A "hook" is a reusable piece of React logic: a component calls useVoice() and gets back the
// current state plus functions to press/release the mic.
//
// Three ways to talk:
// - hold:       hold the mic (or space), talk, let go.
// - tap:        tap once, talk; it stops by itself when you go quiet (or tap again).
// - hands-free: the mic stays open. Each time you talk and then pause, that clip is sent.
//               Tap the mic (or say "pause") to pause it; tap again to resume.
import { useCallback, useEffect, useRef, useState } from "react";
import { Recorder, micErrorMessage, micSupported, type Clip } from "./recorder";
import { stopSpeaking } from "./speak";

// The mic's states (DESIGN.md section 9), plus "error".
export type VoicePhase = "idle" | "listening" | "writing" | "checking" | "speaking" | "error";

const HOLD_MS = 350; // pressed longer than this = hold-to-talk; shorter = tap to start
const REARM_MS = 350; // hands-free: short gap after the tutor stops talking before the mic opens again
const ERROR_RECOVER_MS = 3500; // hands-free: show an error this long, then listen again

type Options = {
  enabled: boolean; // false = mic off (e.g. while the problem is still loading)
  onClip: (clip: Clip) => void; // called with each finished clip (the caller moves the phase on from "writing")
  handsFree?: boolean; // keep the mic open and send a clip at every pause
};

export function useVoice({ enabled, onClip, handsFree = false }: Options) {
  const [phase, setPhaseState] = useState<VoicePhase>("idle");
  const [level, setLevel] = useState(0); // microphone volume 0-1, for the waveform
  const [error, setError] = useState<string | null>(null); // shown when phase is "error"
  const [waiting, setWaitingState] = useState(false); // hands-free: mic open, nobody talking yet
  const [paused, setPausedState] = useState(false); // hands-free: switched off for now (tap to resume)
  const recorder = useRef<Recorder | null>(null);
  const phaseRef = useRef<VoicePhase>("idle"); // the latest phase, readable inside event listeners
  const pressedAt = useRef(0); // when the current press started
  const how = useRef<"hold" | "tap" | "hands">("hold"); // how the current clip is being recorded
  const pausedRef = useRef(false);
  const waitingRef = useRef(false);
  const handsRef = useRef(handsFree);
  const onClipRef = useRef(onClip); // always call the newest onClip (it changes every render)
  useEffect(() => {
    onClipRef.current = onClip;
    handsRef.current = handsFree;
  });

  // Changes the phase (and keeps the ref in sync).
  const setPhase = useCallback((p: VoicePhase | ((cur: VoicePhase) => VoicePhase)) => {
    const next = typeof p === "function" ? p(phaseRef.current) : p;
    phaseRef.current = next;
    setPhaseState(next);
  }, []);
  const setWaiting = useCallback((w: boolean) => {
    waitingRef.current = w;
    setWaitingState(w);
  }, []);
  const setPaused = useCallback((p: boolean) => {
    pausedRef.current = p;
    setPausedState(p);
  }, []);

  // Shows an error in the mic area (typing is always still available).
  const fail = useCallback((message: string) => {
    setError(message);
    setPhase("error");
  }, [setPhase]);

  // Ends the recording and hands the clip over.
  const finish = useCallback(async () => {
    if (phaseRef.current !== "listening") return;
    const mode = how.current;
    setLevel(0);
    setWaiting(false);
    setPhase("writing"); // "Writing it on the board…"
    const clip = await recorder.current?.stop();
    if (!clip) {
      if (mode === "hands") setPhase("idle"); // hands-free: just a click or a breath, keep listening
      else fail("That was too short. Hold the mic (or space) while you talk, or tap once.");
      return;
    }
    onClipRef.current(clip);
  }, [fail, setPhase, setWaiting]);

  const listenRef = useRef<(mode: "hold" | "tap" | "hands") => void>(() => {}); // lets listen() restart itself
  // Opens the mic and starts recording one clip.
  const listen = useCallback(async (mode: "hold" | "tap" | "hands") => {
    if (!micSupported()) {
      fail("This browser can't record audio. Type instead, or try Chrome, Edge or Safari.");
      return;
    }
    setError(null);
    how.current = mode;
    setWaiting(mode === "hands");
    setPhase("listening");
    try {
      recorder.current ??= new Recorder();
      await recorder.current.start({
        onLevel: setLevel,
        onLimit: () => finish(), // 15 s limit -> stop by itself
        // Went quiet after talking: a tap or hands-free clip is done (a held button waits for the release).
        onSilence: () => {
          if (how.current !== "hold") finish();
        },
        ...(mode === "hands" && {
          onSpeech: () => setWaiting(false),
          onIdle: () => {
            // Nobody spoke for a while: throw the silent recording away and start a fresh one.
            recorder.current?.cancel();
            if (phaseRef.current === "listening" && handsRef.current && !pausedRef.current) listenRef.current("hands");
          },
        }),
      });
    } catch (err) {
      if (mode === "hands") setPaused(true); // don't keep retrying a blocked mic
      fail(micErrorMessage(err));
    }
  }, [fail, finish, setPaused, setPhase, setWaiting]);
  useEffect(() => {
    listenRef.current = listen;
  }, [listen]);

  // Hands-free: stop listening for now.
  const pause = useCallback(() => {
    recorder.current?.cancel();
    setPaused(true);
    setWaiting(false);
    setLevel(0);
    if (phaseRef.current === "listening") setPhase("idle");
  }, [setPaused, setPhase, setWaiting]);

  // The mic button (or space) went down.
  const press = useCallback(async () => {
    if (!enabled) return;
    const cur = phaseRef.current;
    if (cur === "speaking") {
      stopSpeaking(); // "tap to interrupt" (hands-free then listens again)
      setPhase("idle");
      return;
    }
    if (cur === "writing" || cur === "checking") return; // busy: ignore
    if (handsRef.current) {
      // Hands-free: the button pauses and resumes. Mid-sentence, it sends what was said so far.
      if (cur === "listening") {
        if (!waitingRef.current) finish();
        else pause();
      } else {
        setPaused(false);
        listen("hands");
      }
      return;
    }
    if (cur === "listening") {
      if (how.current === "tap") finish(); // second tap: stop now
      return;
    }
    pressedAt.current = performance.now();
    listen("hold"); // becomes "tap" if they let go quickly
  }, [enabled, finish, listen, pause, setPaused, setPhase]);

  // The mic button (or space) came back up.
  const release = useCallback(() => {
    if (phaseRef.current !== "listening" || how.current !== "hold") return;
    if (performance.now() - pressedAt.current < HOLD_MS) how.current = "tap"; // a quick tap: keep listening until they go quiet
    else finish(); // let go after holding: done
  }, [finish]);

  // Hands-free: whenever the mic is free again (the tutor finished, the step was checked), open it.
  useEffect(() => {
    if (!enabled || !handsFree || paused || phase !== "idle") return;
    const timer = setTimeout(() => {
      if (phaseRef.current === "idle" && !pausedRef.current) listen("hands");
    }, REARM_MS);
    return () => clearTimeout(timer);
  }, [enabled, handsFree, paused, phase, listen]);

  // Hands-free: after an error has been shown for a moment, listen again.
  useEffect(() => {
    if (!enabled || !handsFree || paused || phase !== "error") return;
    const timer = setTimeout(() => setPhase((p) => (p === "error" ? "idle" : p)), ERROR_RECOVER_MS);
    return () => clearTimeout(timer);
  }, [enabled, handsFree, paused, phase, setPhase]);

  // Hands-free switched off: close the open mic, and forget any pause (switching it on again starts fresh).
  useEffect(() => {
    if (!handsFree) return;
    return () => {
      setPaused(false);
      if (how.current === "hands" && phaseRef.current === "listening") {
        recorder.current?.cancel();
        setWaiting(false);
        setLevel(0);
        setPhase("idle");
      }
    };
  }, [handsFree, setPaused, setPhase, setWaiting]);

  // Hold space anywhere (except while typing in a box) to talk.
  useEffect(() => {
    if (!enabled) return;
    const typing = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|MATH-FIELD)$/.test(t.tagName));
    const down = (e: KeyboardEvent) => {
      if (e.code !== "Space" || typing(e.target)) return;
      e.preventDefault(); // don't scroll the page or click a focused button
      if (!e.repeat) press();
    };
    const up = (e: KeyboardEvent) => {
      if (e.code !== "Space" || typing(e.target)) return;
      e.preventDefault();
      release();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [enabled, press, release]);

  // Turn the microphone off when voice is switched off or the screen closes.
  useEffect(() => {
    if (enabled) return;
    recorder.current?.dispose();
    recorder.current = null;
    stopSpeaking();
    if (phaseRef.current === "listening" || phaseRef.current === "speaking") setPhase("idle");
  }, [enabled, setPhase]);
  useEffect(() => () => {
    recorder.current?.dispose();
    stopSpeaking();
  }, []);

  return { phase, setPhase, level, error, fail, press, release, waiting, paused, pause };
}

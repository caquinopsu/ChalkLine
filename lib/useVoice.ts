"use client";

// Push-to-talk for Think-aloud: the mic button and the space bar, and the mic's state.
// A "hook" is a reusable piece of React logic: a component calls useVoice() and gets back the
// current state plus functions to press/release the mic.
import { useCallback, useEffect, useRef, useState } from "react";
import { Recorder, micErrorMessage, micSupported, type Clip } from "./recorder";
import { stopSpeaking } from "./speak";

// The mic's states (DESIGN.md section 9), plus "error".
export type VoicePhase = "idle" | "listening" | "writing" | "checking" | "speaking" | "error";

const HOLD_MS = 350; // pressed longer than this = hold-to-talk; shorter = tap to start, tap again to stop

type Options = {
  enabled: boolean; // false = mic off (e.g. while the problem is still loading)
  onClip: (clip: Clip) => void; // called with each finished clip (the caller moves the phase on from "writing")
};

export function useVoice({ enabled, onClip }: Options) {
  const [phase, setPhaseState] = useState<VoicePhase>("idle");
  const [level, setLevel] = useState(0); // microphone volume 0-1, for the waveform
  const [error, setError] = useState<string | null>(null); // shown when phase is "error"
  const recorder = useRef<Recorder | null>(null);
  const phaseRef = useRef<VoicePhase>("idle"); // the latest phase, readable inside event listeners
  const pressedAt = useRef(0); // when the current press started
  const tapMode = useRef(false); // true = recording until the next tap
  const onClipRef = useRef(onClip); // always call the newest onClip (it changes every render)
  useEffect(() => {
    onClipRef.current = onClip;
  });

  // Changes the phase (and keeps the ref in sync).
  const setPhase = useCallback((p: VoicePhase | ((cur: VoicePhase) => VoicePhase)) => {
    const next = typeof p === "function" ? p(phaseRef.current) : p;
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  // Shows an error in the mic area (typing is always still available).
  const fail = useCallback((message: string) => {
    setError(message);
    setPhase("error");
  }, [setPhase]);

  // Ends the recording and hands the clip over.
  const finish = useCallback(async () => {
    if (phaseRef.current !== "listening") return;
    tapMode.current = false;
    setLevel(0);
    setPhase("writing"); // "Writing it on the board…"
    const clip = await recorder.current?.stop();
    if (!clip) {
      fail("That was too short. Hold the mic (or space) while you talk.");
      return;
    }
    onClipRef.current(clip);
  }, [fail, setPhase]);

  // The mic button (or space) went down.
  const press = useCallback(async () => {
    if (!enabled) return;
    const cur = phaseRef.current;
    if (cur === "speaking") {
      stopSpeaking(); // "tap to interrupt"
      setPhase("idle");
      return;
    }
    if (cur === "listening") {
      if (tapMode.current) finish(); // second tap: stop
      return;
    }
    if (cur === "writing" || cur === "checking") return; // busy: ignore
    if (!micSupported()) {
      fail("This browser can't record audio. Type instead, or try Chrome, Edge or Safari.");
      return;
    }
    setError(null);
    pressedAt.current = performance.now();
    tapMode.current = false;
    setPhase("listening");
    try {
      recorder.current ??= new Recorder();
      await recorder.current.start(setLevel, () => finish()); // 15 s limit -> stop by itself
    } catch (err) {
      fail(micErrorMessage(err));
    }
  }, [enabled, fail, finish, setPhase]);

  // The mic button (or space) came back up.
  const release = useCallback(() => {
    if (phaseRef.current !== "listening" || tapMode.current) return;
    if (performance.now() - pressedAt.current < HOLD_MS) tapMode.current = true; // a quick tap: keep listening
    else finish(); // let go after holding: done
  }, [finish]);

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

  return { phase, setPhase, level, error, fail, press, release };
}

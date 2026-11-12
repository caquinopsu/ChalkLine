// Browser helpers for the microphone: record one push-to-talk clip, then send it to /api/speech-to-math.
import type { Heard, SpeechRequest } from "./schemas";

export type Clip = { base64: string; mimeType: string; ms: number }; // one recorded clip, ready to send

export const MAX_CLIP_MS = 15_000; // clips stop by themselves after 15 seconds
const MIN_CLIP_MS = 400; // anything shorter was probably a misclick
const SAMPLE_RATE = 16_000; // 16 kHz mono is plenty for speech, and keeps uploads small

// Can this browser record audio at all?
export function micSupported(): boolean {
  return typeof window !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";
}

// Turns a microphone error into a friendly sentence.
export function micErrorMessage(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "The microphone is blocked. Allow it in your browser's address bar, or type instead.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "I can't find a microphone. Plug one in, or type instead.";
  if (name === "NotReadableError") return "Another app is using the microphone. Close it, or type instead.";
  return "The microphone didn't start. Try again, or type instead.";
}

// Records clips from one microphone stream (kept open between clips so each press starts instantly).
export class Recorder {
  private stream: MediaStream | null = null; // the live microphone
  private ctx: AudioContext | null = null; // used to measure the volume (for the pulsing waveform)
  private analyser: AnalyserNode | null = null;
  private media: MediaRecorder | null = null; // the browser's recorder
  private chunks: Blob[] = []; // pieces of the recording
  private startedAt = 0;
  private frame = 0; // animation-frame id for the level meter
  private autoStop: ReturnType<typeof setTimeout> | null = null;

  // Starts recording. `onLevel` gets the volume (0-1) about 60 times a second; `onLimit` fires at 15 s.
  async start(onLevel: (level: number) => void, onLimit: () => void): Promise<void> {
    if (!this.stream || !this.stream.active) {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } }); // asks permission the first time
      this.ctx = new AudioContext();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.ctx.createMediaStreamSource(this.stream).connect(this.analyser); // mic -> volume meter (not to the speakers)
    }
    await this.ctx?.resume(); // some browsers start it paused
    this.chunks = [];
    this.media = new MediaRecorder(this.stream);
    this.media.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.media.start(250); // hand us a chunk every 250 ms
    this.startedAt = performance.now();
    this.autoStop = setTimeout(onLimit, MAX_CLIP_MS);

    // Volume meter: the loudness of the latest sound samples, for the waveform bars.
    const buf = new Uint8Array(this.analyser!.fftSize);
    const tick = () => {
      this.analyser!.getByteTimeDomainData(buf); // the raw wave, 128 = silence
      let sum = 0;
      for (const v of buf) sum += ((v - 128) / 128) ** 2;
      onLevel(Math.min(1, Math.sqrt(sum / buf.length) * 5)); // root-mean-square volume, scaled up
      this.frame = requestAnimationFrame(tick);
    };
    tick();
  }

  // Stops recording and returns the clip as WAV (or null if it was too short to be real speech).
  async stop(): Promise<Clip | null> {
    const media = this.media;
    this.clearTimers();
    if (!media || media.state === "inactive") return null;
    const ms = performance.now() - this.startedAt;
    await new Promise<void>((resolve) => {
      media.onstop = () => resolve();
      media.stop();
    });
    this.media = null;
    if (ms < MIN_CLIP_MS || this.chunks.length === 0) return null;
    const blob = new Blob(this.chunks, { type: media.mimeType || "audio/webm" });
    try {
      return { base64: await toBase64(await toWav(blob)), mimeType: "audio/wav", ms }; // WAV works with every Gemini model
    } catch {
      return { base64: await toBase64(blob), mimeType: blob.type.split(";")[0], ms }; // couldn't convert: send it as recorded
    }
  }

  // Throws the current recording away (e.g. leaving the screen mid-clip).
  cancel() {
    this.clearTimers();
    if (this.media && this.media.state !== "inactive") {
      this.media.onstop = null;
      this.media.stop();
    }
    this.media = null;
  }

  // Turns the microphone off completely (the red "recording" dot in the browser tab goes away).
  dispose() {
    this.cancel();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }

  private clearTimers() {
    cancelAnimationFrame(this.frame);
    if (this.autoStop) clearTimeout(this.autoStop);
    this.autoStop = null;
  }
}

// Decodes a recording and re-saves it as 16 kHz mono 16-bit WAV.
async function toWav(blob: Blob): Promise<Blob> {
  const decoder = new AudioContext();
  const decoded = await decoder.decodeAudioData(await blob.arrayBuffer()); // any format the browser recorded
  decoder.close().catch(() => {});
  const length = Math.ceil(decoded.duration * SAMPLE_RATE);
  const offline = new OfflineAudioContext(1, length, SAMPLE_RATE); // renders mono at 16 kHz, off-screen
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();
  const samples = (await offline.startRendering()).getChannelData(0); // numbers between -1 and 1

  // A WAV file is a 44-byte header followed by the samples as 16-bit integers.
  const view = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const text = (at: number, s: string) => [...s].forEach((ch, k) => view.setUint8(at + k, ch.charCodeAt(0)));
  text(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  text(8, "WAVE");
  text(12, "fmt ");
  view.setUint32(16, 16, true); // header chunk size
  view.setUint16(20, 1, true); // format: plain PCM
  view.setUint16(22, 1, true); // 1 channel
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, SAMPLE_RATE * 2, true); // bytes per second
  view.setUint16(32, 2, true); // bytes per sample
  view.setUint16(34, 16, true); // bits per sample
  text(36, "data");
  view.setUint32(40, samples.length * 2, true);
  samples.forEach((v, k) => view.setInt16(44 + k * 2, Math.max(-1, Math.min(1, v)) * 0x7fff, true));
  return new Blob([view], { type: "audio/wav" });
}

// Reads a file as base64 text (what we send in the JSON body).
function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? ""); // drop the "data:...;base64," prefix
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Sends a clip to the server and returns what the AI heard.
export async function hear(clip: Clip, context: Omit<SpeechRequest, "audio" | "mimeType">): Promise<Heard> {
  const res = await fetch("/api/speech-to-math", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audio: clip.base64, mimeType: clip.mimeType, ...context }),
  });
  const data = await res.json().catch(() => ({ ok: false, error: "The server didn't answer properly." }));
  if (!data.ok) throw new Error(data.error);
  return data.heard;
}

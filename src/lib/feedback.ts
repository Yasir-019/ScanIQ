import { useSettings } from "./settings";

let beepCtx: AudioContext | null = null;

export function feedbackBeep() {
  const { sound } = useSettings.getState();
  if (!sound) return;
  try {
    beepCtx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const ctx = beepCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    /* ignore */
  }
}

export function feedbackVibrate(pattern: number | number[] = 35) {
  const { vibrate } = useSettings.getState();
  if (!vibrate) return;
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* ignore */
  }
}

export function scanFeedback() {
  feedbackBeep();
  feedbackVibrate(40);
}

// ============================================================================
// Tiny Web Audio SFX — no asset files, synthesized beeps. Off by default
// (respects autoplay rules; only ever fires after a user gesture). Toggle in
// the menu. localStorage-backed.
// ============================================================================

const KEY = 'dugout-gauntlet-sound';
let ctx: AudioContext | null = null;

function ac(): AudioContext | null {
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    return ctx;
  } catch { return null; }
}

export function isSoundOn(): boolean { return localStorage.getItem(KEY) === '1'; }
export function setSoundOn(on: boolean): void { localStorage.setItem(KEY, on ? '1' : '0'); }

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.07): void {
  if (!isSoundOn()) return;
  const c = ac();
  if (!c) return;
  try {
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.connect(g); g.connect(c.destination);
    const t = c.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch { /* ignore */ }
}

export const sfxPick = () => tone(460, 0.07, 'triangle');
export const sfxLock = () => { tone(300, 0.05, 'square', 0.05); setTimeout(() => tone(640, 0.09, 'square', 0.06), 55); };
export const sfxWin = () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'triangle', 0.09), i * 110));
export const sfxLoss = () => [392, 330, 247].forEach((f, i) => setTimeout(() => tone(f, 0.22, 'sawtooth', 0.07), i * 150));

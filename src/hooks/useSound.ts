// Web Audio API synthesized sound effects — zero audio files needed

export type SoundType =
  | 'button_tap'
  | 'draft_pick'
  | 'card_flip'
  | 'homerun'
  | 'strikeout'
  | 'walkoff'
  | 'pack_open'
  | 'series_win';

const STORAGE_KEY = 'dugout-draft-sound';

let audioCtx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (!audioCtx) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Call this on first user gesture (click/touch) to unlock iOS audio
export function resumeAudioContext() {
  getContext();
}

export function isMuted(): boolean {
  return localStorage.getItem(STORAGE_KEY) === 'muted';
}

export function setMuted(muted: boolean) {
  localStorage.setItem(STORAGE_KEY, muted ? 'muted' : 'on');
}

// Helper: create white noise buffer
function createNoise(ctx: AudioContext, duration: number): AudioBufferSourceNode {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  return source;
}

// Helper: quick oscillator
function osc(ctx: AudioContext, type: OscillatorType, freq: number, duration: number, gain: number, startTime: number, endFreq?: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, startTime);
  if (endFreq !== undefined) {
    o.frequency.linearRampToValueAtTime(endFreq, startTime + duration);
  }
  g.gain.setValueAtTime(gain, startTime);
  g.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  o.connect(g);
  g.connect(ctx.destination);
  o.start(startTime);
  o.stop(startTime + duration);
}

function playButtonTap(ctx: AudioContext) {
  const t = ctx.currentTime;
  osc(ctx, 'square', 800, 0.05, 0.08, t);
}

function playDraftPick(ctx: AudioContext) {
  const t = ctx.currentTime;
  // Whoosh sweep
  osc(ctx, 'sawtooth', 300, 0.08, 0.12, t, 600);
  // Click
  osc(ctx, 'sine', 1200, 0.015, 0.15, t + 0.02);
}

function playCardFlip(ctx: AudioContext) {
  const t = ctx.currentTime;
  osc(ctx, 'sine', 1000, 0.025, 0.06, t);
}

function playHomerun(ctx: AudioContext) {
  const t = ctx.currentTime;
  // Ascending tone
  osc(ctx, 'sine', 400, 0.4, 0.15, t, 800);
  // Crowd noise burst
  const noise = createNoise(ctx, 0.5);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  bp.Q.value = 0.5;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.01, t);
  g.gain.linearRampToValueAtTime(0.18, t + 0.15);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
  noise.connect(bp);
  bp.connect(g);
  g.connect(ctx.destination);
  noise.start(t);
  noise.stop(t + 0.5);
  // Accent note
  osc(ctx, 'triangle', 523, 0.2, 0.1, t + 0.1); // C5
}

function playStrikeout(ctx: AudioContext) {
  const t = ctx.currentTime;
  osc(ctx, 'sawtooth', 600, 0.2, 0.12, t, 200);
}

function playWalkoff(ctx: AudioContext) {
  const t = ctx.currentTime;
  // Ascending chord: C4 E4 G4
  osc(ctx, 'sine', 262, 0.6, 0.1, t);
  osc(ctx, 'sine', 330, 0.5, 0.1, t + 0.05);
  osc(ctx, 'sine', 392, 0.4, 0.1, t + 0.1);
  osc(ctx, 'triangle', 523, 0.3, 0.12, t + 0.2); // C5
  // Crowd swell
  const noise = createNoise(ctx, 0.8);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2000;
  bp.Q.value = 0.3;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.01, t);
  g.gain.linearRampToValueAtTime(0.2, t + 0.3);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.8);
  noise.connect(bp);
  bp.connect(g);
  g.connect(ctx.destination);
  noise.start(t);
  noise.stop(t + 0.8);
}

function playPackOpen(ctx: AudioContext) {
  const t = ctx.currentTime;
  const noise = createNoise(ctx, 0.15);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 2500;
  bp.Q.value = 1;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.2, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  noise.connect(bp);
  bp.connect(g);
  g.connect(ctx.destination);
  noise.start(t);
  noise.stop(t + 0.15);
}

function playSeriesWin(ctx: AudioContext) {
  const t = ctx.currentTime;
  // Major arpeggio: C4 E4 G4 C5
  const notes = [262, 330, 392, 523];
  notes.forEach((freq, i) => {
    osc(ctx, 'triangle', freq, 0.3, 0.12, t + i * 0.12);
  });
  // Final sustained chord
  osc(ctx, 'sine', 523, 0.5, 0.08, t + 0.5);
  osc(ctx, 'sine', 659, 0.5, 0.08, t + 0.5);
  osc(ctx, 'sine', 784, 0.5, 0.08, t + 0.5);
}

export function playSound(type: SoundType) {
  if (isMuted()) return;
  const ctx = getContext();
  if (!ctx) return;

  switch (type) {
    case 'button_tap': playButtonTap(ctx); break;
    case 'draft_pick': playDraftPick(ctx); break;
    case 'card_flip': playCardFlip(ctx); break;
    case 'homerun': playHomerun(ctx); break;
    case 'strikeout': playStrikeout(ctx); break;
    case 'walkoff': playWalkoff(ctx); break;
    case 'pack_open': playPackOpen(ctx); break;
    case 'series_win': playSeriesWin(ctx); break;
  }
}

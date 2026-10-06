// Every sound in the game is made here, in the browser, from a few oscillators and bursts of noise: nothing is downloaded.
export type SfxName = 'throw' | 'hit' | 'miss' | 'swallow' | 'breach' | 'pick' | 'levelUp' | 'button' | 'pause' | 'waveStart' | 'charge' | 'recap';

// One oscillator gliding from f0 to f1 over `dur` seconds while it fades out, starting `at` seconds from now.
export const tone = (ctx: AudioContext, out: AudioNode, type: OscillatorType, f0: number, f1: number, dur: number, gain = 0.25, at = 0): void => {
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
};

// A burst of white noise that dies away over `dur` seconds, starting `at` seconds from now.
export const noise = (ctx: AudioContext, out: AudioNode, dur: number, gain = 0.2, at = 0): void => {
  const t = ctx.currentTime + at, n = Math.ceil(ctx.sampleRate * dur) || 2205, buf = ctx.createBuffer(1, n, ctx.sampleRate || 44100), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ctx.createBufferSource(), g = ctx.createGain();
  s.buffer = buf; g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(g).connect(out); s.start(t);
};

export const createSynth = (ctx: AudioContext, out: GainNode) => ({
  play(name: SfxName): void {
    switch (name) {
      case 'throw': tone(ctx, out, 'triangle', 900, 300, 0.12, 0.2); noise(ctx, out, 0.08, 0.08); break;
      case 'hit': noise(ctx, out, 0.18, 0.3); tone(ctx, out, 'square', 220, 60, 0.18, 0.2); break;
      case 'miss': tone(ctx, out, 'sine', 300, 120, 0.2, 0.12); break;
      case 'swallow': noise(ctx, out, 0.35, 0.12); tone(ctx, out, 'sawtooth', 140, 40, 0.35, 0.1); break;
      case 'breach': tone(ctx, out, 'square', 110, 55, 0.5, 0.3); noise(ctx, out, 0.4, 0.25, 0.05); break;
      case 'pick': tone(ctx, out, 'square', 523, 659, 0.08, 0.15); tone(ctx, out, 'square', 784, 1046, 0.12, 0.15, 0.08); break;
      case 'levelUp': [523, 659, 784, 1046].forEach((f, i) => tone(ctx, out, 'square', f, f, 0.1, 0.15, i * 0.07)); break;
      case 'button': tone(ctx, out, 'square', 660, 660, 0.05, 0.1); break;
      case 'pause': tone(ctx, out, 'triangle', 440, 220, 0.15, 0.12); break;
      case 'waveStart': [392, 523, 659].forEach((f, i) => tone(ctx, out, 'triangle', f, f, 0.14, 0.18, i * 0.1)); break;
      case 'charge': noise(ctx, out, 0.5, 0.15); [0, 0.12, 0.24, 0.36].forEach((at) => tone(ctx, out, 'square', 160, 90, 0.1, 0.18, at)); break;
      case 'recap': tone(ctx, out, 'sine', 330, 330, 0.25, 0.12); tone(ctx, out, 'sine', 415, 415, 0.3, 0.1, 0.12); break;
    }
  },
});

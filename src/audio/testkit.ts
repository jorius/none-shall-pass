// packages
import { vi } from 'vitest';

// A fake AudioContext that remembers what it was asked to play, for the tests of the synth, the loop and the view:
// every oscillator as `type:first frequency` and every noise burst as `noise` (with the time it starts), the ramps of every gain,
// the gains in the order they were made, and a clock the test moves. Nothing is rendered.
export const studio = (state: string = 'suspended') => {
  const voices: { id: string; at: number }[] = [], ramps: number[] = [], clock = { now: 0 };
  const node = () => ({
    connect: vi.fn().mockReturnThis(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), type: 'square', buffer: null,
    frequency: { value: 440, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn((v: number) => ramps.push(v)) },
  });
  const gains: ReturnType<typeof node>[] = [];
  const oscillator = () => {
    const o = node();
    o.frequency.setValueAtTime = vi.fn((f: number, at: number) => voices.push({ id: `${o.type}:${f}`, at }));
    return o;
  };
  const source = () => {
    const s = node();
    s.start = vi.fn((at: number) => voices.push({ id: 'noise', at }));
    return s;
  };
  const gain = () => { const g = node(); gains.push(g); return g; };
  const resume = vi.fn().mockResolvedValue(undefined);
  const ctx = {
    get currentTime() { return clock.now; }, state, destination: {}, resume,
    createOscillator: oscillator, createBufferSource: source, createGain: gain,
    createBuffer: () => ({ getChannelData: () => new Float32Array(2205) }),
  };

  // The ids heard since the last call, in the order they were scheduled.
  const heard = (): string[] => voices.splice(0).map((v) => v.id);
  return { ctx: ctx as unknown as AudioContext, clock, voices, ramps, gains, resume, heard };
};

// Moves the fake clock on in 0.1 s ticks and lets the loop's 100 ms timer fire after each, as a page does.
export const play = (clock: { now: number }, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds * 10); i++) { clock.now += 0.1; vi.advanceTimersByTime(100); }
};

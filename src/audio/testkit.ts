// packages
import { vi } from 'vitest';

interface FakeCompressor {
  connect: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn>;
  threshold: { value: number }; knee: { value: number }; ratio: { value: number }; attack: { value: number }; release: { value: number };
}

// A fake AudioContext that remembers what it was asked to play, for the tests of the synth, the loop and the view:
// every oscillator as `type:first frequency` and every noise burst as `noise` (with the time it starts), the ramps of every gain,
// the gains in the order they were made, the limiters it was asked for, and a clock the test moves. Nothing is rendered.
// `connect` returns what it was given, as the real one does, so what a node feeds can be followed with `reaches`; the context has
// no `createDynamicsCompressor` unless the test asks for a limiter, as an older browser has none.
export const studio = (state: string = 'suspended', opts: { limiter?: boolean } = {}) => {
  const voices: { id: string; at: number; node: unknown }[] = [], ramps: number[] = [], clock = { now: 0 };
  const node = () => ({
    connect: vi.fn((to) => to), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), type: 'square', buffer: null,
    frequency: { value: 440, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
    gain: { value: 1, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn((v: number) => ramps.push(v)) },
  });
  const gains: ReturnType<typeof node>[] = [];
  const oscillator = () => {
    const o = node();
    o.frequency.setValueAtTime = vi.fn((f: number, at: number) => voices.push({ id: `${o.type}:${f}`, at, node: o }));
    return o;
  };
  const source = () => {
    const s = node();
    s.start = vi.fn((at: number) => voices.push({ id: 'noise', at, node: s }));
    return s;
  };
  const gain = () => { const g = node(); gains.push(g); return g; };
  // Every setting starts at 0, so a test sees which ones the code sets.
  const compressors: FakeCompressor[] = [];
  const compressor = (): FakeCompressor => {
    const c = { connect: vi.fn((to) => to), disconnect: vi.fn(), threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 } };
    compressors.push(c);
    return c;
  };
  const resume = vi.fn().mockResolvedValue(undefined), suspend = vi.fn().mockResolvedValue(undefined);
  const ctx = {
    get currentTime() { return clock.now; }, state, destination: {}, resume, suspend,
    createOscillator: oscillator, createBufferSource: source, createGain: gain,
    createBuffer: () => ({ getChannelData: () => new Float32Array(2205) }),
    ...(opts.limiter ? { createDynamicsCompressor: compressor } : {}),
  };

  // Whether `from` feeds `to`, directly or through the nodes between, by the `connect` calls it was given.
  const reaches = (from: unknown, to: unknown, seen = new Set<unknown>()): boolean => {
    if (from === to) return true;
    const via = from as { connect?: { mock: { calls: unknown[][] } } };
    if (seen.has(from) || !via.connect) return false;
    seen.add(from);
    return via.connect.mock.calls.some(([next]) => reaches(next, to, seen));
  };

  // The ids heard since the last call, in the order they were scheduled. Each voice must reach the destination (or `target`):
  // a voice wired to nothing is an error here, not a sound the test counts.
  const heard = (target: unknown = ctx.destination): string[] => {
    const spent = voices.splice(0), lost = spent.filter((v) => !reaches(v.node, target));
    if (lost.length) throw new Error(`voices that reach no output: ${lost.map((v) => v.id).join(', ')}`);
    return spent.map((v) => v.id);
  };
  // The envelope gain a voice feeds: the first node it was connected to.
  const envelopeOf = (voice: unknown): { gain: { value: number } } => (voice as { connect: { mock: { calls: unknown[][] } } }).connect.mock.calls[0][0] as { gain: { value: number } };
  return { ctx: ctx as unknown as AudioContext, clock, voices, ramps, gains, compressors, resume, suspend, heard, reaches, envelopeOf };
};

// Moves the fake clock on in 0.1 s ticks and lets the loop's 100 ms timer fire after each, as a page does.
export const play = (clock: { now: number }, seconds: number): void => {
  for (let i = 0; i < Math.round(seconds * 10); i++) { clock.now += 0.1; vi.advanceTimersByTime(100); }
};

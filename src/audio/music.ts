// local
import { noise, tone } from './synth';

// The loop: one bar of 16 sixteenth notes at 120 BPM (a step is 0.125 s, the bar two seconds) in A minor. A 0 is a rest.
export const PATTERN = {
  bass: [110, 0, 110, 0, 131, 0, 110, 0, 98, 0, 98, 0, 131, 0, 147, 0],
  lead: [440, 0, 523, 440, 0, 659, 0, 587, 523, 0, 440, 0, 392, 0, 440, 0],
  hat: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1],
};

const STEP = 0.125;
// The sequencer queues a bar ahead of the audio clock, on a timer that only has to wake up now and then.
const AHEAD = 2;
const TICK = 100;

export const createMusic = (ctx: AudioContext, out: GainNode) => {
  // Its own level, for ducking under the menus; every note of a run goes through a bus of that run, so stopping can cut
  // the bar that was already queued instead of letting it play out over the next start.
  const level = ctx.createGain();
  level.connect(out);
  let bus: GainNode | null = null, timer: ReturnType<typeof setInterval> | null = null, step = 0, next = 0;

  const pump = (): void => {
    if (!bus) return;
    const now = ctx.currentTime;
    // A tab that slept past its notes plays on from the clock, not every note it missed at once.
    if (next < now) next = now + 0.05;
    while (next < now + AHEAD) {
      const at = next - now, b = PATTERN.bass[step], l = PATTERN.lead[step];
      if (b) tone(ctx, bus, 'square', b, b, 0.11, 0.08, at);
      if (l) tone(ctx, bus, 'triangle', l, l, 0.1, 0.07, at);
      if (PATTERN.hat[step]) noise(ctx, bus, 0.03, 0.03, at);
      next += STEP;
      step = (step + 1) % PATTERN.bass.length;
    }
  };

  return {
    get running(): boolean { return timer !== null; },
    // From the top of the bar, every time.
    start(): void {
      if (timer !== null) return;
      step = 0;
      next = ctx.currentTime + 0.05;
      bus = ctx.createGain();
      bus.connect(level);
      pump();
      timer = setInterval(pump, TICK);
    },
    stop(): void {
      if (timer !== null) clearInterval(timer);
      timer = null;
      bus?.disconnect();
      bus = null;
    },
    // 0 to 1, a short glide so a duck does not click.
    setLevel(l: number): void {
      const t = ctx.currentTime;
      level.gain.setValueAtTime(level.gain.value, t);
      level.gain.linearRampToValueAtTime(l, t + 0.08);
    },
  };
};

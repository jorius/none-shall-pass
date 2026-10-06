// packages
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// core
import type { RunEvent } from '../core/events';
import { Run } from '../core/run';
import { cfg, freshState, place } from '../core/testkit';

// local
import { createMusic, PATTERN } from './music';
import { createSynth } from './synth';
import { AudioView, type AudioPrefs } from './index';
import { play, studio } from './testkit';

const fakeCtx = () => {
  const started: string[] = [];
  const node = () => ({ connect: vi.fn((to) => to), disconnect: vi.fn(), start: vi.fn((t) => started.push(String(t))), stop: vi.fn(), frequency: { value: 440, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, type: 'square', buffer: null });
  const ctx = { currentTime: 0, state: 'suspended', destination: {}, createOscillator: node, createGain: node, createBufferSource: node, createBuffer: () => ({ getChannelData: () => new Float32Array(2205) }), resume: vi.fn().mockResolvedValue(undefined) };
  return { ctx: ctx as unknown as AudioContext, started };
};

// What each effect is made of, as `type:first frequency` per oscillator and `noise` per burst, in the order the synth schedules them.
const SOUND = {
  throw: ['triangle:900', 'noise'], hit: ['noise', 'square:220'], miss: ['sine:300'], swallow: ['noise', 'sawtooth:140'], breach: ['square:110', 'noise'],
  pick: ['square:523', 'square:784'], levelUp: ['square:523', 'square:659', 'square:784', 'square:1046'], button: ['square:660'], pause: ['triangle:440'],
  waveStart: ['triangle:392', 'triangle:523', 'triangle:659'], charge: ['noise', 'square:160', 'square:160', 'square:160', 'square:160'], recap: ['sine:330', 'sine:415'],
} as const;

const ON: AudioPrefs = { sound: true, music: true, volume: 2 };

// One bar of the loop is every note and hat of the pattern, and its first step plays whichever of the three is not a rest.
const lit = (steps: readonly number[]): number => steps.filter(Boolean).length;
const BAR = lit(PATTERN.bass) + lit(PATTERN.lead) + lit(PATTERN.hat);
const STEP_ZERO = [PATTERN.bass[0] && `square:${PATTERN.bass[0]}`, PATTERN.lead[0] && `triangle:${PATTERN.lead[0]}`, PATTERN.hat[0] && 'noise'].filter(Boolean).sort();

// The loops here start timers: fake ones, so none outlives its test.
beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('audio', () => {
  it('plays every effect without throwing and schedules at least one voice each', () => {
    const { ctx, started } = fakeCtx();
    const s = createSynth(ctx, ctx.createGain());
    for (const n of ['throw', 'hit', 'miss', 'swallow', 'breach', 'pick', 'levelUp', 'button', 'pause', 'waveStart', 'charge', 'recap'] as const) {
      const before = started.length;
      s.play(n);
      expect(started.length).toBeGreaterThan(before);
    }
  });

  it('routes every voice of every effect to the output it was given, not just somewhere', () => {
    const { ctx, voices, reaches } = studio();
    const out = ctx.createGain();
    const s = createSynth(ctx, out);
    const names = ['throw', 'hit', 'miss', 'swallow', 'breach', 'pick', 'levelUp', 'button', 'pause', 'waveStart', 'charge', 'recap'] as const;
    for (const n of names) s.play(n);
    expect(voices.length).toBeGreaterThan(names.length);
    for (const v of voices) expect(reaches(v.node, out), v.id).toBe(true);
    // A voice wired to a gain that goes nowhere would not pass.
    expect(reaches(voices[0].node, ctx.createGain())).toBe(false);
  });

  it('starts every envelope at its own level, so the first sample of a burst does not get through at full gain as a click', () => {
    const { ctx, voices, envelopeOf } = studio();
    const s = createSynth(ctx, ctx.createGain());
    for (const n of ['throw', 'hit', 'miss', 'swallow', 'breach', 'pick', 'levelUp', 'button', 'pause', 'waveStart', 'charge', 'recap'] as const) s.play(n);
    // A fresh gain is at 1 until the first scheduled value takes over, and a noise burst's first sample is full scale: it is the level
    // each effect asks for (0.3 at the most) from the start.
    for (const v of voices) expect(envelopeOf(v.node).gain.value, v.id).toBeLessThanOrEqual(0.3);
  });

  it('loops a 16-step pattern of bass, lead and hat within the chiptune range', () => {
    expect(PATTERN.bass.length).toBe(16); expect(PATTERN.lead.length).toBe(16); expect(PATTERN.hat.length).toBe(16);
    for (const n of [...PATTERN.bass, ...PATTERN.lead]) if (n) { expect(n).toBeGreaterThan(50); expect(n).toBeLessThan(2000); }
    const { ctx, started } = fakeCtx();
    const m = createMusic(ctx, ctx.createGain());
    m.start(); expect(m.running).toBe(true); expect(started.length).toBeGreaterThan(0);
    m.stop(); expect(m.running).toBe(false);
  });

  it('is silent and safe without an AudioContext, and never starts before a gesture', () => {
    const view = new AudioView(() => null, { sound: true, music: true, volume: 2 });
    expect(() => { view.start(); view.event({ type: 'waveStarted', wave: 1 }); view.screen('playing'); view.toggleMute(); }).not.toThrow();
    const { ctx } = fakeCtx();
    const v2 = new AudioView(() => ctx, { sound: true, music: true, volume: 2 });
    v2.screen('title');
    expect(v2.unlocked).toBe(false);
    v2.unlock();
    expect(v2.unlocked).toBe(true);
  });

  it('survives a resume that rejects', async () => {
    const { ctx } = fakeCtx();
    (ctx.resume as unknown as { mockRejectedValue(v: unknown): void }).mockRejectedValue(new Error('blocked'));
    const v = new AudioView(() => ctx, { sound: true, music: true, volume: 2 });
    v.unlock();
    await Promise.resolve();
    expect(() => v.event({ type: 'thrown', packetId: 1, by: 'knight', from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, duration: 0.2 })).not.toThrow();
  });
});

describe('the loop', () => {
  const atStart = (voices: { id: string; at: number }[], at: number): string[] => voices.filter((v) => Math.abs(v.at - at) < 1e-6).map((v) => v.id).sort();
  // The gains made, the first being the output the test gave the loop and the second the loop's own level: every bus (one per start)
  // is a gain connected to that level.
  const busesOf = (gains: ReturnType<typeof studio>['gains']) => gains.filter((g) => g.connect.mock.calls.some(([to]) => to === gains[1]));

  it('schedules the first bar at once, a little ahead of the clock, and no more than that', () => {
    const { ctx, voices } = studio();
    const m = createMusic(ctx, ctx.createGain());
    m.start();
    expect(voices).toHaveLength(BAR);
    expect(atStart(voices, 0.05)).toEqual(STEP_ZERO);
    expect(Math.max(...voices.map((v) => v.at))).toBeLessThan(2);
    m.stop();
  });

  it('sends every note and hat through the bar\'s bus and the loop\'s level to the output', () => {
    const { ctx, voices, gains, reaches } = studio();
    const out = ctx.createGain();
    const m = createMusic(ctx, out);
    m.start();
    expect(voices).toHaveLength(BAR);
    for (const v of voices) expect(reaches(v.node, out), v.id).toBe(true);
    const [bus] = busesOf(gains);
    expect(reaches(bus, out)).toBe(true);
    m.stop();
  });

  it('starts the loop\'s envelopes at their own level too, hats included', () => {
    const { ctx, voices, envelopeOf } = studio();
    const m = createMusic(ctx, ctx.createGain());
    m.start();
    expect(voices).toHaveLength(BAR);
    for (const v of voices) expect(envelopeOf(v.node).gain.value, v.id).toBeLessThanOrEqual(0.08);
    m.stop();
  });

  it('keeps one bar ahead on its timer and comes round to the top of the pattern again', () => {
    const { ctx, clock, voices } = studio();
    const m = createMusic(ctx, ctx.createGain());
    m.start();
    voices.length = 0;
    play(clock, 2);
    // Two seconds on, the second bar has been queued whole, from its first step at 2.05 to its last before 4.
    expect(voices).toHaveLength(BAR);
    expect(atStart(voices, 2.05)).toEqual(STEP_ZERO);
    expect(Math.max(...voices.map((v) => v.at))).toBeLessThan(clock.now + 2);
    m.stop();
  });

  it('does not stack a second loop when it is started while it runs', () => {
    const { ctx, voices } = studio();
    const m = createMusic(ctx, ctx.createGain());
    m.start();
    m.start();
    expect(voices).toHaveLength(BAR);
    expect(vi.getTimerCount()).toBe(1);
    m.stop();
  });

  it('stops for good: no timer, nothing more scheduled, and the bar already queued is cut off the output', () => {
    const { ctx, clock, voices, gains } = studio();
    const m = createMusic(ctx, ctx.createGain());
    m.start();
    m.stop();
    expect([m.running, vi.getTimerCount()]).toEqual([false, 0]);
    const queued = voices.length;
    play(clock, 3);
    expect(voices).toHaveLength(queued);
    const [bus] = busesOf(gains);
    expect(bus.disconnect).toHaveBeenCalledTimes(1);
  });

  it('starts again from the top of the pattern, on a bus of its own', () => {
    const { ctx, clock, voices, gains } = studio();
    const m = createMusic(ctx, ctx.createGain());
    m.start();
    play(clock, 0.6);
    m.stop();
    voices.length = 0;
    clock.now = 5;
    m.start();
    expect(atStart(voices, 5.05)).toEqual(STEP_ZERO);
    expect(voices).toHaveLength(BAR);
    const [first, second] = busesOf(gains);
    expect([busesOf(gains).length, first.disconnect.mock.calls.length, second.disconnect.mock.calls.length]).toEqual([2, 1, 0]);
    m.stop();
  });

  it('plays on from the clock after a stall, not every step it missed at once', () => {
    const { ctx, clock, voices } = studio();
    const m = createMusic(ctx, ctx.createGain());
    m.start();
    voices.length = 0;
    clock.now = 30;
    vi.advanceTimersByTime(100);
    expect(voices.length).toBeGreaterThan(0);
    expect(voices.length).toBeLessThanOrEqual(BAR);
    expect(Math.min(...voices.map((v) => v.at))).toBeGreaterThanOrEqual(30);
    m.stop();
  });

  it('ducks and restores on its own level, leaving the output alone', () => {
    const { ctx, ramps, gains } = studio();
    const out = ctx.createGain();
    const m = createMusic(ctx, out);
    m.setLevel(0.4);
    m.setLevel(1);
    expect(ramps).toEqual([0.4, 1]);
    expect(gains[0].gain.value).toBe(1);
    expect(gains[0].gain.linearRampToValueAtTime).not.toHaveBeenCalled();
  });
});

describe('AudioView', () => {
  const thrown: RunEvent = { type: 'thrown', packetId: 1, by: 'knight', from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, duration: 0.2 };
  // A view with the loop off, so what is heard is the effects alone.
  const effects = (prefs: Partial<AudioPrefs> = {}) => {
    const kit = studio();
    const view = new AudioView(() => kit.ctx, { ...ON, music: false, ...prefs });
    view.unlock();
    return { ...kit, view };
  };

  it('builds no context and plays nothing before the first gesture, and builds it once after', () => {
    const { ctx, voices } = studio();
    const make = vi.fn(() => ctx);
    const view = new AudioView(make, ON);
    view.screen('playing');
    view.event(thrown);
    view.toggleMute();
    view.toggleMute();
    expect([make.mock.calls.length, voices.length, view.looping]).toEqual([0, 0, false]);
    view.unlock();
    view.unlock();
    expect([make.mock.calls.length, view.unlocked, view.looping]).toEqual([1, true, true]);
  });

  it('plays an effect for a throw, a hit, a miss, a swallow, a breach, a pick, a new wave and a charge', () => {
    const { view, heard } = effects();
    const packet = place(freshState(), 'scan-telnet', 300);
    const hear = (ev: RunEvent): string[] => { view.event(ev); return heard(); };
    expect(hear(thrown)).toEqual(SOUND.throw);
    expect(hear({ type: 'thrown', packetId: 2, by: 'squire', from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, duration: 0.2 })).toEqual(SOUND.throw);
    for (const by of ['knight', 'squire', 'rule', 'charge'] as const) expect(hear({ type: 'shattered', packet, by }), by).toEqual(SOUND.hit);
    expect(hear({ type: 'missed', packetId: 1 })).toEqual(SOUND.miss);
    expect(hear({ type: 'consumed', packetId: 1 })).toEqual(SOUND.swallow);
    expect(hear({ type: 'resolved', packet, outcome: 'breach', damage: 10 })).toEqual(SOUND.breach);
    expect(hear({ type: 'owned', owned: ['lockdown', 'squire'] })).toEqual(SOUND.pick);
    expect(hear({ type: 'waveStarted', wave: 2 })).toEqual(SOUND.waveStart);
    expect(hear({ type: 'chargeStarted', lane: 2 })).toEqual(SOUND.charge);
  });

  it('keeps quiet for the packets that were let through, and for everything the field says without a sound of its own', () => {
    const { view, heard } = effects();
    const packet = place(freshState(), 'legit-socks', 300);
    const quiet: RunEvent[] = [
      { type: 'spawned', packet }, { type: 'laneChanged', lane: 1 }, { type: 'targeted', packetId: 1 }, { type: 'chargeEnded' }, { type: 'entered', packetId: 1 },
      { type: 'resolved', packet, outcome: 'served', damage: 0 }, { type: 'resolved', packet, outcome: 'neutralized', damage: 0 },
      { type: 'float', at: 'rack', x: 0, y: 0, kind: 'points', value: 1 }, { type: 'say', line: 'waveStart', wave: 1 }, { type: 'uptime', before: 100, after: 90 },
      { type: 'reputation', value: 9 }, { type: 'banned', ip: '192.0.2.1', count: 2 }, { type: 'waveCleared', wave: 1 },
      { type: 'draftOpened', draft: { picks: [], free: true, taken: [] } }, { type: 'draftChanged', draft: { picks: [], free: true, taken: [] } }, { type: 'runEnded', reason: 'serverDown' },
    ];
    for (const ev of quiet) view.event(ev);
    expect(heard()).toEqual([]);
  });

  it('plays the level-up fanfare instead of the pick when Destrier or Observability rises a level, not for other cards, and starts over with each run', () => {
    const { view, heard } = effects();
    const hear = (owned: ('lockdown' | 'squire' | 'destrier' | 'destrier2' | 'obs1' | 'obs2' | 'cdn')[]): string[] => { view.event({ type: 'owned', owned }); return heard(); };
    view.start(new Run(cfg()));
    // Both start a 523 Hz square on the same instant, so together they would only double in phase: one or the other.
    const PICK = [...SOUND.pick], UP = [...SOUND.levelUp];
    expect(hear(['lockdown', 'squire'])).toEqual(PICK);
    expect(hear(['lockdown', 'squire', 'cdn'])).toEqual(PICK);
    expect(hear(['lockdown', 'squire', 'cdn', 'destrier'])).toEqual(UP);
    expect(hear(['lockdown', 'squire', 'cdn', 'destrier', 'destrier2'])).toEqual(UP);
    expect(hear(['lockdown', 'squire', 'cdn', 'destrier', 'destrier2', 'obs1'])).toEqual(UP);
    expect(hear(['lockdown', 'squire', 'cdn', 'destrier', 'destrier2', 'obs1', 'obs2'])).toEqual(UP);
    // A new run has bought nothing yet: its first Destrier is a rise again.
    view.start(new Run(cfg()));
    expect(hear(['lockdown', 'destrier'])).toEqual(UP);
  });

  it('plays the effects only while SOUND is on', () => {
    const { view, heard } = effects({ sound: false });
    view.event(thrown);
    view.screen('paused');
    view.screen('recap');
    expect(heard()).toEqual([]);
    view.set({ sound: true });
    view.event(thrown);
    expect(heard()).toEqual(SOUND.throw);
  });

  it('ticks and chimes for the pause and the recap', () => {
    const { view, heard } = effects();
    view.screen('paused');
    expect(heard()).toEqual(SOUND.pause);
    view.screen('recap');
    expect(heard()).toEqual(SOUND.recap);
    for (const s of ['title', 'setup', 'playing', 'draft', 'armory', 'console', 'debrief'] as const) view.screen(s);
    expect(heard()).toEqual([]);
  });

  it('sets the master volume from the VOLUME step and the effect and music levels from their switches', () => {
    const { view, gains } = effects({ music: true, volume: 1 });
    // The graph's first three gains, in the order it makes them: master, effects, music.
    const [master, fx, music] = gains;
    const levels = (): number[] => [master.gain.value, fx.gain.value, music.gain.value];
    expect(levels()).toEqual([0.35, 1, 0.5]);
    view.set({ volume: 2 });
    expect(levels()).toEqual([0.65, 1, 0.5]);
    view.set({ volume: 3, sound: false });
    expect(levels()).toEqual([1, 0, 0.5]);
    view.set({ music: false });
    expect(levels()).toEqual([1, 0, 0]);
  });

  it('mutes both when either is on, reporting each change, and hands out a copy of its settings', () => {
    const seen: AudioPrefs[] = [];
    const view = new AudioView(() => null, { sound: true, music: false, volume: 3 }, (p) => seen.push(p));
    view.toggleMute();
    expect(view.settings).toEqual({ sound: false, music: false, volume: 3 });
    view.toggleMute();
    expect(view.settings).toEqual({ sound: true, music: false, volume: 3 });
    expect(seen).toEqual([{ sound: false, music: false, volume: 3 }, { sound: true, music: false, volume: 3 }]);
    // What it hands out is a copy.
    view.settings.volume = 1;
    expect(view.settings.volume).toBe(3);
  });

  it('gives back the pair M took away, whatever it was, and turns both on when nothing was on to take', () => {
    const seen: AudioPrefs[] = [];
    const view = new AudioView(() => null, { sound: true, music: false, volume: 3 }, (p) => seen.push(p));
    const pair = (): [boolean, boolean] => [view.settings.sound, view.settings.music];
    // SOUND on and MUSIC off: M, M and it is SOUND on and MUSIC off again, not both on.
    view.toggleMute();
    expect(pair()).toEqual([false, false]);
    view.toggleMute();
    expect(pair()).toEqual([true, false]);
    view.toggleMute();
    view.toggleMute();
    expect(pair()).toEqual([true, false]);
    expect(seen.map((p) => [p.sound, p.music])).toEqual([[false, false], [true, false], [false, false], [true, false]]);
    // MUSIC alone.
    view.set({ sound: false, music: true });
    view.toggleMute();
    view.toggleMute();
    expect(pair()).toEqual([false, true]);
    // Both on.
    view.set({ sound: true, music: true });
    view.toggleMute();
    expect(pair()).toEqual([false, false]);
    view.toggleMute();
    expect(pair()).toEqual([true, true]);
    // Switches moved by hand while it was muted: what was on at the last M is what comes back.
    view.toggleMute();
    view.set({ sound: true });
    view.toggleMute();
    expect(pair()).toEqual([false, false]);
    view.toggleMute();
    expect(pair()).toEqual([true, false]);
    // Once it has given them back it has nothing to give: both switched off by hand, M turns both on, not the pair of a while ago.
    view.set({ sound: false, music: false });
    view.toggleMute();
    expect(pair()).toEqual([true, true]);
    // Nothing on and nothing taken (a session saved muted, or both switched off by hand): M turns both on.
    const saved = new AudioView(() => null, { sound: false, music: false });
    saved.toggleMute();
    expect([saved.settings.sound, saved.settings.music]).toEqual([true, true]);
    const hand = new AudioView(() => null, ON);
    hand.set({ sound: false, music: false });
    hand.toggleMute();
    expect([hand.settings.sound, hand.settings.music]).toEqual([true, true]);
  });

  it('starts from sound on, music on and volume 2 for whatever the save leaves out', () => {
    expect(new AudioView(() => null, {}).settings).toEqual(ON);
    expect(new AudioView(() => null, { music: false }).settings).toEqual({ sound: true, music: false, volume: 2 });
  });

  it('plays the loop on every screen but the debrief, ducks it under the pause, the Armory and the console, and starts it over after the debrief', () => {
    const { ctx, voices, ramps } = studio();
    const view = new AudioView(() => ctx, ON);
    view.screen('title');
    expect(view.looping).toBe(false);
    view.unlock();
    expect(view.looping).toBe(true);
    for (const s of ['setup', 'playing', 'recap', 'draft', 'title'] as const) { view.screen(s); expect(view.looping, s).toBe(true); }
    ramps.length = 0;
    for (const s of ['paused', 'playing', 'armory', 'playing', 'console'] as const) view.screen(s);
    expect(ramps).toEqual([0.4, 1, 0.4, 1, 0.4]);
    view.screen('debrief');
    expect(view.looping).toBe(false);
    voices.length = 0;
    view.screen('title');
    expect(view.looping).toBe(true);
    // From the top of the bar again.
    expect(voices.filter((v) => v.at === voices[0].at).map((v) => v.id).sort()).toEqual(STEP_ZERO);
  });

  it('runs the loop only while MUSIC is on, at any volume', () => {
    const { ctx } = studio();
    const view = new AudioView(() => ctx, { ...ON, music: false });
    view.screen('playing');
    view.unlock();
    expect(view.looping).toBe(false);
    view.set({ music: true });
    expect(view.looping).toBe(true);
    for (const volume of [1, 2, 3] as const) { view.set({ volume }); expect(view.looping, `volume ${volume}`).toBe(true); }
    view.set({ music: false });
    expect(view.looping).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('asks a suspended context to resume on a gesture, not on every repeat of a held key, and a running one never', async () => {
    const stuck = studio();
    stuck.resume.mockReturnValue(new Promise(() => undefined));
    const a = new AudioView(() => stuck.ctx, ON);
    a.unlock();
    a.unlock();
    a.unlock();
    expect(stuck.resume).toHaveBeenCalledTimes(1);
    // A resume that never answers (no output device, or a gesture that did not count) does not stop the next gesture asking again.
    vi.advanceTimersByTime(600);
    a.unlock();
    expect(stuck.resume).toHaveBeenCalledTimes(2);

    const blocked = studio();
    blocked.resume.mockRejectedValue(new Error('blocked'));
    const b = new AudioView(() => blocked.ctx, ON);
    b.unlock();
    await vi.advanceTimersByTimeAsync(600);
    b.unlock();
    expect(blocked.resume).toHaveBeenCalledTimes(2);

    const running = studio('running');
    const c = new AudioView(() => running.ctx, ON);
    c.unlock();
    vi.advanceTimersByTime(600);
    c.unlock();
    expect(running.resume).not.toHaveBeenCalled();
  });

  it('puts a limiter between the master and the destination, set as a limiter and not as the node\'s defaults', () => {
    const { ctx, compressors, gains, voices, heard, reaches } = studio('suspended', { limiter: true });
    const view = new AudioView(() => ctx, { ...ON, music: false });
    view.unlock();
    expect(compressors).toHaveLength(1);
    const [limiter] = compressors;
    // Threshold -3 dB, no knee, 20:1, a 3 ms attack and a 250 ms release (the defaults would be -24, 30, 12, .003 and .25).
    expect([limiter.threshold.value, limiter.knee.value, limiter.ratio.value, limiter.attack.value, limiter.release.value]).toEqual([-3, 0, 20, 0.003, 0.25]);
    const [master] = gains;
    expect(master.connect).toHaveBeenCalledWith(limiter);
    expect(master.connect).not.toHaveBeenCalledWith(ctx.destination);
    expect(limiter.connect).toHaveBeenCalledWith(ctx.destination);
    // Everything that plays goes through it.
    view.event(thrown);
    expect(voices.length).toBeGreaterThan(0);
    for (const v of voices) expect(reaches(v.node, limiter), v.id).toBe(true);
    expect(heard()).toEqual(SOUND.throw);
  });

  it('takes the limiter\'s makeup gain out of the master level, so the mix is as loud as it is without one', () => {
    const limited = studio('suspended', { limiter: true });
    const view = new AudioView(() => limited.ctx, { ...ON, music: false, volume: 3 });
    view.unlock();
    const [master] = limited.gains;
    // The node's own makeup gain at these settings is about +1.7 dB (x1.22).
    expect(master.gain.value).toBeCloseTo(1 / 1.22, 3);
    view.set({ volume: 1 });
    expect(master.gain.value).toBeCloseTo(0.35 / 1.22, 3);
    view.set({ volume: 2 });
    expect(master.gain.value).toBeCloseTo(0.65 / 1.22, 3);
    // Without a limiter there is no makeup to take out.
    const plain = studio();
    const bare = new AudioView(() => plain.ctx, { ...ON, music: false, volume: 3 });
    bare.unlock();
    expect(plain.gains[0].gain.value).toBe(1);
  });

  it('goes without a limiter where the browser has no compressor: the master feeds the destination and everything still plays', () => {
    const { ctx, gains, voices, heard, reaches } = studio();
    expect('createDynamicsCompressor' in ctx).toBe(false);
    const view = new AudioView(() => ctx, { ...ON, music: false });
    view.unlock();
    const [master] = gains;
    expect(master.connect).toHaveBeenCalledWith(ctx.destination);
    expect(view.unlocked).toBe(true);
    view.event(thrown);
    for (const v of voices) expect(reaches(v.node, master), v.id).toBe(true);
    expect(heard()).toEqual(SOUND.throw);
    // And a loop is not lost with it.
    view.set({ music: true });
    expect(view.looping).toBe(true);
  });

  it('keeps the game running, silent, when the context cannot be built or breaks while playing', () => {
    const none = new AudioView(() => { throw new Error('no web audio'); }, ON);
    expect(() => { none.unlock(); none.screen('playing'); none.event(thrown); none.set({ music: false }); }).not.toThrow();
    expect([none.unlocked, none.looping]).toEqual([true, false]);

    const broken = studio();
    const view = new AudioView(() => broken.ctx, { ...ON, music: false });
    view.unlock();
    (broken.ctx as unknown as { createOscillator(): never }).createOscillator = () => { throw new Error('closed'); };
    expect(() => { view.event(thrown); view.screen('paused'); view.screen('playing'); }).not.toThrow();
  });
});

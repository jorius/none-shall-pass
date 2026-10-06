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
  const node = () => ({ connect: vi.fn().mockReturnThis(), disconnect: vi.fn(), start: vi.fn((t) => started.push(String(t))), stop: vi.fn(), frequency: { value: 440, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, type: 'square', buffer: null });
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

  it('adds the level-up fanfare when Destrier or Observability rises a level, not for other cards, and starts over with each run', () => {
    const { view, heard } = effects();
    const hear = (owned: ('lockdown' | 'squire' | 'destrier' | 'destrier2' | 'obs1' | 'obs2' | 'cdn')[]): string[] => { view.event({ type: 'owned', owned }); return heard(); };
    view.start(new Run(cfg()));
    const PICK = [...SOUND.pick], UP = [...SOUND.pick, ...SOUND.levelUp];
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
    view.set({ music: false, volume: 0 });
    expect(levels()).toEqual([0, 0, 0]);
  });

  it('mutes both when either is on and brings both back when both are off, reporting each change', () => {
    const seen: AudioPrefs[] = [];
    const view = new AudioView(() => null, { sound: true, music: false, volume: 3 }, (p) => seen.push(p));
    view.toggleMute();
    expect(view.settings).toEqual({ sound: false, music: false, volume: 3 });
    view.toggleMute();
    expect(view.settings).toEqual({ sound: true, music: true, volume: 3 });
    expect(seen).toEqual([{ sound: false, music: false, volume: 3 }, { sound: true, music: true, volume: 3 }]);
    // What it hands out is a copy.
    view.settings.volume = 0;
    expect(view.settings.volume).toBe(3);
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

  it('runs the loop only while MUSIC is on and VOLUME is above 0', () => {
    const { ctx } = studio();
    const view = new AudioView(() => ctx, { ...ON, music: false });
    view.screen('playing');
    view.unlock();
    expect(view.looping).toBe(false);
    view.set({ music: true });
    expect(view.looping).toBe(true);
    view.set({ volume: 0 });
    expect(view.looping).toBe(false);
    view.set({ volume: 1 });
    expect(view.looping).toBe(true);
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

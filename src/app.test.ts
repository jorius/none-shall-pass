// @vitest-environment jsdom
// packages
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// core
import type { LogEntry, RunEvent } from './core/events';
import { KONAMI, type Screen } from './core/keys';
import type { Run } from './core/run';
import { freshState, place } from './core/testkit';

// game
import type { FieldScene } from './game/FieldScene';

// local
import { App } from './app';
import { createStore, type Store } from './storage';

// A breach or a false positive as the log records it, on a real template.
const fakeEntry = (outcome: 'breach' | 'fp'): LogEntry => ({ seq: 1, wave: 1, outcome, packet: place(freshState(), outcome === 'fp' ? 'legit-socks' : 'scan-telnet', 300), points: 0 });

describe('App', () => {
  let app: App, store: Store, ended: Run[], screens: Screen[], started: Run[];
  beforeEach(() => {
    vi.useFakeTimers();
    store = createStore(null);
    app = new App({ onFrame: null } as unknown as FieldScene, store);
    ended = [];
    screens = [];
    started = [];
    app.onEnd = (run) => ended.push(run);
    app.onScreen = (s) => screens.push(s);
    app.add({ start: (run) => started.push(run) });
  });
  afterEach(() => vi.useRealTimers());

  const end = (): void => app.dispatch([{ type: 'runEnded', reason: 'serverDown' }]);
  const konami = (): void => { for (const key of KONAMI) window.dispatchEvent(new KeyboardEvent('keydown', { key })); };

  it('reports the ended run at once and opens the debrief a moment later', () => {
    app.startRun('campaign');
    const run = app.run;
    end();
    expect(ended).toEqual([run]);
    vi.advanceTimersByTime(1199);
    expect(app.screen).toBe('playing');
    vi.advanceTimersByTime(1);
    expect(app.screen).toBe('debrief');
    expect(ended).toEqual([run]);
  });

  it('drops the pending debrief, not the result, when the player quits and starts a new run', () => {
    app.startRun('campaign');
    const run = app.run;
    end();
    vi.advanceTimersByTime(500);
    app.quit();
    app.startRun('campaign');
    vi.advanceTimersByTime(5000);
    expect(app.screen).toBe('playing');
    expect(ended).toEqual([run]);
  });

  it('drops the pending debrief when a new run starts', () => {
    app.startRun('campaign');
    const run = app.run;
    end();
    app.startRun('overtime');
    vi.advanceTimersByTime(5000);
    expect(app.screen).toBe('playing');
    expect(ended).toEqual([run]);
  });

  it('keeps a console opened just before the debrief, and closing it lands on the debrief', () => {
    app.startRun('campaign');
    end();
    app.act('console');
    vi.advanceTimersByTime(5000);
    expect(app.screen).toBe('console');
    app.act('closeConsole');
    expect(app.screen).toBe('debrief');
  });

  it('still opens the debrief when that console closes before it is due', () => {
    app.startRun('campaign');
    end();
    app.act('console');
    vi.advanceTimersByTime(300);
    app.act('closeConsole');
    expect(app.screen).toBe('playing');
    vi.advanceTimersByTime(900);
    expect(app.screen).toBe('debrief');
  });

  it('switches root mode with the Konami code on the title, for every run after it', () => {
    let refreshed = 0;
    app.add({ refresh: () => { refreshed++; } });
    app.quit();
    konami();
    expect([app.root, app.screen, refreshed]).toEqual([true, 'title', 1]);
    app.startRun('campaign');
    expect(app.run!.state.cfg).toMatchObject({ root: true, hints: false });
    // Quitting keeps the mode; the code again switches it back off.
    app.quit();
    expect(started.at(-1)!.state.cfg.root).toBe(true);
    konami();
    expect([app.root, refreshed]).toEqual([false, 2]);
    app.startRun('campaign');
    expect(app.run!.state.cfg.root).toBe(false);
  });

  it('ignores the Konami code during a run', () => {
    app.startRun('campaign');
    konami();
    expect(app.root).toBe(false);
  });

  it('quits to the title behind a calm, idle field', () => {
    app.startRun('campaign');
    app.dispatch(app.run!.step(5));
    app.quit();
    expect(app.run).toBeNull();
    expect(app.screen).toBe('title');
    expect(screens.at(-1)).toBe('title');
    const idle = started.at(-1)!.state;
    expect(idle).toMatchObject({ wave: 1, score: 0, uptime: 100, packets: [], owned: ['lockdown'] });
  });

  it('drafts through the run: a pick, a reroll it cannot afford, the next wave', () => {
    app.startRun('campaign');
    const run = app.run!;
    app.dispatch(run.cheat('skip'));
    expect(app.screen).toBe('draft');
    app.pick(0);
    app.pick(0);
    expect(run.state.owned).toEqual(['lockdown', 'destrier']);
    const picks = run.state.draft!.picks;
    app.reroll();
    expect(run.state.draft!.picks).toBe(picks);
    app.nextWave();
    expect(app.screen).toBe('playing');
    expect(run.state.wave).toBe(2);
  });

  it('opens the recap before the draft when the wave had mistakes, and the draft straight away when it was clean', () => {
    app.startRun('campaign');
    const run = app.run!;
    run.state.waveMistakes = [fakeEntry('fp')];
    app.dispatch([{ type: 'draftOpened', draft: { picks: [], free: true, taken: [] } }]);
    expect(app.screen).toBe('recap');
    app.act('continue');
    expect(app.screen).toBe('draft');
    run.state.waveMistakes = [];
    app.dispatch([{ type: 'draftOpened', draft: { picks: [], free: true, taken: [] } }]);
    expect(app.screen).toBe('draft');
    // CONTINUE is the recap's key alone: anywhere else it does nothing.
    app.act('continue');
    expect(app.screen).toBe('draft');
  });

  it('charges down the lane on C once Destrier III is owned, and does nothing before', () => {
    const events: RunEvent[] = [];
    app.add({ event: (ev) => events.push(ev) });
    app.startRun('campaign');
    const run = app.run!;
    const started = (): RunEvent[] => events.filter((e) => e.type === 'chargeStarted');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }));
    expect(started()).toEqual([]);
    expect(run.state.knight.charge).toEqual({ t: 0, used: false });
    run.state.owned.push('destrier', 'destrier2', 'destrier3');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'C' }));
    expect(started()).toEqual([{ type: 'chargeStarted', lane: 2 }]);
    expect(run.state.knight.charge.t).toBeGreaterThan(0);
    // A held key is one press, and the gallop is spent for the wave anyway.
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', repeat: true }));
    expect(started()).toHaveLength(1);
  });

  it('ignores draft actions without a run', () => {
    expect(() => { app.pick(0); app.reroll(); app.nextWave(); }).not.toThrow();
    expect(app.screen).toBe('title');
  });

  it('goes title → setup → run with the chosen knight and difficulty, and remembers them', () => {
    app.quit();
    app.openSetup('campaign');
    expect([app.screen, app.run, app.pendingMode]).toEqual(['setup', null, 'campaign']);
    app.startRun('campaign', { knight: 'raider', difficulty: 'intern' });
    expect(app.run!.state.cfg).toMatchObject({ knight: 'raider', difficulty: 'intern', mode: 'campaign' });
    expect(store.prefs()).toMatchObject({ knight: 'raider', difficulty: 'intern' });
    app.act('back');
    expect(app.screen).toBe('playing'); // back only works on the setup screen
  });

  it('starts a run without a choice on the pair remembered, and the title\'s idle field shows that knight', () => {
    store.setPrefs({ knight: 'ghost', difficulty: 'zeroday' });
    app.startRun('overtime');
    expect(app.run!.state.cfg).toMatchObject({ knight: 'ghost', difficulty: 'zeroday', mode: 'overtime', hints: false });
    app.quit();
    // The backdrop is always an Analyst's run, the chosen knight at his post.
    expect(started.at(-1)!.state.cfg).toMatchObject({ knight: 'ghost', difficulty: 'analyst' });
    expect(app.run).toBeNull();
  });

  it('leaves the setup for the title on Esc, the mode it was opened for kept', () => {
    app.quit();
    app.openSetup('overtime');
    expect(screens.at(-1)).toBe('setup');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect([app.screen, app.run, app.pendingMode]).toEqual(['title', null, 'overtime']);
    // Nothing else moves the setup but Enter: the play keys belong to the field.
    app.openSetup('campaign');
    for (const key of [' ', 'p', 'c', 'ArrowUp']) window.dispatchEvent(new KeyboardEvent('keydown', { key }));
    expect(app.screen).toBe('setup');
  });

  it('starts the run on Enter at the setup, on the pair saved and the mode it was opened for, and takes the press so no second run starts', () => {
    store.setPrefs({ knight: 'ghost', difficulty: 'incident' });
    app.quit();
    app.openSetup('overtime');
    const start = vi.spyOn(app, 'startRun');
    const enter = (over: KeyboardEventInit = {}): KeyboardEvent => {
      const ev = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true, ...over });
      window.dispatchEvent(ev);
      return ev;
    };
    // A held key repeats the keydown, and the repeats are nobody's.
    expect(enter({ repeat: true }).defaultPrevented).toBe(false);
    expect(start).not.toHaveBeenCalled();
    // The press is taken: its default (a click on the button that has the focus) is cancelled, which would start a second run.
    expect(enter().defaultPrevented).toBe(true);
    expect(start).toHaveBeenCalledTimes(1);
    expect(start).toHaveBeenCalledWith('overtime');
    expect([app.screen, app.run!.state.cfg]).toEqual(['playing', expect.objectContaining({ mode: 'overtime', knight: 'ghost', difficulty: 'incident' })]);
    // The run is on, and Enter is nobody's key there.
    expect(enter().defaultPrevented).toBe(false);
    expect(start).toHaveBeenCalledTimes(1);
  });

  it('leaves Enter to the focused button that carries the keep-Enter marker, and takes it from every other element', () => {
    app.quit();
    app.openSetup('campaign');
    const start = vi.spyOn(app, 'startRun');
    // The setup marks BACK and its language button (data-keeps-enter); the App reads the marker off the element the key came from.
    const own = document.body.appendChild(Object.assign(document.createElement('button'), { textContent: 'BACK' }));
    own.dataset.keepsEnter = '';
    const inner = own.appendChild(document.createElement('span'));
    const other = document.body.appendChild(Object.assign(document.createElement('button'), { textContent: 'START' }));
    const press = (target: EventTarget): KeyboardEvent => {
      const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      target.dispatchEvent(ev);
      return ev;
    };
    // The key is not taken, so the browser clicks the button; no run starts.
    expect([press(own).defaultPrevented, press(inner).defaultPrevented, start.mock.calls.length, app.screen]).toEqual([false, false, 0, 'setup']);
    // Anywhere else it is taken, and starts one run.
    expect([press(other).defaultPrevented, start.mock.calls.length, app.screen]).toEqual([true, 1, 'playing']);
    own.remove();
    other.remove();
  });

  it('starts a first visit\'s run on the Black Knight and the Analyst when Enter is pressed at the setup, and only from the setup', () => {
    app.act('continue');
    expect([app.screen, app.run]).toEqual(['title', null]);
    app.openSetup('campaign');
    app.act('continue');
    expect([app.screen, app.run!.state.cfg]).toEqual(['playing', expect.objectContaining({ mode: 'campaign', knight: 'black', difficulty: 'analyst' })]);
    expect(store.prefs()).toMatchObject({ knight: 'black', difficulty: 'analyst' });
  });

  it('pauses only from play, so the pause button cannot leave a draft behind', () => {
    app.startRun('campaign');
    app.act('pause');
    expect(app.screen).toBe('paused');
    app.act('pause');
    expect(app.screen).toBe('playing');
    app.dispatch(app.run!.cheat('skip'));
    app.act('pause');
    expect(app.screen).toBe('draft');
  });

  it('toggles the armory from the title, the pause and play, pausing play, and returns where it came from', () => {
    const paused: boolean[] = [];
    app.add({ pause: (p) => paused.push(p) });
    app.act('armory');
    expect([app.screen, app.run]).toEqual(['armory', null]);
    expect([screens.at(-1), paused.at(-1)]).toEqual(['armory', true]);
    app.act('armory');
    expect([app.screen, paused.at(-1)]).toEqual(['title', false]);
    app.startRun('campaign', { knight: 'black', difficulty: 'analyst' });
    app.act('armory');
    expect([app.screen, paused.at(-1)]).toEqual(['armory', true]);
    app.act('armory');
    expect([app.screen, paused.at(-1)]).toEqual(['playing', false]);
    app.act('pause');
    app.act('armory');
    expect(app.screen).toBe('armory');
    app.act('armory');
    expect([app.screen, paused.at(-1)]).toEqual(['paused', true]);
    // The pause is still the pause: P resumes the run.
    app.act('pause');
    expect([app.screen, paused.at(-1)]).toEqual(['playing', false]);
  });

  it('opens the armory over a draft and lands back on it, the draft untouched', () => {
    app.startRun('campaign');
    const run = app.run!;
    app.dispatch(run.cheat('skip'));
    const draft = run.state.draft;
    expect(app.screen).toBe('draft');
    app.act('armory');
    expect([app.screen, run.state.phase]).toEqual(['armory', 'draft']);
    app.act('armory');
    expect([app.screen, run.state.phase]).toEqual(['draft', 'draft']);
    expect(run.state.draft).toBe(draft);
  });

  it('opens the armory only from the title, the pause, a draft and play', () => {
    app.openSetup('campaign');
    app.act('armory');
    expect(app.screen).toBe('setup');
    app.startRun('campaign');
    app.act('console');
    app.act('armory');
    expect(app.screen).toBe('console');
    app.act('closeConsole');
    app.run!.state.waveMistakes = [fakeEntry('fp')];
    app.dispatch([{ type: 'draftOpened', draft: { picks: [], free: true, taken: [] } }]);
    expect(app.screen).toBe('recap');
    app.act('armory');
    expect(app.screen).toBe('recap');
    end();
    vi.advanceTimersByTime(1200);
    expect(app.screen).toBe('debrief');
    app.act('armory');
    expect(app.screen).toBe('debrief');
  });

  it('opens and closes the armory on T and Esc, once per press, and takes no other key while it is open', () => {
    const press = (key: string, repeat = false): void => { window.dispatchEvent(new KeyboardEvent('keydown', { key, repeat })); };
    press('t');
    expect(app.screen).toBe('armory');
    press('t', true);
    expect(app.screen).toBe('armory');
    press('Escape');
    expect(app.screen).toBe('title');
    app.startRun('campaign');
    const lane = app.run!.state.knight.lane;
    press('T');
    expect(app.screen).toBe('armory');
    // The play keys are not the Armory's: no lane change, no spear, no pause, no charge.
    for (const key of ['ArrowUp', 'ArrowDown', ' ', 'p', 'c', 'h']) press(key);
    expect([app.screen, app.run!.state.knight.lane]).toEqual(['armory', lane]);
    press('T');
    expect(app.screen).toBe('playing');
    // Esc closes it too, back on the pause it came from.
    press('p');
    press('t');
    press('Escape');
    expect(app.screen).toBe('paused');
  });

  it('freezes the run and the view clock while the armory is open, and thaws them when it closes', () => {
    const seen: { dt: number; time: number }[] = [];
    app.add({ frame: (_run, dt, time) => seen.push({ dt, time }) });
    app.startRun('campaign');
    const run = app.run!, tick = (): void => app.scene.onFrame!(50);
    tick();
    const left = run.state.timeLeft;
    expect(seen.at(-1)!.dt).toBeGreaterThan(0);
    app.act('armory');
    seen.length = 0;
    tick();
    tick();
    expect(run.state.timeLeft).toBe(left);
    expect(seen.map((f) => f.dt)).toEqual([0, 0]);
    expect(seen[1].time).toBe(seen[0].time);
    app.act('armory');
    tick();
    expect(run.state.timeLeft).toBeLessThan(left);
    expect(seen.at(-1)!.time).toBeGreaterThan(seen[0].time);
  });

  it('mutes on M from every screen, with a run or without, once per press, and refreshes the views for the badge', () => {
    const muted = vi.fn(), refreshed = vi.fn();
    app.onMute = muted;
    app.add({ refresh: refreshed });
    const press = (key: string, repeat = false): void => { window.dispatchEvent(new KeyboardEvent('keydown', { key, repeat })); };
    const count = (): number[] => [muted.mock.calls.length, refreshed.mock.calls.length];
    // On the title, with no run.
    press('m');
    expect(count()).toEqual([1, 1]);
    app.openSetup('campaign');
    press('M');
    expect(count()).toEqual([2, 2]);
    app.startRun('campaign');
    for (const step of [() => undefined, () => app.act('pause'), () => app.act('pause'), () => app.act('armory'), () => app.act('armory'), () => app.act('console')]) {
      step();
      const before = muted.mock.calls.length;
      press('m');
      // Not in the console: its prompt takes the letter (the key is routed to nothing there).
      expect(muted.mock.calls.length, app.screen).toBe(app.screen === 'console' ? before : before + 1);
    }
    app.act('closeConsole');
    app.dispatch(app.run!.cheat('skip'));
    const draft = muted.mock.calls.length;
    press('m');
    expect([app.screen, muted.mock.calls.length]).toEqual(['draft', draft + 1]);
    // A held key is one press.
    press('m', true);
    expect(muted.mock.calls.length).toBe(draft + 1);
  });

  it('leaves M to a text field, and does nothing when no audio is wired', () => {
    const muted = vi.fn();
    app.onMute = muted;
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'm', bubbles: true }));
    expect(muted).not.toHaveBeenCalled();
    input.remove();
    app.onMute = null;
    expect(() => app.act('mute')).not.toThrow();
  });

  describe('auto-pause', () => {
    const blur = (): void => { window.dispatchEvent(new Event('blur')); };
    const hidden = (on: boolean): void => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (on ? 'hidden' : 'visible') });
      document.dispatchEvent(new Event('visibilitychange'));
    };
    afterEach(() => { Reflect.deleteProperty(document, 'visibilityState'); });

    it('pauses a run when the window loses focus, and does not resume when it comes back', () => {
      app.startRun('campaign');
      blur();
      expect(app.screen).toBe('paused');
      window.dispatchEvent(new Event('focus'));
      expect(app.screen).toBe('paused');
      app.act('pause');
      expect(app.screen).toBe('playing');
    });

    it('pauses a run when the tab goes hidden, and leaves it paused when it shows again', () => {
      app.startRun('campaign');
      hidden(true);
      expect(app.screen).toBe('paused');
      hidden(false);
      expect(app.screen).toBe('paused');
    });

    it('leaves the title, a draft, the console and the debrief alone', () => {
      blur();
      expect(app.screen).toBe('title');
      app.startRun('campaign');
      app.dispatch(app.run!.cheat('skip'));
      blur();
      expect(app.screen).toBe('draft');
      app.nextWave();
      app.act('console');
      blur();
      expect(app.screen).toBe('console');
      app.act('closeConsole');
      end();
      vi.advanceTimersByTime(1200);
      blur();
      hidden(true);
      expect(app.screen).toBe('debrief');
    });

    it('ignores an element losing the focus, which leaves the window focused', () => {
      // The console's prompt blurs when the console closes; only the window's own blur means the player left.
      app.startRun('campaign');
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      input.blur();
      input.dispatchEvent(new Event('blur'));
      expect(app.screen).toBe('playing');
      input.remove();
    });
  });
});

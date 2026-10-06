// @vitest-environment jsdom
// packages
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// core
import { KONAMI, type Screen } from './core/keys';
import type { Run } from './core/run';

// game
import type { FieldScene } from './game/FieldScene';

// local
import { App } from './app';
import { createStore } from './storage';

describe('App', () => {
  let app: App, ended: Run[], screens: Screen[], started: Run[];
  beforeEach(() => {
    vi.useFakeTimers();
    app = new App({ onFrame: null } as unknown as FieldScene, createStore(null));
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

  it('ignores draft actions without a run', () => {
    expect(() => { app.pick(0); app.reroll(); app.nextWave(); }).not.toThrow();
    expect(app.screen).toBe('title');
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
});

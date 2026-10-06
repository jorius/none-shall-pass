// @vitest-environment jsdom
// packages
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// game
import type { FieldScene } from '../game/FieldScene';

// local
import { App } from '../app';
import { createStore } from '../storage';
import { AnalyticsView } from './analyticsView';

describe('AnalyticsView', () => {
  let app: App, sent: [string, unknown][];
  beforeEach(() => {
    vi.useFakeTimers();
    sent = [];
    (window as unknown as { umami: unknown }).umami = { track: (n: string, d?: unknown) => { sent.push(d === undefined ? [n, null] : [n, d]); } };
    app = new App({ onFrame: null } as unknown as FieldScene, createStore(null));
    app.add(new AnalyticsView(app));
  });
  afterEach(() => { delete (window as unknown as { umami?: unknown }).umami; vi.useRealTimers(); });

  it('counts a run when it starts, not the idle field behind the title', () => {
    app.quit();
    expect(sent).toEqual([]);
    app.startRun('campaign');
    app.quit();
    expect(sent).toEqual([['game-start', { mode: 'campaign', root: false, difficulty: 'analyst', knight: 'black' }]]);
  });

  it('reports cleared waves, the console and the root switch, once each', () => {
    app.root = true;
    app.refresh();
    app.refresh();
    app.startRun('overtime');
    app.dispatch(app.run!.cheat('skip'));
    app.nextWave();
    app.act('console');
    expect(sent).toEqual([
      ['root-mode', { on: true }],
      ['game-start', { mode: 'overtime', root: true, difficulty: 'analyst', knight: 'black' }],
      // Skipped from the console, so the wave is marked as a tampered run's.
      ['wave-cleared', { mode: 'overtime', wave: 1, tampered: true }],
      ['console-opened', null],
    ]);
  });

  it('reports a wave cleared in play as untampered', () => {
    app.startRun('campaign');
    app.run!.state.timeLeft = 0;
    app.dispatch(app.run!.step(1 / 60));
    expect(sent.filter(([n]) => n === 'wave-cleared')).toEqual([['wave-cleared', { mode: 'campaign', wave: 1, tampered: false }]]);
  });

  it('reports how a run ended in coarse numbers, and nothing of what was on screen', () => {
    app.startRun('campaign');
    Object.assign(app.run!.state, { wave: 3, score: 18420, endReason: 'serverDown' });
    app.dispatch([{ type: 'runEnded', reason: 'serverDown' }]);
    expect(sent.at(-1)).toEqual(['run-ended', { mode: 'campaign', outcome: 'serverDown', grade: 'F', score: '10k-24.9k', tampered: false }]);
    app.startRun('overtime');
    app.run!.state.wave = 7;
    app.dispatch([{ type: 'runEnded', reason: 'usersGone' }]);
    expect(sent.at(-1)).toEqual(['run-ended', { mode: 'overtime', outcome: 'usersGone', grade: 'wave-7', score: '0-999', tampered: false }]);
  });
});

// core
import type { RunEvent } from '../core/events';
import type { Screen } from '../core/keys';
import type { Run } from '../core/run';
import { grade, resultOf } from '../core/score';

// game
import type { View } from '../game/view';

// local
import { scoreBucket, track } from '../analytics';
import type { App } from '../app';

// How far people get, in coarse numbers: modes, waves, grades and score buckets. No payloads, no typed text, no IPs.
export class AnalyticsView implements View {
  private root = false;

  constructor(private readonly app: App) {}

  // Views also start with the idle run behind the title; only the App's own run is a game.
  start(run: Run): void {
    if (run === this.app.run) track('game-start', { mode: run.state.cfg.mode, root: run.state.cfg.root });
  }

  event(ev: RunEvent, run: Run): void {
    if (ev.type === 'waveCleared') track('wave-cleared', { mode: run.state.cfg.mode, wave: ev.wave });
    if (ev.type === 'runEnded') {
      const r = resultOf(run.state);
      track('run-ended', { mode: r.mode, outcome: ev.reason, grade: grade(r) ?? `wave-${r.wave}`, score: scoreBucket(r.score), tampered: r.tampered });
    }
  }

  screen(s: Screen): void {
    if (s === 'console') track('console-opened');
  }

  refresh(): void {
    if (this.app.root !== this.root) { this.root = this.app.root; track('root-mode', { on: this.root }); }
  }
}

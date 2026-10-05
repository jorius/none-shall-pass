// core
import { STEP } from './core/constants';
import type { Mode } from './core/content/waves';
import type { RunEvent } from './core/events';
import { routeKey, type Action, type Screen } from './core/keys';
import { frameSteps } from './core/loop';
import { Run } from './core/run';

// game
import type { FieldScene } from './game/FieldScene';
import type { View } from './game/view';

// local
import type { Store } from './storage';

export class App {
  run: Run | null = null;
  screen: Screen = 'title';
  root = false;
  onScreen: ((s: Screen) => void) | null = null;
  onEnd: ((run: Run) => void) | null = null;
  private readonly views: View[] = [];
  private acc = 0;
  private time = 0;
  private beforeConsole: Screen = 'playing';

  constructor(readonly scene: FieldScene, readonly store: Store) {
    scene.onFrame = (ms) => this.frame(ms);
    window.addEventListener('keydown', (e) => this.key(e));
  }

  add(...views: View[]): void {
    this.views.push(...views);
  }

  startRun(mode: Mode): void {
    const hints = !this.root && !!this.store.prefs().hints;
    this.run = new Run({ mode, seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, root: this.root, hints });
    this.acc = 0;
    for (const v of this.views) v.start?.(this.run);
    this.setScreen('playing');
    this.dispatch(this.run.start());
  }

  dispatch(evs: RunEvent[]): void {
    const run = this.run;
    if (!run) return;
    for (const ev of evs) {
      for (const v of this.views) v.event?.(ev, run);
      if (ev.type === 'draftOpened') this.setScreen('draft');
      if (ev.type === 'waveStarted' && this.screen === 'draft') this.setScreen('playing');
      if (ev.type === 'runEnded') setTimeout(() => { this.setScreen('debrief'); this.onEnd?.(run); }, 1200);
    }
  }

  setScreen(s: Screen): void {
    if (s === 'console') this.beforeConsole = this.screen;
    this.screen = s;
    const paused = s === 'paused' || s === 'console';
    for (const v of this.views) { v.pause?.(paused); v.screen?.(s); }
    this.onScreen?.(s);
  }

  refresh(): void {
    for (const v of this.views) v.refresh?.(this.run);
  }

  private frame(ms: number): void {
    const paused = this.screen === 'paused' || this.screen === 'console';
    const playing = this.screen === 'playing' && !!this.run && this.run.state.phase === 'playing';
    const dt = playing ? Math.min(Math.max(ms, 0), 50) / 1000 : 0;
    if (!paused) this.time += Math.min(Math.max(ms, 0), 50) / 1000;
    if (playing && this.run) {
      const r = frameSteps(this.acc, ms);
      this.acc = r.acc;
      for (let i = 0; i < r.steps; i++) this.dispatch(this.run.step(STEP));
    }
    for (const v of this.views) v.frame?.(this.run, dt, this.time);
  }

  private key(e: KeyboardEvent): void {
    const el = e.target as HTMLElement | null;
    const inField = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    const action = routeKey({
      key: e.key, code: e.code, shiftKey: e.shiftKey, ctrlKey: e.ctrlKey, metaKey: e.metaKey, repeat: e.repeat, inField,
    }, this.screen);
    if (!action) return;
    e.preventDefault();
    this.act(action);
  }

  act(a: Action): void {
    const run = this.run;
    if (!run || !a) return;
    switch (a) {
      case 'laneUp': this.dispatch(run.moveLane(-1)); break;
      case 'laneDown': this.dispatch(run.moveLane(1)); break;
      case 'next': this.dispatch(run.cycleTarget(1)); break;
      case 'prev': this.dispatch(run.cycleTarget(-1)); break;
      case 'throw': this.dispatch(run.throwSpear()); break;
      case 'release': this.dispatch(run.target(null)); break;
      case 'hints':
        if (run.state.cfg.root) break;
        run.setHints(!run.state.hints);
        this.store.setPrefs({ hints: run.state.hints });
        this.refresh();
        break;
      case 'pause': this.setScreen(this.screen === 'paused' ? 'playing' : 'paused'); break;
      case 'console': this.setScreen('console'); break;
      case 'closeConsole': this.setScreen(this.beforeConsole); break;
    }
  }
}

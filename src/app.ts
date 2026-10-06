// core
import { STEP } from './core/constants';
import type { Mode } from './core/content/waves';
import { allowsHints } from './core/difficulty';
import type { RunEvent } from './core/events';
import { konamiMatcher, routeKey, type Action, type Screen } from './core/keys';
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
  private endTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly konami = konamiMatcher();

  constructor(readonly scene: FieldScene, readonly store: Store) {
    scene.onFrame = (ms) => this.frame(ms);
    window.addEventListener('keydown', (e) => this.key(e));
    // A window that loses the focus or a tab that goes hidden pauses the run; the player resumes it (P, Esc, RESUME).
    // Only the window's own blur counts: the console's prompt taking or dropping the focus leaves the window focused.
    window.addEventListener('blur', () => this.autoPause());
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this.autoPause(); });
  }

  // Only from play: the title, a draft, the debrief and an open console have nothing running, and a pause stays one.
  private autoPause(): void {
    if (this.screen === 'playing') this.setScreen('paused');
  }

  add(...views: View[]): void {
    this.views.push(...views);
  }

  startRun(mode: Mode): void {
    this.cancelEnd();
    const hints = !this.root && !!this.store.prefs().hints;
    // Every run is an Analyst on the Black Knight until the setup screen hands in the player's choice.
    this.run = new Run({ mode, seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, root: this.root, hints, difficulty: 'analyst', knight: 'black' });
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
      if (ev.type === 'runEnded') { this.onEnd?.(run); this.endLater(run); }
    }
  }

  // The result is reported the moment the run ends (onEnd above), so quitting straight after a win still keeps it.
  // Only the debrief waits for the last shatter, and a quit or a new run in the meantime cancels it,
  // so the ended run cannot take over the next one's screen. A console opened meanwhile stays up,
  // and closing it lands on the debrief instead of the finished field.
  private endLater(run: Run): void {
    this.cancelEnd();
    this.endTimer = setTimeout(() => {
      this.endTimer = null;
      if (this.run !== run) return;
      if (this.screen === 'console') this.beforeConsole = 'debrief';
      else this.setScreen('debrief');
    }, 1200);
  }

  private cancelEnd(): void {
    if (this.endTimer !== null) clearTimeout(this.endTimer);
    this.endTimer = null;
  }

  pick(i: number): void { if (this.run) this.dispatch(this.run.pick(i)); }
  reroll(): void { if (this.run) this.dispatch(this.run.reroll()); }
  nextWave(): void { if (this.run) this.dispatch(this.run.nextWave()); }

  // Back to the title: an idle run resets every view (no packets, cold rack, knight at his post)
  // so the field reads as a calm backdrop behind the semi-transparent title.
  quit(): void {
    this.cancelEnd();
    const idle = new Run({ mode: 'campaign', seed: 1, root: this.root, hints: false, difficulty: 'analyst', knight: 'black' });
    for (const v of this.views) v.start?.(idle);
    this.run = null;
    this.setScreen('title');
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
    // The Konami code on the title (the how-to is part of it) toggles root mode for the runs that follow.
    // Every view refreshes into the new mode, and the open screen (title or how-to) stays where it is.
    if (this.screen === 'title' && this.konami(e.key)) {
      this.root = !this.root;
      this.refresh();
      return;
    }
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
        if (run.state.cfg.root || !allowsHints(run.state.cfg.difficulty)) break;
        run.setHints(!run.state.hints);
        this.store.setPrefs({ hints: run.state.hints });
        this.refresh();
        break;
      // Only from play: paused over a draft, resuming would drop the draft and leave the run stuck between waves.
      case 'pause':
        if (this.screen === 'playing' || this.screen === 'paused') this.setScreen(this.screen === 'paused' ? 'playing' : 'paused');
        break;
      case 'console': this.setScreen('console'); break;
      case 'closeConsole': this.setScreen(this.beforeConsole); break;
    }
  }
}

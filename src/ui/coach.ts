// core
import type { RunEvent } from '../core/events';
import type { Screen } from '../core/keys';
import type { Run } from '../core/run';

// game
import type { View } from '../game/view';

// i18n
import { t } from '../i18n';

// local
import type { Store } from '../storage';
import { el } from './dom';

// First campaign wave only, until the player throws once: the controls in one line.
export class Coach implements View {
  private readonly box: HTMLElement;
  private shownAt = -1;

  constructor(ui: HTMLElement, private readonly store: Store) {
    this.box = el('div', 'coach', ui, t('field.coach'));
    this.box.style.display = 'none';
  }

  refresh(): void {
    this.box.textContent = t('field.coach');
  }

  start(run: Run): void {
    const show = run.state.cfg.mode === 'campaign' && !this.store.prefs().coached;
    this.box.style.display = show ? '' : 'none';
    this.shownAt = show ? 0 : -1;
  }

  // The title's idle field gets no coaching; the next run's start brings it back.
  screen(s: Screen): void {
    if (s !== 'title') return;
    this.box.style.display = 'none';
    this.shownAt = -1;
  }

  event(ev: RunEvent): void {
    if (this.shownAt < 0) return;
    if ((ev.type === 'thrown' && ev.by === 'knight') || ev.type === 'waveCleared') this.done();
  }

  frame(_run: Run | null, dt: number): void {
    if (this.shownAt < 0) return;
    this.shownAt += dt;
    if (this.shownAt > 20) this.done();
  }

  private done(): void {
    this.box.style.display = 'none';
    this.shownAt = -1;
    this.store.setPrefs({ coached: true });
  }
}

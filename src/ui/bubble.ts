// core
import { FIELD_TOP } from '../core/constants';
import { LINES } from '../core/content/lines';
import type { RunEvent } from '../core/events';
import type { Run } from '../core/run';
import { mounted } from '../core/state';
import type { Localized } from '../core/types';

// game
import type { View } from '../game/view';

// i18n
import { loc } from '../i18n';

// stage
import { SCREEN_H, SCREEN_W } from '../stage';

// local
import { el } from './dom';

const SHOW_SECS = 2.6;

// The Black Knight's speech bubble, above his head (below him on the top lane).
export class Bubble implements View {
  private readonly box: HTMLElement;
  private hideAt = 0;
  private now = 0;
  private shown = '';
  private said: { text: Localized; sub?: Localized } | null = null;
  private h = 0;

  constructor(ui: HTMLElement) {
    this.box = el('div', 'bubble', ui);
  }

  // A new run, or the title's idle field, starts without the last run's line.
  start(): void {
    this.said = null;
    this.shown = '';
    this.hideAt = 0;
    this.box.classList.remove('show');
  }

  // A language switch (the pause menu has one) rewrites the line that is up.
  refresh(): void {
    if (this.box.classList.contains('show')) this.draw();
  }

  event(ev: RunEvent, run: Run): void {
    if (ev.type !== 'say') return;
    const line = LINES[ev.line];
    const said = { text: line.text, sub: ev.line === 'waveStart' ? run.waveDef.intro : line.sub };
    // The same line again while it is up (Space with no target, every press) only keeps it up.
    if (this.key(said) !== this.shown || this.now > this.hideAt) {
      this.said = said;
      this.draw();
    }
    this.hideAt = this.now + SHOW_SECS;
  }

  private key(said: { text: Localized; sub?: Localized }): string {
    return `${loc(said.text)}\n${said.sub ? loc(said.sub) : ''}`;
  }

  private draw(): void {
    if (!this.said) return;
    this.box.replaceChildren(loc(this.said.text));
    if (this.said.sub) this.box.append(el('small', '', undefined, loc(this.said.sub)));
    this.shown = this.key(this.said);
    this.h = this.box.offsetHeight;
    this.box.classList.add('show');
  }

  frame(run: Run | null, _dt: number, time: number): void {
    this.now = time;
    if (time > this.hideAt) this.box.classList.remove('show');
    if (!run) return;
    // Above his head unless that would run into the HUD (always on the top lane); below, it clears his YOU tag.
    const k = run.state.knight, below = k.y - 12 < this.h;
    this.box.classList.toggle('below', below);
    this.box.style.right = `${Math.max(8, SCREEN_W - (k.x + 72))}px`;
    if (below) { this.box.style.top = `${FIELD_TOP + k.y + (mounted(run.state) ? 122 : 113)}px`; this.box.style.bottom = 'auto'; }
    else { this.box.style.bottom = `${SCREEN_H - (FIELD_TOP + k.y) + 12}px`; this.box.style.top = 'auto'; }
  }
}

// core
import { FIELD_TOP } from '../core/constants';
import { LINES } from '../core/content/lines';
import type { RunEvent } from '../core/events';
import type { Run } from '../core/run';
import { mounted } from '../core/state';

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
  private h = 0;

  constructor(ui: HTMLElement) {
    this.box = el('div', 'bubble', ui);
  }

  event(ev: RunEvent, run: Run): void {
    if (ev.type !== 'say') return;
    const line = LINES[ev.line];
    const sub = ev.line === 'waveStart' ? run.waveDef.intro : line.sub;
    const text = loc(line.text), small = sub ? loc(sub) : '';
    const key = `${text}\n${small}`;
    // The same line again while it is up (Space with no target, every press) only keeps it up.
    if (key !== this.shown || this.now > this.hideAt) {
      this.box.replaceChildren(text);
      if (small) this.box.append(el('small', '', undefined, small));
      this.shown = key;
      this.h = this.box.offsetHeight;
      this.box.classList.add('show');
    }
    this.hideAt = this.now + SHOW_SECS;
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

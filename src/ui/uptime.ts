// core
import type { RunEvent } from '../core/events';
import type { Run } from '../core/run';

// game
import type { View } from '../game/view';

// i18n
import { t } from '../i18n';

// local
import { el } from './dom';

const SEGS = 50;
const GARBAGE = '█▓▒░#%&@$!?¿¥§¤ØÆ';
const SCRAMBLE_SECS = 0.5;
const GLITCH_SECS = 0.045;
const segOf = (u: number): number => Math.ceil((u / 100) * SEGS);
const glyph = (): string => GARBAGE[Math.floor(Math.random() * GARBAGE.length)];
const garbage = (u: number): string =>
  Math.random() < 0.4 ? `${glyph()}${String(u).slice(-1)}${glyph()}` : `${glyph()}${glyph()}${Math.random() < 0.5 ? '%' : glyph()}`;

// Full-width uptime bar that tears, scrambles and turns to static on every breach.
// The scramble and the settle run on the view clock, so they freeze with the game when it pauses.
export class UptimeStrip implements View {
  private readonly box: HTMLElement;
  private readonly label: HTMLElement;
  private readonly segs: HTMLElement;
  private readonly num: HTMLElement;
  private uptime = 100;
  private now = 0;
  private scrambleEnd: number | null = null;
  private nextGlitch = 0;
  private settleAt: number | null = null;

  constructor(ui: HTMLElement) {
    this.box = el('div', 'hpstrip', ui);
    this.label = el('span', 'lbl', this.box, t('uptime'));
    this.segs = el('div', 'segs', this.box);
    this.num = el('b', '', this.box, '100%');
    this.render();
  }

  refresh(): void {
    this.label.textContent = t('uptime');
  }

  // A new run must not inherit the last run's scramble or a pending settle.
  start(): void {
    this.scrambleEnd = null;
    this.box.classList.remove('tear');
    this.uptime = 100;
    this.render();
  }

  // With `before`, the segments just lost (or healed) flash first, then settle into the plain bar.
  private render(before?: number, healed = false): void {
    const full = segOf(this.uptime), had = segOf(before ?? this.uptime);
    this.segs.innerHTML = Array.from({ length: SEGS }, (_, i) => {
      if (healed) return `<i class="${i < had ? '' : i < full ? 'healed' : 'lost'}"></i>`;
      return `<i class="${i < full ? '' : i < had ? 'lost fresh' : 'lost'}"></i>`;
    }).join('');
    this.settleAt = before === undefined ? null : this.now + (healed ? 0.9 : 0.65);
    if (this.scrambleEnd === null) this.num.textContent = `${this.uptime}%`;
    this.box.classList.toggle('low', this.uptime < 35);
  }

  event(ev: RunEvent): void {
    if (ev.type !== 'uptime') return;
    const before = ev.before;
    this.uptime = ev.after;
    if (ev.after > before) { this.render(before, true); return; }
    this.box.classList.remove('tear');
    void this.box.offsetWidth;
    this.box.classList.add('tear');
    this.scrambleEnd = this.now + SCRAMBLE_SECS;
    this.nextGlitch = this.now + GLITCH_SECS;
    this.num.textContent = garbage(this.uptime);
    this.render(before);
  }

  frame(run: Run | null, _dt: number, time: number): void {
    this.now = time;
    if (this.scrambleEnd !== null) {
      if (time >= this.scrambleEnd) { this.scrambleEnd = null; this.num.textContent = `${this.uptime}%`; }
      else if (time >= this.nextGlitch) { this.nextGlitch = time + GLITCH_SECS; this.num.textContent = garbage(this.uptime); }
    }
    if (this.settleAt !== null && time >= this.settleAt) this.render();
    if (run && run.state.uptime !== this.uptime && this.scrambleEnd === null) { this.uptime = run.state.uptime; this.render(); }
  }
}

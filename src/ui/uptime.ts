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
const segOf = (u: number): number => Math.ceil((u / 100) * SEGS);

// Full-width uptime bar that tears, scrambles and turns to static on every breach.
export class UptimeStrip implements View {
  private readonly box: HTMLElement;
  private readonly label: HTMLElement;
  private readonly segs: HTMLElement;
  private readonly num: HTMLElement;
  private uptime = 100;
  private scramble: number | null = null;
  private settle: number | null = null;

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
    this.stopScramble();
    if (this.settle !== null) clearTimeout(this.settle);
    this.settle = null;
    this.box.classList.remove('hit');
    this.uptime = 100;
    this.render();
  }

  private stopScramble(): void {
    if (this.scramble !== null) clearInterval(this.scramble);
    this.scramble = null;
  }

  // With `before`, the segments just lost (or healed) flash first, then settle into the plain bar.
  private render(before?: number, healed = false): void {
    const full = segOf(this.uptime), had = segOf(before ?? this.uptime);
    this.segs.innerHTML = Array.from({ length: SEGS }, (_, i) => {
      if (healed) return `<i class="${i < had ? '' : i < full ? 'healed' : 'lost'}"></i>`;
      return `<i class="${i < full ? '' : i < had ? 'lost fresh' : 'lost'}"></i>`;
    }).join('');
    if (before !== undefined) {
      if (this.settle !== null) clearTimeout(this.settle);
      this.settle = window.setTimeout(() => { this.settle = null; this.render(); }, healed ? 900 : 650);
    }
    if (this.scramble === null) this.num.textContent = `${this.uptime}%`;
    this.box.classList.toggle('low', this.uptime < 35);
  }

  event(ev: RunEvent): void {
    if (ev.type !== 'uptime') return;
    const before = ev.before;
    this.uptime = ev.after;
    if (ev.after > before) { this.render(before, true); return; }
    this.box.classList.remove('hit');
    void this.box.offsetWidth;
    this.box.classList.add('hit');
    let n = 0;
    this.stopScramble();
    this.scramble = window.setInterval(() => {
      if (++n > 10) { this.stopScramble(); this.num.textContent = `${this.uptime}%`; return; }
      const g = (): string => GARBAGE[Math.floor(Math.random() * GARBAGE.length)];
      this.num.textContent = Math.random() < 0.4 ? `${g()}${String(this.uptime).slice(-1)}${g()}` : `${g()}${g()}${Math.random() < 0.5 ? '%' : g()}`;
    }, 45);
    this.render(before);
  }

  frame(run: Run | null): void {
    if (run && run.state.uptime !== this.uptime && this.scramble === null) { this.uptime = run.state.uptime; this.render(); }
  }
}

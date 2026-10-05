// core
import { LANE_COUNT, LANE_H } from '../core/constants';
import type { Run } from '../core/run';

// game
import type { View } from '../game/view';

// i18n
import { t } from '../i18n';

// local
import { el } from './dom';

const PORTS = [':22', '/login', '/search', '/comments', ':*'];

// The lane labels; it also hides packets until they come out from behind it.
export class Gutter implements View {
  private readonly rows: { box: HTMLElement; name: HTMLElement }[] = [];
  private lane = -1;

  constructor(ui: HTMLElement) {
    const g = el('div', 'gutter', ui);
    for (let i = 0; i < LANE_COUNT; i++) {
      const box = el('div', 'glabel', g);
      box.style.top = `${i * LANE_H}px`;
      el('div', 'port', box, PORTS[i]);
      this.rows.push({ box, name: el('div', 'name', box, t(`lane.${i}`)) });
    }
  }

  refresh(): void {
    this.rows.forEach((r, i) => { r.name.textContent = t(`lane.${i}`); });
  }

  frame(run: Run | null): void {
    const lane = run?.state.knight.lane ?? 2;
    if (lane === this.lane) return;
    this.lane = lane;
    this.rows.forEach((r, i) => r.box.classList.toggle('cur', i === lane));
  }
}

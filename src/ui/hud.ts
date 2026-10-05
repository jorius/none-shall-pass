// core
import { MAX_REP } from '../core/constants';
import { CAMPAIGN } from '../core/content/waves';
import type { RunEvent } from '../core/events';
import type { Run } from '../core/run';

// game
import type { View } from '../game/view';

// i18n
import { fmtNum, loc, t } from '../i18n';

// local
import type { App } from '../app';
import { el } from './dom';

// A clicked toggle must not keep the focus, or the next Space press would click it again.
const button = (parent: HTMLElement, text: string, onClick: () => void): HTMLButtonElement => {
  const b = el('button', 'toggle', parent, text);
  b.onmousedown = (e) => e.preventDefault();
  b.onclick = onClick;
  return b;
};

export class Hud implements View {
  private readonly waveEl: HTMLElement;
  private readonly score: HTMLElement;
  private readonly credits: HTMLElement;
  private readonly pips: HTMLElement;
  private readonly hints: HTMLButtonElement;
  private readonly pauseBtn: HTMLButtonElement;
  private readonly root: HTMLElement;
  private readonly labels: HTMLElement[] = [];
  private last = '';

  constructor(ui: HTMLElement, app: App) {
    const bar = el('div', 'hud', ui);
    const l = el('div', 'hud-l', bar);
    el('div', 'title', l, 'NONE SHALL PASS');
    this.waveEl = el('div', 'wave', l);
    this.root = el('span', 'badge-root', l, t('hud.root'));
    const r = el('div', 'hud-r', bar);
    const stat = (key: string): HTMLElement => {
      const s = el('div', 'stat', r);
      this.labels.push(el('span', '', s, t(key)));
      s.dataset.key = key;
      return el('b', '', s);
    };
    this.score = stat('hud.score');
    this.credits = stat('hud.credits');
    const rep = el('div', 'stat', r);
    this.labels.push(el('span', '', rep, t('hud.reputation')));
    rep.dataset.key = 'hud.reputation';
    this.pips = el('span', 'pips', rep);
    this.hints = button(r, '', () => app.act('hints'));
    this.pauseBtn = button(r, t('hud.pause'), () => app.act('pause'));
  }

  refresh(run: Run | null): void {
    this.labels.forEach((s) => { s.textContent = t((s.parentElement as HTMLElement).dataset.key ?? ''); });
    this.pauseBtn.textContent = t('hud.pause');
    this.root.textContent = t('hud.root');
    this.last = '';
    if (run) this.frame(run);
  }

  start(run: Run): void {
    this.root.style.display = run.state.cfg.root ? '' : 'none';
    this.hints.style.display = run.state.cfg.root ? 'none' : '';
    this.last = '';
  }

  event(ev: RunEvent, run: Run): void {
    if (ev.type === 'reputation' || ev.type === 'waveStarted') { this.last = ''; this.frame(run); }
  }

  frame(run: Run | null): void {
    if (!run) return;
    const s = run.state;
    const secs = Math.max(0, Math.ceil(s.timeLeft));
    const key = `${s.wave}|${secs}|${s.score}|${s.credits}|${s.rep}|${s.hints}`;
    if (key === this.last) return;
    this.last = key;
    const name = loc(run.waveDef.name);
    const n = s.cfg.mode === 'campaign' ? `${s.wave}/${CAMPAIGN.length}` : `${s.wave}`;
    this.waveEl.replaceChildren(`${t('hud.wave')} `, el('b', '', undefined, n), ' · ', el('b', '', undefined, name), ' · ', el('b', '', undefined, `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`));
    this.score.textContent = fmtNum(s.score);
    this.credits.textContent = fmtNum(s.credits);
    this.pips.innerHTML = Array.from({ length: MAX_REP }, (_, i) => `<i class="${i < s.rep ? '' : 'off'}"></i>`).join('');
    this.hints.textContent = s.hints ? t('hud.hintsOn') : t('hud.hintsOff');
    this.hints.classList.toggle('on', s.hints);
  }
}

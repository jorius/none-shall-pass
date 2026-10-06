// i18n
import { fmtNum, t } from '../i18n';

// local
import type { Bests } from '../storage';
import { button, el } from './dom';

export interface TitleDeps {
  bests: Bests;
  root: boolean;
  play(): void;
  overtime(): void;
  howto(): void;
  toggleLang(): void;
}

export const renderTitle = (box: HTMLElement, d: TitleDeps): void => {
  box.innerHTML = '';
  el('h1', '', box, 'NONE SHALL PASS');
  el('p', '', box, t('title.tagline'));
  if (d.root) el('div', 'badge-root', box, t('title.rootOn'));
  const btns = el('div', 'row-btns', box);
  button(btns, 'btn', t('title.play'), d.play);
  button(btns, 'btn ghost', t('title.overtime'), d.overtime).disabled = !d.bests.won;
  button(btns, 'btn ghost', t('title.howto'), d.howto);
  button(btns, 'btn ghost', t('lang.toggle'), d.toggleLang);
  if (!d.bests.won) el('div', 'note', box, `${t('title.overtime')}: ${t('title.overtimeLocked')}`);
  const slot = d.root ? 'root' : 'normal';
  const c = d.bests.campaign[slot], o = d.bests.overtime[slot];
  if (c || o) {
    const best = el('div', 'best', box);
    best.append(el('b', '', undefined, `${t('title.best')} `));
    if (c) best.append(el('div', '', undefined, t('title.bestCampaign', { g: c.grade, s: fmtNum(c.score) })));
    if (o) best.append(el('div', '', undefined, t('title.bestOvertime', { w: o.wave, s: fmtNum(o.score) })));
  }
  const a = el('a', 'sitelink', box, t('title.site'));
  a.href = 'https://jorius.github.io/';
  a.target = '_blank';
  a.rel = 'noopener';
};

export const renderHowto = (box: HTMLElement, back: () => void): void => {
  box.innerHTML = '';
  el('h2', '', box, t('howto.title'));
  const grid = el('div', 'howto-grid', box);
  const rows: [string, string][] = [
    ['↑ ↓', 'howto.k1'], ['Tab', 'howto.k2'], [t('howto.space'), 'howto.k3'], ['Esc', 'howto.k4'],
    [t('howto.click'), 'howto.k5'], ['H', 'howto.k6'], ['P', 'howto.k7'],
  ];
  for (const [k, key] of rows) { el('kbd', '', grid, k); el('span', '', grid, t(key)); }
  el('p', '', box, t('howto.lesson'));
  button(box, 'btn', t('howto.back'), back);
};

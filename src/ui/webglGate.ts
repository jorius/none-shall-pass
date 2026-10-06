// i18n
import { t } from '../i18n';

// local
import { el } from './dom';

// Phaser 4 draws with WebGL only: a browser without it (or with it switched off) gets a card, like a phone does,
// instead of a blank page. A probe that throws counts as no WebGL; Phaser's own would throw the same way.
export const shouldGateWebgl = (canvas: { getContext(kind: string): unknown }): boolean => {
  try { return !(canvas.getContext('webgl2') ?? canvas.getContext('webgl')); } catch { return true; }
};

// The same card, with a generic message, answers a boot that failed for any other reason.
export const renderWebglGate = (root: HTMLElement, reason: 'webgl' | 'boot' = 'webgl'): void => {
  root.innerHTML = '';
  const g = el('div', 'gate', root);
  el('h1', '', g, 'NONE SHALL PASS');
  el('h2', '', g, reason === 'webgl' ? t('webgl.title') : t('boot.title'));
  el('p', '', g, reason === 'webgl' ? t('webgl.body') : t('boot.body'));
  const a = el('a', '', g, t('title.site'));
  a.href = 'https://jorius.github.io/';
};

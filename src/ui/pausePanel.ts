// i18n
import { t } from '../i18n';

// local
import { button, el } from './dom';

export const renderPause = (box: HTMLElement, d: { reduced: boolean; resume(): void; quit(): void; toggleLang(): void; toggleReduced(): void }): void => {
  box.innerHTML = '';
  el('h2', '', box, t('pause.title'));
  el('p', '', box, t('pause.hint'));
  const row = el('div', 'row-btns', box);
  button(row, 'btn', t('pause.resume'), d.resume);
  button(row, 'btn ghost', t('pause.quit'), d.quit);
  button(row, 'btn ghost', t('lang.toggle'), d.toggleLang);
  button(row, 'btn ghost', d.reduced ? t('pause.reducedOn') : t('pause.reducedOff'), d.toggleReduced);
};

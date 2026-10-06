// audio
import type { AudioPrefs } from '../audio';

// i18n
import { t } from '../i18n';

// local
import { button, el } from './dom';

export const renderPause = (box: HTMLElement, d: {
  reduced: boolean; audio: { sound: boolean; music: boolean; volume: AudioPrefs['volume'] };
  resume(): void; quit(): void; armory(): void; toggleLang(): void; toggleReduced(): void;
  toggleSound(): void; toggleMusic(): void; cycleVolume(): void;
}): void => {
  box.innerHTML = '';
  el('h2', '', box, t('pause.title'));
  el('p', '', box, t('pause.hint'));
  const row = el('div', 'row-btns', box);
  button(row, 'btn', t('pause.resume'), d.resume);
  button(row, 'btn ghost', t('pause.quit'), d.quit);
  button(row, 'btn ghost', t('pause.armory'), d.armory);
  button(row, 'btn ghost', t('lang.toggle'), d.toggleLang);
  button(row, 'btn ghost', d.reduced ? t('pause.reducedOn') : t('pause.reducedOff'), d.toggleReduced);
  // The sound switches on a row of their own, after the rest: eight buttons in one would run the Spanish menu out to the screen's edges.
  const sound = el('div', 'row-btns', box);
  const state = (on: boolean): string => t(on ? 'pause.on' : 'pause.off');
  button(sound, 'btn ghost', t('pause.sound', { s: state(d.audio.sound) }), d.toggleSound);
  button(sound, 'btn ghost', t('pause.music', { s: state(d.audio.music) }), d.toggleMusic);
  button(sound, 'btn ghost', t('pause.volume', { n: d.audio.volume }), d.cycleVolume);
};

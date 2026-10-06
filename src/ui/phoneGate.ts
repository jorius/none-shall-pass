// i18n
import { t } from '../i18n';

// local
import { el } from './dom';

// The device decides, not the window: a touch-only device, or a screen whose short side is phone-sized
// (in case it misreports its pointer). A desktop window snapped narrow still has a keyboard and plays, scaled down.
export const shouldGate = (screenShortSide: number, coarseOnly: boolean): boolean => coarseOnly || screenShortSide < 600;

export const renderPhoneGate = (root: HTMLElement): void => {
  root.innerHTML = '';
  const g = el('div', 'gate', root);
  el('h1', '', g, 'NONE SHALL PASS');
  el('h2', '', g, t('phone.title'));
  el('p', '', g, t('phone.body'));
  const b = el('button', 'btn', g, t('phone.copy'));
  // A refused clipboard leaves the button as it was; the address bar still has the link.
  b.onclick = () => { void navigator.clipboard?.writeText(location.href).then(() => { b.textContent = t('phone.copied'); }, () => undefined); };
  const a = el('a', '', g, t('title.site'));
  a.href = 'https://jorius.github.io/';
};

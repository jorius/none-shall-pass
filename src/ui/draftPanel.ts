// core
import { PRICE, REROLL_COST } from '../core/draft';
import type { Run } from '../core/run';
import { repCap } from '../core/state';

// art
import { iconUrl } from '../art/dataurl';

// i18n
import { fmtNum, loc, t } from '../i18n';

// local
import { button, el } from './dom';

const GLYPH = { KNIGHT: '♞', FIREWALL: '▦', SERVER: '◆' } as const;

// A pick or a reroll redraws the panel at once, so a second click lands on the redrawn button;
// the core refuses a second take of the same card and any spend past the credits (Task 8).
export const renderDraft = (box: HTMLElement, run: Run, act: { pick(i: number): void; reroll(): void; next(): void }): void => {
  const s = run.state, d = s.draft;
  box.innerHTML = '';
  if (!d) return;
  el('h2', '', box, t('draft.waveClear', { n: s.wave }));
  el('p', '', box, t('draft.stats', { u: s.uptime, r: s.rep, cap: repCap(s.cfg), c: fmtNum(s.credits) }));
  // A wave with mistakes had its recap just before; a clean one says so here instead.
  if (!s.waveMistakes.length) el('p', 'note', box, t('draft.clean'));
  const head = el('div', 'draft-h', box, `${t('draft.choose')} · `);
  el('span', '', head, d.free ? t('draft.freeNote') : t('draft.buyNote'));
  const cards = el('div', 'cards', box);
  d.picks.forEach((c, i) => {
    const taken = d.taken.includes(c.id);
    const card = el('div', `ucard ${c.rarity}${taken ? ' taken' : ''}`, cards);
    const h = el('div', 'uhead', card);
    el('span', `ucat ${c.cat}`, h, `${GLYPH[c.cat]} ${t(`draft.cat.${c.cat}`)}`);
    el('span', `urar ${c.rarity}`, h, t(`draft.rarity.${c.rarity}`));
    const icon = el('div', 'uicon', card);
    const img = el('img', 'px', icon);
    img.src = iconUrl(c.icon, 'card');
    img.alt = '';
    el('div', 'uname', card, loc(c.name));
    el('p', 'udoes', card, loc(c.does));
    const irl = el('p', 'uirl', card);
    irl.append(el('b', '', undefined, t('inspector.irl')), ` ${loc(c.irl)}`);
    const cat = el('p', 'ucatch', card);
    cat.append(el('b', '', undefined, t('inspector.catch')), ` ${loc(c.catch)}`);
    const price = PRICE[c.rarity];
    const btn = button(card, taken || !d.free ? 'btn ghost' : 'btn',
      taken ? t('draft.taken') : d.free ? t('draft.take') : t('draft.buy', { n: fmtNum(price) }), () => act.pick(i));
    btn.disabled = taken || (!d.free && s.credits < price);
  });
  const foot = el('div', 'foot', box);
  const row = el('div', 'row-btns', foot);
  button(row, 'btn ghost', t('draft.reroll', { n: REROLL_COST }), act.reroll).disabled = s.credits < REROLL_COST;
  button(row, 'btn', t('draft.next'), act.next);
  // The Armory's key hangs off the end of the buttons (styles.css): the tallest Spanish hand leaves this screen 3px to spare, so it takes no row.
  el('p', 'note', foot, t('draft.armoryHint'));
};

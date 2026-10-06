// core
import { CARDS, cardById, STARTING_LOADOUT, type Card, type CardId, type Category } from '../core/content/cards';
import { PRICE } from '../core/draft';

// art
import { iconUrl } from '../art/dataurl';

// i18n
import { fmtNum, loc, t } from '../i18n';

// local
import { button, el } from './dom';
import { familyOf, type Family } from './loadout';

export type ArmoryState = 'owned' | 'start' | 'draft' | 'locked' | 'oneShot';
export interface ArmoryLevel { id: CardId; owned: boolean; next: boolean; price: number }
// One upgrade of the Armory. A chain (Destrier, Observability) is one entry: its first level opens it and `levels` holds all of them.
// `price` is what the next level costs (a single card's own price when there is none), `needs` the card a locked one waits for.
export interface ArmoryEntry { id: CardId; family: Family | null; levels: ArmoryLevel[]; state: ArmoryState; needs?: CardId; price: number }
export interface ArmoryDeps { owned: CardId[]; credits: number; close(): void }

// Every upgrade once, in the order the cards are listed. A level is the next to buy when it is not owned yet and what it needs is
// (the draft deals by the same rule). `cards` is only a seam for tests: nothing in the game ships a card that waits for another one
// outside a chain, so the locked state could not be reached with the real list.
export const armoryEntries = (owned: readonly CardId[], cards: readonly Card[] = CARDS): ArmoryEntry[] => {
  const has = (id: CardId): boolean => owned.includes(id);
  const entries: ArmoryEntry[] = [];
  for (const card of cards) {
    const family = familyOf(card.id);
    if (family && entries.some((e) => e.family === family)) continue;
    const levels = family
      ? cards.filter((c) => familyOf(c.id) === family).map((c) => ({ id: c.id, owned: has(c.id), next: !has(c.id) && (!c.req || has(c.req)), price: PRICE[c.rarity] }))
      : [];
    const lit = family ? levels.some((l) => l.owned) : has(card.id);
    const state: ArmoryState = card.id === 'backup' ? 'oneShot' : STARTING_LOADOUT.includes(card.id) ? 'start' : lit ? 'owned' : card.req && !has(card.req) ? 'locked' : 'draft';
    entries.push({ id: card.id, family, levels, state, price: levels.find((l) => l.next)?.price ?? PRICE[card.rarity], ...(state === 'locked' ? { needs: card.req } : {}) });
  }
  return entries;
};

// The level a chain is on: the highest owned, or the first while it holds none.
const levelOf = (e: ArmoryEntry): number => Math.max(1, e.levels.reduce((n, l, i) => (l.owned ? i + 1 : n), 0));
// The card whose text the entry tells: that level's, or the card itself.
const shown = (e: ArmoryEntry): Card => cardById(e.levels.length ? e.levels[levelOf(e) - 1].id : e.id);
// A chain goes by its name without the level or its tag: "Observability I · logs" is Observability.
const nameOf = (e: ArmoryEntry): string => {
  const name = loc(cardById(e.id).name);
  return e.family ? name.split(' ·')[0].replace(/\s+I$/, '') : name;
};

// The state line of a card and of its detail: what the run holds, what the draft would charge, or what it waits for.
export const stateText = (e: ArmoryEntry): string => {
  switch (e.state) {
    case 'owned': return e.family ? `${t('armory.stOwned')} · ${t('armory.level', { l: levelOf(e), n: e.levels.length })}` : t('armory.stOwned');
    case 'start': return t('armory.stStart');
    case 'draft': return t('armory.stDraft', { n: fmtNum(e.price) });
    case 'oneShot': return t('armory.stOneShot', { n: fmtNum(e.price) });
    case 'locked': return t('armory.stLocked', { name: e.needs ? loc(cardById(e.needs).name) : '' });
  }
};

const COLUMNS: readonly (readonly [Category, string])[] = [['KNIGHT', 'armory.knightIntro'], ['FIREWALL', 'armory.firewallIntro'], ['SERVER', 'armory.serverIntro']];

// A read-only codex: three branches of cards (buttons, so Tab walks them) and a detail panel that follows the hovered or focused one.
// It shows and never sells. CLOSE has the focus for everyone, so Space, Enter, T and Esc all put it away.
export const renderArmory = (box: HTMLElement, d: ArmoryDeps): void => {
  box.innerHTML = '';
  const entries = armoryEntries(d.owned);
  const ar = el('div', 'ar', box);
  const head = el('div', 'ar-head', ar);
  el('h4', '', head, t('armory.title'));
  el('span', 'n', head, t('armory.owned', { n: entries.filter((e) => e.state === 'owned' || e.state === 'start').length, total: entries.length }));
  el('span', 'cr', head, `${t('hud.credits')} ${fmtNum(d.credits)}`);
  const close = button(head, 'btn ghost', t('armory.close'), d.close);
  const body = el('div', 'ar-body', ar);
  const detail = el('div', 'ar-detail');
  let sel: HTMLElement | null = null;

  const fill = (e: ArmoryEntry, card: HTMLElement): void => {
    const c = shown(e);
    sel?.classList.remove('sel');
    sel = card;
    card.classList.add('sel');
    detail.replaceChildren();
    // Branch · rarity · level, each bit holding the dot that follows it (and not breaking inside), so a long line wraps after a dot.
    const kicker = [t(`draft.cat.${c.cat}`), t(`draft.rarity.${c.rarity}`), ...(e.family ? [t('armory.level', { l: levelOf(e), n: e.levels.length })] : [])];
    const k = el('div', 'k', detail);
    kicker.forEach((bit, i) => {
      if (i) k.append(' ');
      el('span', '', k, i < kicker.length - 1 ? `${bit} ·` : bit);
    });
    el('h6', '', detail, loc(c.name));
    el('p', '', detail, loc(c.does));
    el('p', 'dim', detail).append(el('b', 'irl', undefined, t('inspector.irl')), ` ${loc(c.irl)}`);
    el('p', 'dim', detail).append(el('b', 'catch', undefined, t('inspector.catch')), ` ${loc(c.catch)}`);
    el('div', e.state === 'owned' || e.state === 'start' ? 'stat owned' : 'stat', detail, stateText(e));
  };

  let first: (() => void) | null = null;
  for (const [cat, intro] of COLUMNS) {
    const col = el('div', `ar-col ${cat}`, body);
    el('h5', '', col).append(el('b', '', undefined, t(`draft.cat.${cat}`)), ` · ${t(intro)}`);
    const cards = el('div', 'ar-cards', col);
    for (const e of entries.filter((x) => cardById(x.id).cat === cat)) {
      const c = shown(e);
      const card = button(cards, `cx ${c.rarity} ${e.state}`, '', () => fill(e, card));
      card.dataset.id = e.id;
      const img = el('img', 'px', el('span', 'ic', card));
      img.src = iconUrl(c.icon, 'tile');
      img.alt = '';
      const nm = el('span', 'nm', card, nameOf(e));
      // A chain wears its level: three pips, lit for the levels owned.
      if (e.family) { const pips = el('span', 'lvl', nm); for (const l of e.levels) el('i', l.owned ? 'on' : '', pips); }
      el('span', e.family ? 'ds short' : 'ds', card, loc(c.does));
      el('span', 'st', card, stateText(e));
      // Its levels inside the card: owned ones green, the next one lit, each priced until it is owned.
      if (e.levels.length) {
        const tiers = el('span', 'tiers', card);
        e.levels.forEach((l, i) => {
          const row = el('span', l.owned ? 'on' : l.next ? 'next' : '', tiers);
          el('b', '', row, 'I'.repeat(i + 1));
          el('span', 'tx', row, loc(cardById(l.id).does));
          if (!l.owned) el('span', 'pr', row, fmtNum(l.price));
        });
      }
      card.addEventListener('mouseenter', () => fill(e, card));
      card.addEventListener('focus', () => fill(e, card));
      first ??= () => fill(e, card);
    }
  }
  body.append(detail);
  // It opens on the first card, so the panel is never empty.
  first?.();
  close.focus();
};

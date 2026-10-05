// core
import { CARDS, cardById, type Card, type CardId, type Rarity } from './content/cards';
import type { Rng } from './rng';

export const PRICE: Record<Rarity, number> = { COMMON: 250, RARE: 600, LEGENDARY: 1000 };
export const REROLL_COST = 150;
const WEIGHT: Record<Rarity, number> = { COMMON: 5, RARE: 3, LEGENDARY: 1 };

export const eligible = (owned: readonly CardId[], exclude: readonly CardId[]): Card[] =>
  CARDS.filter((c) => (c.id === 'backup' || !owned.includes(c.id)) && (!c.req || owned.includes(c.req)) && !exclude.includes(c.id));

const weighted = (rng: Rng, pool: Card[]): Card => {
  let r = rng() * pool.reduce((a, c) => a + WEIGHT[c.rarity], 0);
  for (const c of pool) { r -= WEIGHT[c.rarity]; if (r < 0) return c; }
  return pool[pool.length - 1];
};

export const deal = (rng: Rng, owned: readonly CardId[], exclude: readonly CardId[], guaranteed: CardId[] = []): Card[] => {
  const pool = eligible(owned, exclude);
  const hand: Card[] = guaranteed.filter((id) => pool.some((c) => c.id === id)).map(cardById);
  while (hand.length < 3) {
    const left = pool.filter((c) => !hand.includes(c));
    if (!left.length) break;
    hand.push(weighted(rng, left));
  }
  return hand;
};

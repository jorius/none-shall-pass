// packages
import { describe, expect, it } from 'vitest';

// core
import { CARDS, cardById, STARTING_LOADOUT } from './cards';

describe('card catalogue', () => {
  it('has the eighteen cards, unique', () => {
    const ids = CARDS.map((c) => c.id);
    expect(ids).toHaveLength(18);
    expect(new Set(ids).size).toBe(18);
    expect(ids).toEqual(expect.arrayContaining(['destrier', 'destrier2', 'destrier3', 'squire', 'lens', 'obs1', 'obs2', 'obs3', 'lockdown', 'quote', 'f2b', 'tarpit', 'cdn', 'prepared', 'sortlist', 'mfa', 'csp', 'backup']));
  });

  it('chains observability through prerequisites', () => {
    expect(cardById('obs1').req).toBeUndefined();
    expect(cardById('obs2').req).toBe('obs1');
    expect(cardById('obs3').req).toBe('obs2');
  });

  it('writes every text in both languages', () => {
    for (const c of CARDS) for (const f of [c.name, c.does, c.irl, c.catch]) {
      expect(f.en.length).toBeGreaterThan(1);
      expect(f.es.length).toBeGreaterThan(1);
    }
  });

  it('starts every run with port lockdown', () => {
    expect(STARTING_LOADOUT).toEqual(['lockdown']);
  });

  it('throws on unknown ids', () => {
    expect(() => cardById('nope' as never)).toThrow();
  });

  it('levels the Destrier in three cards that require each other', () => {
    const d1 = cardById('destrier'), d2 = cardById('destrier2'), d3 = cardById('destrier3');
    expect(d1.req).toBeUndefined();
    expect(d2.req).toBe('destrier');
    expect(d3.req).toBe('destrier2');
    expect([d1.rarity, d2.rarity, d3.rarity]).toEqual(['LEGENDARY', 'RARE', 'LEGENDARY']);
    expect(d1.does.en).toMatch(/70%/);
    expect(d2.does.en).toMatch(/50%/);
    expect(d3.does.en).toMatch(/\bC\b/);
    for (const c of [d1, d2, d3]) { expect(c.icon).toBe('horse'); expect(c.cat).toBe('KNIGHT'); }
  });
});

// packages
import { describe, expect, it } from 'vitest';

// core
import { CARDS, cardById, STARTING_LOADOUT } from './cards';

describe('card catalogue', () => {
  it('has the sixteen v1 cards, unique', () => {
    const ids = CARDS.map((c) => c.id);
    expect(ids).toHaveLength(16);
    expect(new Set(ids).size).toBe(16);
    expect(ids).toEqual(expect.arrayContaining(['destrier', 'squire', 'lens', 'obs1', 'obs2', 'obs3', 'lockdown', 'quote', 'f2b', 'tarpit', 'cdn', 'prepared', 'sortlist', 'mfa', 'csp', 'backup']));
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
});

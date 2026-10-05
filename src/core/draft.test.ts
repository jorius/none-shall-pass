// packages
import { describe, expect, it } from 'vitest';

// core
import { deal, eligible, PRICE, REROLL_COST } from './draft';
import { mulberry32 } from './rng';

describe('draft', () => {
  it('prices by rarity', () => {
    expect(PRICE).toEqual({ COMMON: 250, RARE: 600, LEGENDARY: 1000 });
    expect(REROLL_COST).toBe(150);
  });

  it('hides owned cards except backup, and gates prerequisites', () => {
    const ids = eligible(['lockdown', 'backup'], []).map((c) => c.id);
    expect(ids).not.toContain('lockdown');
    expect(ids).toContain('backup');
    expect(ids).not.toContain('obs2');
    expect(eligible(['obs1'], []).map((c) => c.id)).toContain('obs2');
    expect(eligible(['obs1'], ['obs2']).map((c) => c.id)).not.toContain('obs2');
  });

  it('deals three distinct cards, guaranteed ones first, deterministically', () => {
    const a = deal(mulberry32(5), ['lockdown'], [], ['destrier', 'obs1']);
    const b = deal(mulberry32(5), ['lockdown'], [], ['destrier', 'obs1']);
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
    expect(a[0].id).toBe('destrier');
    expect(a[1].id).toBe('obs1');
    expect(new Set(a.map((c) => c.id)).size).toBe(3);
  });

  it('skips guaranteed cards that are owned or excluded', () => {
    const hand = deal(mulberry32(9), ['lockdown', 'destrier'], ['obs1'], ['destrier', 'obs1']);
    expect(hand.map((c) => c.id)).not.toContain('destrier');
    expect(hand.map((c) => c.id)).not.toContain('obs1');
    expect(hand.length).toBe(3);
  });

  it('deals fewer than three when the pool runs dry', () => {
    const all = ['destrier', 'squire', 'lens', 'obs1', 'obs2', 'obs3', 'lockdown', 'quote', 'f2b', 'tarpit', 'cdn', 'prepared', 'sortlist', 'mfa', 'csp'] as const;
    expect(deal(mulberry32(1), [...all], []).map((c) => c.id)).toEqual(['backup']);
  });
});

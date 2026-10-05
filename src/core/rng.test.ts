// packages
import { describe, expect, it } from 'vitest';

// core
import { docIp, mulberry32, pick } from './rng';

describe('mulberry32', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
    const sa = Array.from({ length: 50 }, a), sb = Array.from({ length: 50 }, b), sc = Array.from({ length: 50 }, c);
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    for (const v of sa) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
});

describe('pick and docIp', () => {
  it('pick returns members of the array', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 30; i++) expect(['a', 'b', 'c']).toContain(pick(rng, ['a', 'b', 'c']));
  });
  it('docIp only produces documentation addresses', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      expect(docIp(rng)).toMatch(/^(192\.0\.2|198\.51\.100|203\.0\.113)\.(\d{1,3})$/);
      const last = Number(docIp(rng).split('.').pop());
      expect(last).toBeGreaterThanOrEqual(2);
      expect(last).toBeLessThanOrEqual(251);
    }
  });
});

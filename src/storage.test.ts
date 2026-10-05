// packages
import { describe, expect, it } from 'vitest';

// local
import type { RunResult } from './core/score';
import { createStore } from './storage';

const memory = (): Storage => {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => { m.delete(k); },
    setItem: (k, v) => { m.set(k, String(v)); },
  };
};

const throwing: Storage = {
  length: 0, clear() { throw new Error('blocked'); }, getItem() { throw new Error('blocked'); }, key() { return null; },
  removeItem() { throw new Error('blocked'); }, setItem() { throw new Error('QuotaExceeded'); },
};

const result = (over: Partial<RunResult>): RunResult => ({
  mode: 'campaign', root: false, tampered: false, won: true, reason: 'won', score: 1000, wave: 6, wavesCleared: 6, uptime: 90, rep: 10,
  stats: { hits: { 1: 0, 2: 0, 3: 0 }, squireHits: 0, ruleBlocks: 0, served: 0, decoysKept: 0, neutralized: 0, falsePositives: 0, breaches: { sqli: 0, xss: 0, brute: 0, scan: 0, flood: 0 }, wavesCleared: 6 },
  ...over,
});

describe('store', () => {
  it('records campaign bests per mode and marks the campaign as won', () => {
    const st = createStore(memory());
    expect(st.recordResult(result({ score: 1000 })).newBest).toBe(true);
    expect(st.recordResult(result({ score: 500 })).newBest).toBe(false);
    expect(st.recordResult(result({ score: 2000, root: true })).newBest).toBe(true);
    const b = st.bests();
    expect(b.campaign.normal?.score).toBe(1000);
    expect(b.campaign.root?.score).toBe(2000);
    expect(b.won).toBe(true);
  });

  it('records overtime by wave, then score', () => {
    const st = createStore(memory());
    st.recordResult(result({ mode: 'overtime', wave: 4, score: 9000, won: false, reason: 'serverDown' }));
    expect(st.recordResult(result({ mode: 'overtime', wave: 5, score: 100, won: false, reason: 'serverDown' })).newBest).toBe(true);
    expect(st.bests().overtime.normal).toEqual({ wave: 5, score: 100 });
  });

  it('never saves tampered runs', () => {
    const st = createStore(memory());
    expect(st.recordResult(result({ tampered: true, score: 99999 })).newBest).toBe(false);
    expect(st.bests().campaign.normal).toBeUndefined();
    expect(st.bests().won).toBe(false);
  });

  it('survives a blocked backend and garbage data', () => {
    const st = createStore(throwing);
    expect(st.recordResult(result({})).newBest).toBe(true);
    expect(st.bests().campaign.normal?.score).toBe(1000);
    st.setPrefs({ lang: 'es' });
    expect(st.prefs().lang).toBe('es');
    const m = memory();
    m.setItem('nsp.v1', '{not json');
    expect(createStore(m).bests()).toEqual({ campaign: {}, overtime: {}, won: false });
    expect(createStore(null).prefs()).toEqual({});
  });

  it('persists prefs across instances', () => {
    const m = memory();
    createStore(m).setPrefs({ hints: true, lang: 'en' });
    expect(createStore(m).prefs()).toEqual({ hints: true, lang: 'en' });
  });
});

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

  it('remembers bests and their grade across instances, and only a win marks the campaign won', () => {
    const m = memory();
    const st = createStore(m);
    st.recordResult(result({ won: false, reason: 'serverDown', uptime: 0, score: 700 }));
    expect(st.bests().won).toBe(false);
    st.recordResult(result({ score: 1200 }));
    st.recordResult(result({ mode: 'overtime', wave: 3, score: 50, won: false, reason: 'serverDown' }));
    expect(createStore(m).bests()).toEqual({ campaign: { normal: { score: 1200, grade: 'S' } }, overtime: { normal: { wave: 3, score: 50 } }, won: true });
  });

  it('breaks an overtime wave tie on score', () => {
    const st = createStore(memory());
    const ot = (wave: number, score: number): RunResult => result({ mode: 'overtime', wave, score, won: false, reason: 'serverDown' });
    st.recordResult(ot(5, 100));
    expect(st.recordResult(ot(5, 90)).newBest).toBe(false);
    expect(st.recordResult(ot(5, 200)).newBest).toBe(true);
    expect(st.recordResult(ot(4, 9000)).newBest).toBe(false);
    expect(st.bests().overtime.normal).toEqual({ wave: 5, score: 200 });
  });
});

// Swaps the global localStorage for one test and always puts the original back.
const withGlobalStorage = (desc: PropertyDescriptor, fn: () => void): void => {
  const prev = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, ...desc });
  try {
    fn();
  } finally {
    if (prev) Object.defineProperty(globalThis, 'localStorage', prev);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
};

describe('store against a hostile browser', () => {
  it('uses the browser localStorage by default', () => {
    const m = memory();
    withGlobalStorage({ value: m }, () => { createStore().setPrefs({ hints: true }); });
    expect(createStore(m).prefs()).toEqual({ hints: true });
  });

  it('plays on when merely reading localStorage throws', () => {
    // Sandboxed iframes and blocked site data throw from the localStorage getter itself, before any call.
    withGlobalStorage({ get() { throw new DOMException('denied', 'SecurityError'); } }, () => {
      const st = createStore();
      expect(st.recordResult(result({})).newBest).toBe(true);
      expect(st.bests().campaign.normal?.score).toBe(1000);
    });
  });

  it('drops saved values of the wrong shape and keeps the rest', () => {
    const m = memory();
    m.setItem('nsp.v1', JSON.stringify({
      bests: {
        campaign: { normal: { score: 'lots', grade: 'S' }, root: { score: 4000, grade: 'A' } },
        overtime: { normal: { wave: null, score: 1 }, root: 7 },
        won: 'yes',
      },
      prefs: { lang: 'fr', hints: 'yes', reducedFx: true },
    }));
    const st = createStore(m);
    expect(st.bests()).toEqual({ campaign: { root: { score: 4000, grade: 'A' } }, overtime: {}, won: false });
    expect(st.prefs()).toEqual({ reducedFx: true });
    expect(st.recordResult(result({ score: 10 })).newBest).toBe(true);
    for (const raw of ['null', '[]', '"x"', '42', '{"bests":"x","prefs":[true]}', '{"bests":{"campaign":{"normal":{"score":5,"grade":"Z"}}}}']) {
      m.setItem('nsp.v1', raw);
      expect(createStore(m).bests()).toEqual({ campaign: {}, overtime: {}, won: false });
      expect(createStore(m).prefs()).toEqual({});
    }
  });

  it('keeps boolean prefs it does not know yet', () => {
    // Later prefs (the coach's seen-flag) are booleans too, so they survive without touching the validator.
    const m = memory();
    m.setItem('nsp.v1', '{"prefs":{"lang":"es","coached":true}}');
    expect(createStore(m).prefs()).toEqual({ lang: 'es', coached: true });
  });
});

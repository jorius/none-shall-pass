// packages
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// local
import en from './en.json';
import es from './es.json';
import { detectLang, fmtNum, loc, setLang, t } from './index';

const flatten = (o: object, prefix = ''): Record<string, string> =>
  Object.entries(o).reduce<Record<string, string>>((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') acc[key] = v; else Object.assign(acc, flatten(v as object, key));
    return acc;
  }, {});

const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') && !p.endsWith('.test.ts') ? [p] : [];
});

afterEach(() => setLang('en'));

describe('locales', () => {
  it('have the same keys and placeholders', () => {
    const a = flatten(en), b = flatten(es);
    expect(Object.keys(b).sort()).toEqual(Object.keys(a).sort());
    for (const k of Object.keys(a)) {
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
      expect(ph(b[k]), k).toEqual(ph(a[k]));
    }
  });

  it('define every key the code asks for', () => {
    const keys = flatten(en);
    for (const f of files(join(import.meta.dirname, '..'))) {
      for (const m of readFileSync(f, 'utf8').matchAll(/\bt\('([\w.]+)'/g)) expect(keys, `${f}: ${m[1]}`).toHaveProperty([m[1]]);
    }
  });
});

describe('t', () => {
  it('interpolates, switches language and falls back to the key', () => {
    expect(t('draft.waveClear', { n: 3 })).toBe('WAVE 3 CLEAR');
    setLang('es');
    expect(t('draft.waveClear', { n: 3 })).toBe('OLEADA 3 SUPERADA');
    expect(t('no.such.key')).toBe('no.such.key');
    expect(loc({ en: 'a', es: 'b' })).toBe('b');
    expect(fmtNum(18420)).toBe('18.420');
    setLang('en');
    expect(fmtNum(18420)).toBe('18,420');
  });
  it('detects Spanish browsers', () => {
    expect(detectLang('es-CO')).toBe('es');
    expect(detectLang('en-US')).toBe('en');
    expect(detectLang('fr')).toBe('en');
  });
});

// core
import type { Lang, Localized } from '../core/types';

// local
import en from './en.json';
import es from './es.json';

type Dict = { [k: string]: string | Dict };
const DICTS: Record<Lang, Dict> = { en, es };
let current: Lang = 'en';
const listeners = new Set<(l: Lang) => void>();

const lookup = (d: Dict, key: string): string | undefined => {
  let v: string | Dict | undefined = d;
  for (const part of key.split('.')) v = typeof v === 'object' ? v[part] : undefined;
  return typeof v === 'string' ? v : undefined;
};

export const lang = (): Lang => current;

export const setLang = (l: Lang): void => {
  current = l;
  if (typeof document !== 'undefined') document.documentElement.lang = l;
  listeners.forEach((fn) => fn(l));
};

export const onLang = (fn: (l: Lang) => void): (() => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

export const detectLang = (nav: string = typeof navigator === 'undefined' ? 'en' : navigator.language): Lang =>
  nav.toLowerCase().startsWith('es') ? 'es' : 'en';

export const t = (key: string, vars?: Record<string, string | number>): string => {
  const raw = lookup(DICTS[current], key) ?? lookup(DICTS.en, key) ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
};

export const loc = (x: Localized): string => x[current];

export const fmtNum = (n: number): string =>
  current === 'es' ? String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : Math.round(n).toLocaleString('en-US');

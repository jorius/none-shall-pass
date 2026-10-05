// core
import { grade as gradeOf, type Grade, type RunResult } from './core/score';
import type { Lang } from './core/types';

export interface Bests {
  campaign: Partial<Record<'normal' | 'root', { score: number; grade: Grade }>>;
  overtime: Partial<Record<'normal' | 'root', { wave: number; score: number }>>;
  won: boolean;
}
export interface Prefs { lang?: Lang; hints?: boolean; reducedFx?: boolean }
interface Saved { bests: Bests; prefs: Prefs }

const KEY = 'nsp.v1';
const SLOTS = ['normal', 'root'] as const;
const GRADES: readonly string[] = ['S', 'A', 'B', 'C', 'D', 'F'] satisfies Grade[];
const empty = (): Saved => ({ bests: { campaign: {}, overtime: {}, won: false }, prefs: {} });

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

// A hand-edited or corrupted save keeps only the fields that still have the right shape.
const parse = (raw: string | null): Saved => {
  const out = empty();
  let v: unknown;
  try { v = raw ? JSON.parse(raw) : null; } catch { return out; }
  if (!isObj(v)) return out;
  const b = isObj(v.bests) ? v.bests : {};
  const camp = isObj(b.campaign) ? b.campaign : {}, over = isObj(b.overtime) ? b.overtime : {};
  for (const slot of SLOTS) {
    const c = camp[slot], o = over[slot];
    if (isObj(c) && isNum(c.score) && typeof c.grade === 'string' && GRADES.includes(c.grade)) {
      out.bests.campaign[slot] = { score: c.score, grade: c.grade as Grade };
    }
    if (isObj(o) && isNum(o.wave) && isNum(o.score)) out.bests.overtime[slot] = { wave: o.wave, score: o.score };
  }
  out.bests.won = b.won === true;
  // Every pref except the language is a flag, including ones added later.
  const prefs = out.prefs as Record<string, unknown>;
  for (const [k, x] of Object.entries(isObj(v.prefs) ? v.prefs : {})) {
    if (k === 'lang' ? x === 'en' || x === 'es' : typeof x === 'boolean') prefs[k] = x;
  }
  return out;
};

// Merely reading `localStorage` throws when the browser blocks site data or sandboxes the page.
const browserStorage = (): Storage | null => {
  try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
};

// localStorage can be missing, blocked, full or hold garbage; the game must play anyway.
export const createStore = (backend: Storage | null = browserStorage()) => {
  let data: Saved;
  try { data = parse(backend?.getItem(KEY) ?? null); } catch { data = empty(); }
  const save = (): void => { try { backend?.setItem(KEY, JSON.stringify(data)); } catch { /* keep in memory */ } };

  return {
    bests: (): Bests => data.bests,
    prefs: (): Prefs => ({ ...data.prefs }),
    setPrefs(p: Partial<Prefs>): void { data.prefs = { ...data.prefs, ...p }; save(); },
    recordResult(r: RunResult): { newBest: boolean } {
      if (r.tampered) return { newBest: false };
      const slot = r.root ? 'root' : 'normal';
      let newBest = false;
      if (r.mode === 'campaign') {
        if (r.won) data.bests.won = true;
        const prev = data.bests.campaign[slot];
        if (!prev || r.score > prev.score) {
          data.bests.campaign[slot] = { score: r.score, grade: gradeOf(r) ?? 'F' };
          newBest = true;
        }
      } else {
        const prev = data.bests.overtime[slot];
        if (!prev || r.wave > prev.wave || (r.wave === prev.wave && r.score > prev.score)) {
          data.bests.overtime[slot] = { wave: r.wave, score: r.score };
          newBest = true;
        }
      }
      save();
      return { newBest };
    },
  };
};

export type Store = ReturnType<typeof createStore>;

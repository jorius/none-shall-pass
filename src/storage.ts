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
const empty = (): Saved => ({ bests: { campaign: {}, overtime: {}, won: false }, prefs: {} });

const parse = (raw: string | null): Saved => {
  if (!raw) return empty();
  try {
    const v = JSON.parse(raw) as Partial<Saved>;
    const e = empty();
    return {
      bests: { campaign: { ...v.bests?.campaign }, overtime: { ...v.bests?.overtime }, won: v.bests?.won === true },
      prefs: { ...e.prefs, ...v.prefs },
    };
  } catch {
    return empty();
  }
};

// localStorage can be missing, blocked, full or hold garbage; the game must play anyway.
export const createStore = (backend: Storage | null = typeof localStorage === 'undefined' ? null : localStorage) => {
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

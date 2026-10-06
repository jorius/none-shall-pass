// core
import { KNIGHT_IDS, type KnightId } from './core/content/knights';
import { DIFFICULTY_IDS, type Difficulty } from './core/difficulty';
import { grade as gradeOf, type Grade, type RunResult } from './core/score';
import type { Lang } from './core/types';

// A best is kept per difficulty and root mode: 'analyst-normal', 'zeroday-root' and so on.
export type Slot = `${Difficulty}-${'normal' | 'root'}`;
export const slotOf = (r: { difficulty: Difficulty; root: boolean }): Slot => `${r.difficulty}-${r.root ? 'root' : 'normal'}`;

export interface Bests {
  campaign: Partial<Record<Slot, { score: number; grade: Grade }>>;
  overtime: Partial<Record<Slot, { wave: number; score: number }>>;
  won: boolean;
}
export interface Prefs { lang?: Lang; hints?: boolean; reducedFx?: boolean; coached?: boolean; knight?: KnightId; difficulty?: Difficulty; sound?: boolean; music?: boolean; volume?: 0 | 1 | 2 | 3 }
interface Saved { version: 2; bests: Bests; prefs: Prefs }

// The key never changed: a v1 save (no version, one difficulty) reads into the Analyst's slots and is written back as v2.
// Any other version, a later one included, takes the same path: its 'normal'/'root' go to the Analyst's slots, its other
// slot keys survive the rename untouched, and the next save rewrites it as version 2 (this build knows no newer schema).
const KEY = 'nsp.v1';
const SLOTS: readonly Slot[] = DIFFICULTY_IDS.flatMap((d) => [`${d}-normal`, `${d}-root`] as Slot[]);
const GRADES: readonly string[] = ['S', 'A', 'B', 'C', 'D', 'F'] satisfies Grade[];
const empty = (): Saved => ({ version: 2, bests: { campaign: {}, overtime: {}, won: false }, prefs: {} });

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isSlot = (k: string): k is Slot => (SLOTS as readonly string[]).includes(k);
const oneOf = (ids: readonly string[], x: unknown): boolean => typeof x === 'string' && ids.includes(x);
const isVolume = (x: unknown): x is 0 | 1 | 2 | 3 => Number.isInteger(x) && (x as number) >= 0 && (x as number) <= 3;
const isFlag = (x: unknown): boolean => typeof x === 'boolean';
// The prefs with a shape of their own; every other pref is a flag, including ones added later.
const PREF_SHAPE = new Map<string, (x: unknown) => boolean>([
  ['lang', (x) => x === 'en' || x === 'es'],
  ['knight', (x) => oneOf(KNIGHT_IDS, x)],
  ['difficulty', (x) => oneOf(DIFFICULTY_IDS, x)],
  ['volume', isVolume],
]);

// A hand-edited or corrupted save keeps only the fields that still have the right shape.
const parse = (raw: string | null): Saved => {
  const out = empty();
  let v: unknown;
  try { v = raw ? JSON.parse(raw) : null; } catch { return out; }
  if (!isObj(v)) return out;
  const b = isObj(v.bests) ? v.bests : {};
  const camp = isObj(b.campaign) ? b.campaign : {}, over = isObj(b.overtime) ? b.overtime : {};
  // Before v2 there was one difficulty, so a v1 save's two slots are the Analyst's.
  const v2 = v.version === 2;
  const rename = (k: string): string => (v2 ? k : k === 'normal' ? 'analyst-normal' : k === 'root' ? 'analyst-root' : k);
  for (const [k, c] of Object.entries(camp)) {
    const slot = rename(k);
    if (isSlot(slot) && isObj(c) && isNum(c.score) && typeof c.grade === 'string' && GRADES.includes(c.grade)) {
      out.bests.campaign[slot] = { score: c.score, grade: c.grade as Grade };
    }
  }
  for (const [k, o] of Object.entries(over)) {
    const slot = rename(k);
    if (isSlot(slot) && isObj(o) && isNum(o.wave) && isNum(o.score)) out.bests.overtime[slot] = { wave: o.wave, score: o.score };
  }
  out.bests.won = b.won === true;
  const prefs = out.prefs as Record<string, unknown>;
  for (const [k, x] of Object.entries(isObj(v.prefs) ? v.prefs : {})) {
    if ((PREF_SHAPE.get(k) ?? isFlag)(x)) prefs[k] = x;
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
      const slot = slotOf(r);
      let newBest = false;
      if (r.mode === 'campaign') {
        if (r.won) data.bests.won = true;
        const prev = data.bests.campaign[slot];
        // A win outranks any loss (only a loss grades F, so the saved grade tells which the best was);
        // between the same outcome the higher score wins, and a tie keeps what is there.
        const prevWon = !!prev && prev.grade !== 'F';
        if (!prev || (r.won !== prevWon ? r.won : r.score > prev.score)) {
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

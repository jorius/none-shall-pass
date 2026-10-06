// core
import { KNIGHTS, type KnightId } from './content/knights';
import type { Mode } from './content/waves';
import { DIFFICULTIES, type Difficulty } from './difficulty';
import { breachTotal, type EndReason, type RunState, type Stats } from './state';
import type { Lang } from './types';

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface RunResult {
  mode: Mode;
  difficulty: Difficulty;
  knight: KnightId;
  root: boolean;
  tampered: boolean;
  won: boolean;
  reason: EndReason;
  score: number;
  wave: number;
  wavesCleared: number;
  uptime: number;
  rep: number;
  stats: Stats;
}

export const SHARE_URL = 'jorius.github.io/none-shall-pass';

export const resultOf = (s: RunState): RunResult => ({
  mode: s.cfg.mode,
  difficulty: s.cfg.difficulty,
  knight: s.cfg.knight,
  root: s.cfg.root,
  tampered: s.tampered,
  won: s.endReason === 'won',
  reason: s.endReason ?? 'serverDown',
  score: s.score,
  wave: s.wave,
  wavesCleared: s.stats.wavesCleared,
  uptime: s.uptime,
  rep: s.rep,
  stats: s.stats,
});

export const grade = (r: RunResult): Grade | null => {
  if (r.mode === 'overtime') return null;
  if (!r.won) return 'F';
  const fp = r.stats.falsePositives, br = breachTotal(r.stats);
  if (r.uptime >= 90 && fp === 0 && br <= 1) return 'S';
  if (r.uptime >= 75 && fp <= 2) return 'A';
  if (r.uptime >= 50) return 'B';
  if (r.uptime >= 25) return 'C';
  return 'D';
};

const fmt = (n: number, lang: Lang): string => n.toLocaleString(lang === 'es' ? 'es-CO' : 'en-US');
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

// The line to paste: the result, then who held the gate and at what, then the ROOT and TAMPERED tags.
export const shareText = (r: RunResult, lang: Lang): string => {
  const tail = ` · ${KNIGHTS[r.knight].name[lang]} · ${DIFFICULTIES[r.difficulty].name[lang]}${r.root ? ' · ROOT' : ''}${r.tampered ? ' · TAMPERED' : ''}`;
  if (r.mode === 'overtime') {
    const head = lang === 'es' ? `⚔ NONE SHALL PASS · TIEMPO EXTRA — oleada ${r.wave}` : `⚔ NONE SHALL PASS · OVERTIME — wave ${r.wave}`;
    return `${head} · ${fmt(r.score, lang)} pts${tail}\n${SHARE_URL}`;
  }
  const g = grade(r);
  const br = breachTotal(r.stats), fp = r.stats.falsePositives;
  const body = lang === 'es'
    ? `Nota ${g} · ${fmt(r.score, lang)} pts · ${plural(br, 'brecha', 'brechas')} · ${plural(fp, 'usuario molesto', 'usuarios molestos')}`
    : `Grade ${g} · ${fmt(r.score, lang)} pts · ${plural(br, 'breach', 'breaches')} · ${plural(fp, 'angry user', 'angry users')}`;
  return `⚔ NONE SHALL PASS — ${body}${tail}\n${SHARE_URL}`;
};

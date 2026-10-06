// core
import { PKT_W, TAR_X0, TAR_X1 } from './constants';
import type { CardId } from './content/cards';
import type { Template } from './types';

export const owns = (owned: readonly CardId[], id: CardId): boolean => owned.includes(id);

export const obsLevel = (owned: readonly CardId[]): 0 | 1 | 2 | 3 =>
  owns(owned, 'obs3') ? 3 : owns(owned, 'obs2') ? 2 : owns(owned, 'obs1') ? 1 : 0;

export const destrierLevel = (owned: readonly CardId[]): 0 | 1 | 2 | 3 =>
  owns(owned, 'destrier3') ? 3 : owns(owned, 'destrier2') ? 2 : owns(owned, 'destrier') ? 1 : 0;

// Decoys are legit, so they never carry bugs: a clean packet only means "clean"
// once you own the level that would have flagged it.
export const isBugged = (t: Template, owned: readonly CardId[]): boolean =>
  t.kind !== 'legit' && (t.tier ?? 1) <= obsLevel(owned);

export const lockdownBlocks = (t: Template, owned: readonly CardId[]): boolean => owns(owned, 'lockdown') && t.kind === 'scan';

export const firewallRule = (p: { t: Template; src: string }, owned: readonly CardId[], fails: Record<string, number>): CardId | null => {
  if (owns(owned, 'cdn') && p.t.kind === 'flood') return 'cdn';
  if (owns(owned, 'quote') && p.t.raw.includes("'")) return 'quote';
  if (owns(owned, 'f2b') && p.t.lane <= 1 && (fails[p.src] ?? 0) >= 2) return 'f2b';
  return null;
};

export const serverFix = (t: Template, owned: readonly CardId[]): CardId | null => {
  if (t.kind === 'sqli') return t.orderBy ? (owns(owned, 'sortlist') ? 'sortlist' : null) : (owns(owned, 'prepared') ? 'prepared' : null);
  if (t.kind === 'brute') return owns(owned, 'mfa') ? 'mfa' : null;
  if (t.kind === 'xss') return owns(owned, 'csp') ? 'csp' : null;
  return null;
};

export const tarpitSlows = (p: { t: Template; src: string; x: number }, owned: readonly CardId[], seen: Record<string, number>): boolean =>
  owns(owned, 'tarpit') && p.t.lane === 1 && (seen[p.src] ?? 0) >= 2 && p.x + PKT_W > TAR_X0 && p.x < TAR_X1;

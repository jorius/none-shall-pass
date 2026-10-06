// core
import { BASE_SPEED, HINT_MULT, KN_X, LANE_H, PKT_Y, ROOT_MULT, ROOT_SPEED } from './constants';
import { STARTING_LOADOUT, type Card, type CardId } from './content/cards';
import type { KnightId } from './content/knights';
import { waveFor, type Mode } from './content/waves';
import { allowsHints, DIFFICULTIES, type Difficulty } from './difficulty';
import type { LogEntry } from './events';
import type { LaneIndex, MaliciousKind, Template, Tier } from './types';

export type Thrower = 'knight' | 'squire';
export type EndReason = 'won' | 'serverDown' | 'usersGone';

export interface Packet {
  id: number;
  t: Template;
  src: string;
  lane: LaneIndex;
  x: number;
  checked: boolean;
  entering: boolean;
  doomed: boolean;
  held: boolean;
  heldOnce: boolean;
  slowed: boolean;
  dead: boolean;
}

export interface Spear { packet: Packet; by: Thrower; t: number }
export interface Pending { packet: Packet; t: number }

export interface KnightState {
  lane: LaneIndex;
  x: number;
  y: number;
  hold: number;
  cooldown: number;
  throwT: number;
  moving: boolean;
  facing: 'left' | 'right';
}

export interface Stats {
  hits: Record<Tier, number>;
  squireHits: number;
  ruleBlocks: number;
  served: number;
  decoysKept: number;
  neutralized: number;
  falsePositives: number;
  breaches: Record<MaliciousKind, number>;
  wavesCleared: number;
}

export interface DraftState { picks: Card[]; free: boolean; taken: CardId[] }

export interface RunConfig { mode: Mode; seed: number; root: boolean; hints: boolean; difficulty: Difficulty; knight: KnightId }

export interface RunState {
  cfg: RunConfig;
  phase: 'playing' | 'draft' | 'ended';
  endReason: EndReason | null;
  wave: number;
  timeLeft: number;
  spawnT: number;
  packets: Packet[];
  spears: Spear[];
  pending: Pending[];
  knight: KnightState;
  squire: { cd: number; throwT: number };
  locked: number | null;
  score: number;
  credits: number;
  uptime: number;
  rep: number;
  hints: boolean;
  owned: CardId[];
  fails: Record<string, number>;
  seen: Record<string, number>;
  banned: string[];
  log: LogEntry[];
  logSeq: number;
  stats: Stats;
  drafts: number;
  draft: DraftState | null;
  tampered: boolean;
  god: boolean;
  seenBreach: boolean;
  nextId: number;
}

export const knightY = (lane: number, isMounted: boolean): number => lane * LANE_H + (isMounted ? -6 : 0);
export const packetY = (p: { lane: number }): number => p.lane * LANE_H + PKT_Y;
export const repCap = (cfg: RunConfig): number => DIFFICULTIES[cfg.difficulty].rep;

const emptyStats = (): Stats => ({
  hits: { 1: 0, 2: 0, 3: 0 }, squireHits: 0, ruleBlocks: 0, served: 0, decoysKept: 0, neutralized: 0, falsePositives: 0,
  breaches: { sqli: 0, xss: 0, brute: 0, scan: 0, flood: 0 }, wavesCleared: 0,
});

export const createState = (cfg: RunConfig): RunState => ({
  cfg,
  phase: 'playing',
  endReason: null,
  wave: 1,
  timeLeft: waveFor(cfg.mode, 1).secs,
  spawnT: 0.6,
  packets: [],
  spears: [],
  pending: [],
  knight: { lane: 2, x: KN_X, y: knightY(2, false), hold: 0, cooldown: 0, throwT: 0, moving: false, facing: 'left' },
  squire: { cd: 2, throwT: 0 },
  locked: null,
  score: 0,
  credits: 0,
  uptime: 100,
  rep: repCap(cfg),
  hints: cfg.hints && allowsHints(cfg.difficulty),
  owned: [...STARTING_LOADOUT],
  fails: {},
  seen: {},
  banned: [],
  log: [],
  logSeq: 0,
  stats: emptyStats(),
  drafts: 0,
  draft: null,
  tampered: false,
  god: false,
  seenBreach: false,
  nextId: 1,
});

export const mounted = (s: RunState): boolean => s.owned.includes('destrier');
export const findPacket = (s: RunState, id: number): Packet | undefined => s.packets.find((p) => p.id === id && !p.dead);
export const multiplier = (s: RunState): number => (s.hints ? HINT_MULT : 1) * (s.cfg.root ? ROOT_MULT : 1) * DIFFICULTIES[s.cfg.difficulty].mult;
export const packetSpeed = (s: RunState): number =>
  BASE_SPEED * (s.cfg.root ? ROOT_SPEED : 1) * waveFor(s.cfg.mode, s.wave).speedMult * DIFFICULTIES[s.cfg.difficulty].speed;
export const breachTotal = (st: Stats): number => Object.values(st.breaches).reduce((a, b) => a + b, 0);

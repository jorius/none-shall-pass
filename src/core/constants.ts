// core
import type { MaliciousKind, Tier } from './types';

// Geometry, in logical pixels. The field's own origin is its top-left corner;
// on screen it starts at FIELD_TOP.
export const FIELD_TOP = 56;
export const FIELD_W = 1280;
export const FIELD_H = 450;
export const LANE_H = 90;
export const LANE_COUNT = 5;
export const LANE_X0 = 110;
export const PKT_W = 290;
export const PKT_H = 52;
export const PKT_Y = 19;
export const FW_X = 906;
export const LOCK_X = 826;
export const KN_X = 944;
export const TAR_X0 = 560;
export const TAR_X1 = 790;
export const RACK = { x: 1124, y: 0, w: 120, h: 450, rows: 148 } as const;
export const RACK_TARGET = { x0: 1136, x1: 1230, y0: 24, y1: 420 } as const;
export const SQUIRE_POS = { x: 1012, y: 4 * 90 + 28 } as const;
export const SQUIRE_HAND = { x: 1020, y: 4 * 90 + 42 } as const;

// Timing and speed.
export const STEP = 1 / 60;
export const MAX_STEPS_PER_FRAME = 5;
export const BASE_SPEED = 72;
export const ENTER_MULT = 5;
export const DESTRIER_SLOW: Record<1 | 2 | 3, number> = { 1: 0.7, 2: 0.5, 3: 0.5 };
export const CHARGE_SECS = 1.2;
export const CHARGE_X = LANE_X0 + 40;
export const TAR_MULT = 0.4;
export const SPEAR_SPEED = 1500;
export const RESOLVE_DELAY = 0.6;
export const SPAWN_GAP = 30;
export const SQUIRE_COOLDOWN = 3;
export const THROW_COOLDOWN = 0.25;
export const KNIGHT_FOOT_SPEED = 700;
export const KNIGHT_HORSE_SPEED = 950;
export const ROOT_SPEED = 1.25;

// Scoring. The reputation here is the Analyst's; the state reads every difficulty's own cap from difficulty.ts.
export const MAX_REP = 10;
export const POINTS = {
  tier: { 1: 50, 2: 100, 3: 150 } as Record<Tier, number>,
  squire: 30,
  rule: 20,
  served: 10,
  decoy: 40,
  neutralized: 25,
  overtimeWave: 500,
} as const;
export const DAMAGE: Record<MaliciousKind, number> = { sqli: 12, xss: 10, brute: 6, scan: 2, flood: 3 };
export const HINT_MULT = 0.75;
export const ROOT_MULT = 1.5;
export const LOG_MAX = 300;
export const MISTAKES_MAX = 200;

// Traffic sources.
export const BRUTE_IPS = ['203.0.113.66', '198.51.100.23', '192.0.2.201'] as const;
export const STUFF_IP = '198.51.100.77';

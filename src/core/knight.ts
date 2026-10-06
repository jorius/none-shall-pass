// core
import { CHARGE_SECS, CHARGE_X, FW_X, KN_X, KNIGHT_FOOT_SPEED, KNIGHT_HORSE_SPEED, LANE_COUNT, LANE_X0, PKT_H, PKT_W, SPEAR_SPEED, SQUIRE_COOLDOWN, SQUIRE_HAND, TAR_MULT, THROW_COOLDOWN } from './constants';
import type { RunEvent } from './events';
import { kill, say, untarget } from './outcomes';
import { destrierLevel } from './rules';
import { findPacket, knightY, laneSlow, mounted, packetSpeed, packetY, type Packet, type RunState, type Thrower } from './state';
import type { LaneIndex, Point } from './types';

export const handPos = (s: RunState): Point =>
  mounted(s) ? { x: s.knight.x + 64, y: s.knight.y + 24 } : { x: s.knight.x + 36, y: s.knight.y + 30 };

// What the knight can lock in a lane, nearest the fire first: alive, unclaimed, not in the fire, past the gutter.
const targetable = (s: RunState, lane: LaneIndex): Packet[] =>
  s.packets.filter((p) => !p.dead && !p.doomed && !p.entering && p.lane === lane && p.x + PKT_W > LANE_X0 + 10).sort((a, b) => b.x - a.x);

export const target = (s: RunState, id: number | null, ev: RunEvent[]): void => {
  if (id === null) { untarget(s, ev); return; }
  if (s.locked === id) return;
  const p = findPacket(s, id);
  if (!p || p.doomed || p.entering) return;
  // A target in another lane takes the knight there, which a charge in flight must not do.
  if (s.knight.charge.t > 0 && p.lane !== s.knight.lane) return;
  if (s.locked !== null) untarget(s, ev);
  s.locked = id;
  if (s.knight.lane !== p.lane) { s.knight.lane = p.lane; ev.push({ type: 'laneChanged', lane: p.lane }); }
  ev.push({ type: 'targeted', packetId: id });
};

export const setLane = (s: RunState, lane: number, ev: RunEvent[]): void => {
  if (s.knight.charge.t > 0) return;
  const l = Math.max(0, Math.min(LANE_COUNT - 1, Math.round(lane))) as LaneIndex;
  if (l === s.knight.lane) return;
  const locked = s.locked !== null ? findPacket(s, s.locked) : undefined;
  if (locked && locked.lane !== l) untarget(s, ev);
  s.knight.lane = l;
  ev.push({ type: 'laneChanged', lane: l });
  // The packet nearest the fire in the new lane is the one to read first: it becomes the target at once.
  const front = targetable(s, l)[0];
  if (front) target(s, front.id, ev);
};

export const cycleTarget = (s: RunState, dir: 1 | -1, ev: RunEvent[]): void => {
  const lane = targetable(s, s.knight.lane);
  if (!lane.length) { say(ev, 'emptyLane'); return; }
  const i = s.locked === null ? -1 : lane.findIndex((p) => p.id === s.locked);
  const next = i < 0 ? (dir > 0 ? lane[0] : lane[lane.length - 1]) : lane[(i + dir + lane.length) % lane.length];
  target(s, next.id, ev);
};

const launch = (s: RunState, p: Packet, from: Point, by: Thrower, ev: RunEvent[]): void => {
  const to = { x: p.x + PKT_W * 0.55, y: packetY(p) + PKT_H / 2 };
  const duration = Math.max(0.12, Math.hypot(to.x - from.x, to.y - from.y) / SPEAR_SPEED);
  const v = packetSpeed(s) * laneSlow(s, p.lane) * (p.slowed ? TAR_MULT : 1);
  s.spears.push({ packet: p, by, t: duration });
  ev.push({ type: 'thrown', packetId: p.id, by, from, to: { x: to.x + v * duration, y: to.y }, duration });
};

export const throwSpear = (s: RunState, ev: RunEvent[]): void => {
  if (s.knight.cooldown > 0 || s.knight.charge.t > 0) return;
  const p = s.locked !== null ? findPacket(s, s.locked) : undefined;
  if (!p) { say(ev, 'noTarget'); return; }
  const from = handPos(s);
  untarget(s, ev);
  p.doomed = true;
  s.knight.cooldown = THROW_COOLDOWN;
  s.knight.throwT = 0.3;
  launch(s, p, from, 'knight', ev);
};

export const startCharge = (s: RunState, ev: RunEvent[]): void => {
  const k = s.knight;
  if (destrierLevel(s.owned) < 3 || k.charge.used || k.charge.t > 0) return;
  untarget(s, ev);
  k.charge = { t: CHARGE_SECS, used: true };
  k.moving = true;
  ev.push({ type: 'chargeStarted', lane: k.lane });
};

// Home from the gallop, at once: the post, facing the lane, the view told. Also how a wave that ends mid-charge cuts it short.
export const endCharge = (s: RunState, ev: RunEvent[]): void => {
  const k = s.knight;
  k.charge.t = 0; k.x = KN_X; k.moving = false; k.facing = 'left';
  ev.push({ type: 'chargeEnded' });
};

// Out to the lane head and back; every attack the knight's x crosses on the way is speared,
// except one a spear is already flying at: that spear owns its target.
const stepCharge = (s: RunState, dt: number, ev: RunEvent[]): void => {
  const k = s.knight;
  const u0 = 1 - k.charge.t / CHARGE_SECS;
  k.charge.t = Math.max(0, k.charge.t - dt);
  const u = 1 - k.charge.t / CHARGE_SECS;
  const at = (v: number): number => (v < 0.5 ? KN_X - (KN_X - CHARGE_X) * (v / 0.5) : CHARGE_X + (KN_X - CHARGE_X) * ((v - 0.5) / 0.5));
  const x0 = at(u0), x1 = at(u);
  k.x = x1; k.y = knightY(k.lane, true); k.moving = k.charge.t > 0; k.facing = u < 0.5 ? 'left' : 'right';
  const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
  for (const p of s.packets) {
    if (p.dead || p.doomed || p.entering || p.lane !== k.lane || p.t.kind === 'legit') continue;
    if (p.x + PKT_W >= lo && p.x <= hi) kill(s, p, 'charge', ev);
    if (s.phase !== 'playing') return;
  }
  if (k.charge.t === 0) endCharge(s, ev);
};

export const stepKnight = (s: RunState, dt: number, ev: RunEvent[]): void => {
  const k = s.knight;
  k.cooldown = Math.max(0, k.cooldown - dt);
  k.throwT = Math.max(0, k.throwT - dt);
  if (k.charge.t > 0) { stepCharge(s, dt, ev); return; }
  const isMounted = mounted(s);
  const tx = KN_X, ty = knightY(k.lane, isMounted);
  const dx = tx - k.x, dy = ty - k.y, d = Math.hypot(dx, dy);
  const stepLen = (isMounted ? KNIGHT_HORSE_SPEED : KNIGHT_FOOT_SPEED) * dt;
  if (d <= Math.max(stepLen, 0.01)) {
    k.x = tx; k.y = ty; k.moving = false;
  } else {
    k.x += (dx / d) * stepLen; k.y += (dy / d) * stepLen; k.moving = true;
    k.facing = dx > 4 ? 'right' : 'left';
  }
};

export const stepSpears = (s: RunState, dt: number, ev: RunEvent[]): void => {
  for (const sp of s.spears) sp.t -= dt;
  const due = s.spears.filter((sp) => sp.t <= 0);
  s.spears = s.spears.filter((sp) => sp.t > 0);
  for (const sp of due) {
    if (s.phase !== 'playing') return;
    const p = sp.packet;
    if (!p.dead && !p.entering) kill(s, p, sp.by, ev);
    else ev.push({ type: 'missed', packetId: p.id });
  }
};

export const stepSquire = (s: RunState, dt: number, ev: RunEvent[]): void => {
  if (s.phase !== 'playing') return;
  if (!s.owned.includes('squire')) return;
  s.squire.throwT = Math.max(0, s.squire.throwT - dt);
  s.squire.cd -= dt;
  if (s.squire.cd > 0) return;
  const c = s.packets
    .filter((p) => !p.dead && !p.doomed && !p.entering && p.t.kind !== 'legit' && p.t.tier === 1 && p.x > 130 && p.x + PKT_W < FW_X)
    .sort((a, b) => b.x - a.x)[0];
  if (!c) { s.squire.cd = 0.5; return; }
  c.doomed = true;
  if (s.locked === c.id) untarget(s, ev);
  s.squire.throwT = 0.3;
  s.squire.cd = SQUIRE_COOLDOWN;
  launch(s, c, { ...SQUIRE_HAND }, 'squire', ev);
};

// core
import { FW_X, HOLD_MULT, HOLD_SECS, KN_X, KNIGHT_FOOT_SPEED, KNIGHT_HORSE_SPEED, LANE_COUNT, LANE_X0, PKT_H, PKT_W, SPEAR_SPEED, SQUIRE_COOLDOWN, SQUIRE_HAND, TAR_MULT, THROW_COOLDOWN } from './constants';
import type { RunEvent } from './events';
import { kill, say, untarget } from './outcomes';
import { findPacket, knightY, mounted, packetSpeed, packetY, type Packet, type RunState, type Thrower } from './state';
import type { LaneIndex, Point } from './types';

export const handPos = (s: RunState): Point =>
  mounted(s) ? { x: s.knight.x + 64, y: s.knight.y + 24 } : { x: s.knight.x + 36, y: s.knight.y + 30 };

export const setLane = (s: RunState, lane: number, ev: RunEvent[]): void => {
  const l = Math.max(0, Math.min(LANE_COUNT - 1, Math.round(lane))) as LaneIndex;
  if (l === s.knight.lane) return;
  const p = s.locked !== null ? findPacket(s, s.locked) : undefined;
  if (p && p.lane !== l) untarget(s, ev);
  s.knight.lane = l;
  ev.push({ type: 'laneChanged', lane: l });
};

export const target = (s: RunState, id: number | null, ev: RunEvent[]): void => {
  if (id === null) { untarget(s, ev); return; }
  const p = findPacket(s, id);
  if (!p || p.doomed || p.entering) return;
  if (s.locked !== null && s.locked !== id) untarget(s, ev);
  s.locked = id;
  if (s.knight.lane !== p.lane) { s.knight.lane = p.lane; ev.push({ type: 'laneChanged', lane: p.lane }); }
  if (mounted(s)) { p.held = true; s.knight.hold = HOLD_SECS; }
  ev.push({ type: 'targeted', packetId: id });
};

export const cycleTarget = (s: RunState, dir: 1 | -1, ev: RunEvent[]): void => {
  const lane = s.packets
    .filter((p) => !p.dead && !p.doomed && !p.entering && p.lane === s.knight.lane && p.x + PKT_W > LANE_X0 + 10)
    .sort((a, b) => b.x - a.x);
  if (!lane.length) { say(ev, 'emptyLane'); return; }
  const i = s.locked === null ? -1 : lane.findIndex((p) => p.id === s.locked);
  const next = i < 0 ? (dir > 0 ? lane[0] : lane[lane.length - 1]) : lane[(i + dir + lane.length) % lane.length];
  target(s, next.id, ev);
};

const launch = (s: RunState, p: Packet, from: Point, by: Thrower, ev: RunEvent[]): void => {
  const to = { x: p.x + PKT_W * 0.55, y: packetY(p) + PKT_H / 2 };
  const duration = Math.max(0.12, Math.hypot(to.x - from.x, to.y - from.y) / SPEAR_SPEED);
  const v = packetSpeed(s) * (p.held ? HOLD_MULT : 1) * (p.slowed ? TAR_MULT : 1);
  s.spears.push({ packet: p, by, t: duration });
  ev.push({ type: 'thrown', packetId: p.id, by, from, to: { x: to.x + v * duration, y: to.y }, duration });
};

export const throwSpear = (s: RunState, ev: RunEvent[]): void => {
  if (s.knight.cooldown > 0) return;
  const p = s.locked !== null ? findPacket(s, s.locked) : undefined;
  if (!p) { say(ev, 'noTarget'); return; }
  const from = handPos(s);
  untarget(s, ev);
  p.doomed = true;
  s.knight.cooldown = THROW_COOLDOWN;
  s.knight.throwT = 0.3;
  launch(s, p, from, 'knight', ev);
};

export const stepKnight = (s: RunState, dt: number, ev: RunEvent[]): void => {
  const k = s.knight;
  k.cooldown = Math.max(0, k.cooldown - dt);
  k.throwT = Math.max(0, k.throwT - dt);
  const isMounted = mounted(s);
  let ride = isMounted && s.locked !== null ? findPacket(s, s.locked) : undefined;
  if (ride) {
    k.hold -= dt;
    if (k.hold <= 0) { untarget(s, ev); ride = undefined; }
  }
  const tx = ride ? Math.min(KN_X, ride.x + PKT_W + 6) : KN_X;
  const ty = knightY(ride ? ride.lane : k.lane, isMounted);
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
  if (!s.owned.includes('squire')) return;
  s.squire.throwT = Math.max(0, s.squire.throwT - dt);
  s.squire.cd -= dt;
  if (s.squire.cd > 0) return;
  const c = s.packets
    .filter((p) => !p.dead && !p.doomed && !p.held && !p.entering && p.t.kind !== 'legit' && p.t.tier === 1 && p.x > 130 && p.x + PKT_W < FW_X)
    .sort((a, b) => b.x - a.x)[0];
  if (!c) { s.squire.cd = 0.5; return; }
  c.doomed = true;
  if (s.locked === c.id) untarget(s, ev);
  s.squire.throwT = 0.3;
  s.squire.cd = SQUIRE_COOLDOWN;
  launch(s, c, { ...SQUIRE_HAND }, 'squire', ev);
};

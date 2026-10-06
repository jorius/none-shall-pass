// core
import { DAMAGE, KN_X, LOG_MAX, MISTAKES_MAX, PKT_W, POINTS, RACK } from './constants';
import type { CardId } from './content/cards';
import type { LineId } from './content/lines';
import type { FloatKind, LogEntry, RunEvent } from './events';
import { serverFix } from './rules';
import { multiplier, packetY, type EndReason, type Packet, type RunState, type Thrower } from './state';
import type { MaliciousKind } from './types';

export const earn = (s: RunState, n: number): void => {
  s.score += Math.round(n * multiplier(s));
  s.credits += n;
};

export const say = (ev: RunEvent[], line: LineId): void => { ev.push({ type: 'say', line }); };

const log = (s: RunState, ev: RunEvent[], entry: Omit<LogEntry, 'seq' | 'wave'>): void => {
  const full: LogEntry = { seq: ++s.logSeq, wave: s.wave, ...entry };
  s.log.unshift(full);
  if (s.log.length > LOG_MAX) s.log.pop();
  if (entry.outcome === 'breach' || entry.outcome === 'fp') {
    s.waveMistakes.push(full);
    s.mistakes.unshift(full);
    if (s.mistakes.length > MISTAKES_MAX) s.mistakes.pop();
  }
  ev.push({ type: 'log', entry: full });
};

const floatAtPacket = (ev: RunEvent[], p: Packet, kind: FloatKind, value: number, dx = 90): void => {
  ev.push({ type: 'float', at: 'packet', x: p.x + dx, y: packetY(p) - 14, kind, value });
};

const floatAtRack = (ev: RunEvent[], kind: FloatKind, value: number): void => {
  ev.push({ type: 'float', at: 'rack', x: RACK.x, y: 40, kind, value });
};

export const untarget = (s: RunState, ev: RunEvent[]): void => {
  if (s.locked === null) return;
  s.locked = null;
  ev.push({ type: 'targeted', packetId: null });
};

// Home from the gallop, at once: the post, facing the lane, the view told. Also how a wave or a run that ends mid-charge cuts it short.
export const endCharge = (s: RunState, ev: RunEvent[]): void => {
  const k = s.knight;
  k.charge.t = 0; k.x = KN_X; k.moving = false; k.facing = 'left';
  ev.push({ type: 'chargeEnded' });
};

export const endRun = (s: RunState, reason: EndReason, ev: RunEvent[]): void => {
  untarget(s, ev);
  // A gallop still under way comes home before the run is called, so no debrief opens on a knight mid-lane.
  if (s.knight.charge.t > 0) endCharge(s, ev);
  s.phase = 'ended';
  s.endReason = reason;
  ev.push({ type: 'runEnded', reason });
  say(ev, reason === 'won' ? 'won' : reason === 'serverDown' ? 'draw' : 'usersGone');
};

export const checkEnd = (s: RunState, ev: RunEvent[]): void => {
  if (s.phase !== 'playing') return;
  if (s.uptime <= 0) endRun(s, 'serverDown', ev);
  else if (s.rep <= 0) endRun(s, 'usersGone', ev);
};

export const kill = (s: RunState, p: Packet, by: Thrower | 'rule' | 'charge', ev: RunEvent[], ruleId?: CardId): void => {
  p.dead = true;
  if (s.locked === p.id) untarget(s, ev);
  ev.push({ type: 'shattered', packet: p, by, ruleId });
  if (p.t.kind === 'legit') {
    s.rep = Math.max(0, s.rep - 1);
    s.stats.falsePositives++;
    ev.push({ type: 'reputation', value: s.rep });
    floatAtPacket(ev, p, 'falsePositive', 0, 80);
    log(s, ev, { outcome: 'fp', packet: p, points: 0, fpBy: by, ruleId });
    if (by === 'knight') say(ev, 'oops');
    if (s.rep === 3) say(ev, 'angry');
  } else if (by === 'knight') {
    const tier = p.t.tier ?? 1;
    const pts = POINTS.tier[tier];
    earn(s, pts);
    s.stats.hits[tier]++;
    floatAtPacket(ev, p, tier === 3 ? 'sneaky' : tier === 2 ? 'tricky' : 'points', pts);
    log(s, ev, { outcome: 'hit', packet: p, points: pts });
    if (tier === 3) say(ev, 'haveAtYou');
  } else if (by === 'squire') {
    earn(s, POINTS.squire);
    s.stats.squireHits++;
    floatAtPacket(ev, p, 'squire', POINTS.squire, 110);
    log(s, ev, { outcome: 'squire', packet: p, points: POINTS.squire });
  } else if (by === 'charge') {
    earn(s, POINTS.rule);
    s.stats.chargeHits++;
    floatAtPacket(ev, p, 'points', POINTS.rule);
    log(s, ev, { outcome: 'charge', packet: p, points: POINTS.rule });
  } else {
    earn(s, POINTS.rule);
    s.stats.ruleBlocks++;
    floatAtPacket(ev, p, 'points', POINTS.rule, PKT_W - 170);
    log(s, ev, { outcome: 'rule', packet: p, points: POINTS.rule, ruleId });
    if (ruleId === 'f2b' && !s.banned.includes(p.src)) {
      s.banned.push(p.src);
      ev.push({ type: 'banned', ip: p.src, count: s.banned.length });
    }
  }
  checkEnd(s, ev);
};

export const resolve = (s: RunState, p: Packet, ev: RunEvent[]): void => {
  if (p.t.kind === 'brute') s.fails[p.src] = (s.fails[p.src] ?? 0) + 1;
  if (p.t.kind === 'legit') {
    const decoy = !!p.t.decoy;
    const pts = decoy ? POINTS.decoy : POINTS.served;
    earn(s, pts);
    if (decoy) s.stats.decoysKept++; else s.stats.served++;
    ev.push({ type: 'resolved', packet: p, outcome: 'served', damage: 0 });
    floatAtRack(ev, decoy ? 'notFooled' : 'points', pts);
    log(s, ev, { outcome: 'served', packet: p, points: pts });
  } else {
    const fix = serverFix(p.t, s.owned);
    if (fix) {
      earn(s, POINTS.neutralized);
      s.stats.neutralized++;
      ev.push({ type: 'resolved', packet: p, outcome: 'neutralized', damage: 0, fixId: fix });
      floatAtRack(ev, 'neutralized', POINTS.neutralized);
      log(s, ev, { outcome: 'neutralized', packet: p, points: POINTS.neutralized, ruleId: fix });
    } else {
      const kind = p.t.kind as MaliciousKind;
      const dmg = DAMAGE[kind];
      const before = s.uptime;
      if (!s.god) s.uptime = Math.max(0, s.uptime - dmg);
      s.stats.breaches[kind]++;
      ev.push({ type: 'resolved', packet: p, outcome: 'breach', damage: dmg });
      ev.push({ type: 'uptime', before, after: s.uptime });
      floatAtRack(ev, 'damage', dmg);
      log(s, ev, { outcome: 'breach', packet: p, points: 0, damage: dmg });
      if (!s.seenBreach) { s.seenBreach = true; say(ev, 'firstBreach'); }
      else if (s.uptime < 25) say(ev, 'invincible');
      else if (s.uptime < 55) say(ev, 'fleshWound');
    }
  }
  checkEnd(s, ev);
};

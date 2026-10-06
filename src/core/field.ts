// core
import { BRUTE_IPS, ENTER_MULT, FW_X, LANE_X0, LOCK_X, PKT_W, RESOLVE_DELAY, SPAWN_GAP, TAR_MULT } from './constants';
import { TEMPLATES } from './content/packets';
import { waveFor, type WaveDef } from './content/waves';
import { tierWeight } from './difficulty';
import type { RunEvent } from './events';
import { kill, resolve, untarget } from './outcomes';
import { docIp, pick, type Rng } from './rng';
import { firewallRule, lockdownBlocks, tarpitSlows } from './rules';
import { laneSlow, packetSpeed, type Packet, type RunState } from './state';
import type { Template, Tier } from './types';

// The difficulty's say on the deal: a weight multiplier per tier, 0 keeping that tier out of the wave.
type TierMult = (tier: Tier) => number;

const weightIn = (def: WaveDef, t: Template, tierMult: TierMult): number => {
  if (def.only && !def.only.includes(t.kind)) return 0;
  return t.weight * (def.boost[t.kind] ?? 1) * (t.tier === 3 ? def.tier3Mult : 1) * tierMult(t.tier ?? 1);
};

export const pickTemplate = (rng: Rng, def: WaveDef, tierMult: TierMult = () => 1): Template => {
  const total = TEMPLATES.reduce((a, t) => a + weightIn(def, t, tierMult), 0);
  let r = rng() * total;
  for (const t of TEMPLATES) {
    const w = weightIn(def, t, tierMult);
    if (w <= 0) continue;
    r -= w;
    if (r < 0) return t;
  }
  return TEMPLATES.filter((t) => weightIn(def, t, tierMult) > 0).at(-1)!;
};

export const spawn = (s: RunState, rng: Rng, ev: RunEvent[]): Packet | null => {
  const def = waveFor(s.cfg.mode, s.wave);
  const tierMult: TierMult = (tier) => tierWeight(s.cfg.difficulty, s.wave, tier);
  const startX = LANE_X0 - PKT_W;
  for (let tries = 0; tries < 5; tries++) {
    const t = pickTemplate(rng, def, tierMult);
    if (s.packets.some((p) => !p.dead && p.lane === t.lane && p.x < startX + PKT_W + SPAWN_GAP)) continue;
    const src = t.fixedSrc ?? (t.kind === 'brute' && rng() < 0.6 ? pick(rng, BRUTE_IPS) : docIp(rng));
    if (t.lane <= 1) s.seen[src] = (s.seen[src] ?? 0) + 1;
    const p: Packet = { id: s.nextId++, t, src, lane: t.lane, x: startX, checked: false, entering: false, doomed: false, slowed: false, dead: false };
    s.packets.push(p);
    ev.push({ type: 'spawned', packet: p });
    return p;
  }
  return null;
};

export const stepPackets = (s: RunState, dt: number, ev: RunEvent[]): void => {
  const base = packetSpeed(s);
  // Front to back within each lane: a packet can only be as far along as the one ahead allows.
  const order = s.packets.filter((p) => !p.dead).sort((a, b) => a.lane - b.lane || b.x - a.x);
  let ahead: Packet | null = null;
  for (const p of order) {
    if (s.phase !== 'playing') return;
    if (ahead && ahead.lane !== p.lane) ahead = null;
    let v = base;
    if (p.entering) v *= ENTER_MULT;
    else {
      v *= laneSlow(s, p.lane);
      p.slowed = tarpitSlows(p, s.owned, s.seen);
      if (p.slowed) v *= TAR_MULT;
    }
    const x0 = p.x;
    p.x += v * dt;
    if (ahead && !ahead.entering && !p.entering) p.x = Math.max(x0, Math.min(p.x, ahead.x - PKT_W - SPAWN_GAP));
    // A packet shattered here bounds nothing: the kills below leave `ahead` on the last one still in the lane.
    if (!p.checked && lockdownBlocks(p.t, s.owned) && p.x + PKT_W >= LOCK_X) {
      p.checked = true;
      kill(s, p, 'rule', ev, 'lockdown');
      continue;
    }
    if (!p.checked && p.x + PKT_W >= FW_X) {
      p.checked = true;
      const rule = firewallRule(p, s.owned, s.fails);
      if (rule) { kill(s, p, 'rule', ev, rule); continue; }
      p.entering = true;
      p.slowed = false;
      if (s.locked === p.id) untarget(s, ev);
      ev.push({ type: 'entered', packetId: p.id });
    }
    if (p.entering && p.x >= FW_X) {
      p.dead = true;
      s.pending.push({ packet: p, t: RESOLVE_DELAY });
      ev.push({ type: 'consumed', packetId: p.id });
    }
    ahead = p;
  }
};

export const stepPending = (s: RunState, dt: number, ev: RunEvent[]): void => {
  for (const q of s.pending) q.t -= dt;
  const due = s.pending.filter((q) => q.t <= 0);
  s.pending = s.pending.filter((q) => q.t > 0);
  for (const q of due) {
    if (s.phase !== 'playing') return;
    resolve(s, q.packet, ev);
  }
};

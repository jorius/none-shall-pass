// packages
import { describe, expect, it } from 'vitest';

// core
import { CHARGE_SECS, KN_X, LANE_H, LANE_X0, PKT_W, SPEAR_SPEED, SQUIRE_COOLDOWN, THROW_COOLDOWN } from './constants';
import type { RunEvent } from './events';
import { stepPackets } from './field';
import { cycleTarget, handPos, setLane, startCharge, stepKnight, stepSpears, stepSquire, target, throwSpear } from './knight';
import { Run } from './run';
import { laneSlow } from './state';
import { cfg, freshState, place } from './testkit';

describe('lanes', () => {
  it('clamps lanes and announces changes', () => {
    const s = freshState(), ev: RunEvent[] = [];
    setLane(s, 9, ev);
    expect(s.knight.lane).toBe(4);
    setLane(s, -3, ev);
    expect(s.knight.lane).toBe(0);
    expect(ev).toEqual([{ type: 'laneChanged', lane: 4 }, { type: 'laneChanged', lane: 0 }]);
    setLane(s, 0, ev);
    expect(ev.length).toBe(2);
  });

  it('drops a target on another lane when the knight leaves', () => {
    const s = freshState(), ev: RunEvent[] = [];
    const p = place(s, 'sqli-union', 300);
    target(s, p.id, ev);
    setLane(s, 3, ev);
    expect(s.locked).toBeNull();
  });
});

describe('auto-target on lane change', () => {
  it('targets the packet nearest the fire in the new lane, and clears when the lane is empty', () => {
    const s = freshState();
    s.knight.lane = 2;
    const far = place(s, 'brute-admin', 200), near = place(s, 'legit-login', 500);
    place(s, 'brute-admin', 650).entering = true;
    const ev: RunEvent[] = [];
    setLane(s, 1, ev);
    expect(s.locked).toBe(near.id);
    expect(ev.map((e) => e.type)).toEqual(['laneChanged', 'targeted']);
    setLane(s, 0, ev);
    expect(s.locked).toBeNull();
    setLane(s, 1, ev);
    expect(s.locked).toBe(near.id);
    expect(far.dead).toBe(false);
  });
});

describe('targeting', () => {
  it('cycles the knight\'s lane front-most first, both directions, wrapping', () => {
    const s = freshState(), ev: RunEvent[] = [];
    const back = place(s, 'sqli-union', 100), front = place(s, 'legit-socks', 500), mid = place(s, 'decoy-union', 300);
    place(s, 'brute-admin', 700);
    cycleTarget(s, 1, ev); expect(s.locked).toBe(front.id);
    cycleTarget(s, 1, ev); expect(s.locked).toBe(mid.id);
    cycleTarget(s, 1, ev); expect(s.locked).toBe(back.id);
    cycleTarget(s, 1, ev); expect(s.locked).toBe(front.id);
    cycleTarget(s, -1, ev); expect(s.locked).toBe(back.id);
  });

  it('says so when the lane is empty', () => {
    const s = freshState(), ev: RunEvent[] = [];
    setLane(s, 0, ev);
    cycleTarget(s, 1, ev);
    expect(ev).toContainEqual({ type: 'say', line: 'emptyLane' });
  });

  it('moves the knight to the target\'s lane and ignores doomed or entering packets', () => {
    const s = freshState(), ev: RunEvent[] = [];
    const p = place(s, 'brute-ssh-root', 300);
    target(s, p.id, ev);
    expect(s.knight.lane).toBe(0);
    const q = place(s, 'brute-admin', 300); q.doomed = true;
    target(s, q.id, ev);
    expect(s.locked).toBe(p.id);
    const r = place(s, 'brute-admin', 400); r.entering = true;
    target(s, r.id, ev);
    expect(s.locked).toBe(p.id);
  });
});

describe('spears', () => {
  it('needs a target, then flies for distance / speed and hits', () => {
    const s = freshState(), ev: RunEvent[] = [];
    throwSpear(s, ev);
    expect(ev).toContainEqual({ type: 'say', line: 'noTarget' });
    const p = place(s, 'sqli-union', 300);
    target(s, p.id, ev);
    const from = handPos(s);
    const ev2: RunEvent[] = [];
    throwSpear(s, ev2);
    const thrown = ev2.find((e) => e.type === 'thrown')!;
    expect(thrown).toMatchObject({ type: 'thrown', packetId: p.id, by: 'knight', from });
    const d = Math.hypot(300 + PKT_W * 0.55 - from.x, 2 * LANE_H + 19 + 26 - from.y);
    expect((thrown as { duration: number }).duration).toBeCloseTo(Math.max(0.12, d / SPEAR_SPEED));
    expect(p.doomed).toBe(true);
    expect(s.locked).toBeNull();
    stepSpears(s, 10, ev2);
    expect(p.dead).toBe(true);
    expect(s.stats.hits[2]).toBe(1);
  });

  it('enforces the cooldown against Space spam', () => {
    const s = freshState(), ev: RunEvent[] = [];
    const a = place(s, 'sqli-union', 300), b = place(s, 'sqli-sleep', 0);
    target(s, a.id, ev); throwSpear(s, ev);
    target(s, b.id, ev); throwSpear(s, ev);
    expect(s.spears.length).toBe(1);
    stepKnight(s, THROW_COOLDOWN + 0.01, ev);
    throwSpear(s, ev);
    expect(s.spears.length).toBe(2);
  });

  it('misses when the packet entered the fire first', () => {
    const s = freshState(), ev: RunEvent[] = [];
    const p = place(s, 'sqli-union', 300);
    target(s, p.id, ev); throwSpear(s, ev);
    p.entering = true;
    stepSpears(s, 10, ev);
    expect(p.dead).toBe(false);
    expect(ev).toContainEqual({ type: 'missed', packetId: p.id });
  });
});

describe('stepKnight', () => {
  it('walks to the lane on foot and keeps his post once mounted', () => {
    const s = freshState(), ev: RunEvent[] = [];
    setLane(s, 0, ev);
    for (let i = 0; i < 120; i++) stepKnight(s, 1 / 60, ev);
    expect(s.knight.y).toBe(0);
    expect(s.knight.x).toBe(KN_X);
    s.owned.push('destrier');
    const p = place(s, 'sqli-union', 200);
    target(s, p.id, ev);
    for (let i = 0; i < 120; i++) stepKnight(s, 1 / 60, ev);
    expect(s.knight.x).toBe(KN_X);
    expect(s.knight.y).toBe(2 * LANE_H - 6);
    expect(s.locked).toBe(p.id);
  });
});

describe('destrier levels', () => {
  it('slows the whole lane the knight is in, by level, and no other lane', () => {
    const s = freshState();
    s.knight.lane = 2;
    expect(laneSlow(s, 2)).toBe(1);
    s.owned.push('destrier');
    expect(laneSlow(s, 2)).toBe(0.7);
    expect(laneSlow(s, 1)).toBe(1);
    s.owned.push('destrier2');
    expect(laneSlow(s, 2)).toBe(0.5);
    s.owned.push('destrier3');
    expect(laneSlow(s, 2)).toBe(0.5);
  });

  it('moves packets in the slowed lane at the lane factor', () => {
    const s = freshState();
    s.owned.push('destrier');
    s.knight.lane = 2;
    const slow = place(s, 'sqli-tautology', 300), fast = place(s, 'legit-login', 300);
    stepPackets(s, 1, []);
    expect(fast.x - 300).toBeCloseTo((slow.x - 300) / 0.7, 5);
  });
});

describe('charge', () => {
  const ready = () => { const s = freshState(); s.owned.push('destrier', 'destrier2', 'destrier3'); s.knight.lane = 2; return s; };

  it('needs Destrier III, a fresh wave, and no charge in flight; otherwise it is a silent no-op', () => {
    const s = freshState(); s.owned.push('destrier');
    const ev: RunEvent[] = [];
    startCharge(s, ev);
    expect(ev).toEqual([]);
    const r = ready();
    startCharge(r, ev);
    expect(ev).toContainEqual({ type: 'chargeStarted', lane: 2 });
    const again: RunEvent[] = [];
    startCharge(r, again);
    expect(again).toEqual([]);
    r.knight.charge = { t: 0, used: true };
    startCharge(r, again);
    expect(again).toEqual([]);
  });

  it('gallops to the lane head and back in CHARGE_SECS, spearing every attack it passes and no real user', () => {
    const s = ready();
    const a = place(s, 'sqli-tautology', 400), u = place(s, 'legit-socks', 600), b = place(s, 'sqli-union', 250);
    place(s, 'brute-admin', 500); // lane 1: untouched
    const ev: RunEvent[] = [];
    startCharge(s, ev);
    for (let i = 0; i < 80; i++) { stepKnight(s, 1 / 60, ev); stepPackets(s, 1 / 60, ev); }
    expect(s.knight.charge.t).toBe(0);
    expect(s.knight.x).toBe(KN_X);
    expect(ev).toContainEqual({ type: 'chargeEnded' });
    const killed = ev.filter((e): e is Extract<RunEvent, { type: 'shattered' }> => e.type === 'shattered').map((e) => [e.packet.id, e.by]);
    expect(killed).toEqual(expect.arrayContaining([[a.id, 'charge'], [b.id, 'charge']]));
    expect(killed.some(([id]) => id === u.id)).toBe(false);
    expect(s.packets.filter((p) => p.lane === 1).every((p) => !p.dead)).toBe(true);
    expect(s.stats.chargeHits).toBe(2);
    expect(s.score).toBe(40);
  });

  it('reaches at least the lane head and blocks throws and lane changes while galloping', () => {
    const s = ready();
    const ev: RunEvent[] = [];
    startCharge(s, ev);
    let minX = KN_X;
    for (let i = 0; i < Math.round((CHARGE_SECS / 2) * 60) + 1; i++) { stepKnight(s, 1 / 60, ev); minX = Math.min(minX, s.knight.x); }
    expect(minX).toBeLessThanOrEqual(LANE_X0 + 40 + 2);
    place(s, 'sqli-tautology', 700);
    s.locked = s.packets[0].id;
    const before = ev.length;
    throwSpear(s, ev);
    setLane(s, 1, ev);
    expect(ev.length).toBe(before);
    expect(s.knight.lane).toBe(2);
  });

  it('refuses a target in another lane while galloping, since that would move the charge', () => {
    const s = ready(), ev: RunEvent[] = [];
    const other = place(s, 'brute-admin', 500), own = place(s, 'legit-socks', 700);
    startCharge(s, ev);
    target(s, other.id, ev);
    expect(s.locked).toBeNull();
    expect(s.knight.lane).toBe(2);
    target(s, own.id, ev);
    expect(s.locked).toBe(own.id);
  });

  it('resets with the next wave', () => {
    const run = new Run(cfg());
    run.state.owned.push('destrier', 'destrier2', 'destrier3');
    run.charge();
    expect(run.state.knight.charge.used).toBe(true);
    run.state.phase = 'draft'; run.state.draft = { picks: [], free: true, taken: [] };
    run.nextWave();
    expect(run.state.knight.charge).toEqual({ t: 0, used: false });
  });
});

describe('squire', () => {
  it('throws at obvious attacks only, then cools down', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.owned.push('squire');
    s.squire.cd = 0;
    place(s, 'legit-socks', 400);
    place(s, 'sqli-union', 500);
    stepSquire(s, 0.01, ev);
    expect(s.spears.length).toBe(0);
    const obvious = place(s, 'sqli-tautology', 300);
    s.squire.cd = 0;
    stepSquire(s, 0.01, ev);
    expect(s.spears.length).toBe(1);
    expect(obvious.doomed).toBe(true);
    expect(s.squire.cd).toBeCloseTo(SQUIRE_COOLDOWN);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'thrown', by: 'squire' }));
    place(s, 'brute-admin', 300);
    stepSquire(s, 0.01, ev);
    expect(s.spears.length).toBe(1);
  });

  it('does nothing without the card', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.squire.cd = 0;
    place(s, 'sqli-tautology', 300);
    stepSquire(s, 0.01, ev);
    expect(s.spears.length).toBe(0);
  });

  it('stops throwing once the run has ended', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.owned.push('squire');
    s.squire.cd = 0;
    const obvious = place(s, 'sqli-tautology', 300);
    s.phase = 'ended';
    stepSquire(s, 0.01, ev);
    expect(s.spears.length).toBe(0);
    expect(obvious.doomed).toBe(false);
    expect(ev).toEqual([]);
  });
});

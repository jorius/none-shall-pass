// packages
import { describe, expect, it } from 'vitest';

// core
import { HOLD_SECS, KN_X, LANE_H, PKT_W, SPEAR_SPEED, SQUIRE_COOLDOWN, THROW_COOLDOWN } from './constants';
import type { RunEvent } from './events';
import { cycleTarget, handPos, setLane, stepKnight, stepSpears, stepSquire, target, throwSpear } from './knight';
import { freshState, place } from './testkit';

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
    expect(p.held).toBe(false);
    const q = place(s, 'brute-admin', 300); q.doomed = true;
    target(s, q.id, ev);
    expect(s.locked).toBe(p.id);
    const r = place(s, 'brute-admin', 400); r.entering = true;
    target(s, r.id, ev);
    expect(s.locked).toBe(p.id);
  });

  it('holds the packet when mounted', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.owned.push('destrier');
    const p = place(s, 'sqli-union', 300);
    target(s, p.id, ev);
    expect(p.held).toBe(true);
    expect(s.knight.hold).toBe(HOLD_SECS);
    target(s, null, ev);
    expect(p.held).toBe(false);
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
  it('walks to the lane on foot and rides out to a held packet', () => {
    const s = freshState(), ev: RunEvent[] = [];
    setLane(s, 0, ev);
    for (let i = 0; i < 120; i++) stepKnight(s, 1 / 60, ev);
    expect(s.knight.y).toBe(0);
    expect(s.knight.x).toBe(KN_X);
    s.owned.push('destrier');
    const p = place(s, 'sqli-union', 200);
    target(s, p.id, ev);
    for (let i = 0; i < 120; i++) stepKnight(s, 1 / 60, ev);
    expect(s.knight.x).toBeCloseTo(200 + PKT_W + 6);
    expect(s.knight.y).toBe(2 * LANE_H - 6);
  });

  it('lets go when the hold runs out', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.owned.push('destrier');
    const p = place(s, 'sqli-union', 200);
    target(s, p.id, ev);
    stepKnight(s, HOLD_SECS + 0.1, ev);
    expect(s.locked).toBeNull();
    expect(p.held).toBe(false);
  });

  it('does not refresh the hold when the same packet is targeted again', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.owned.push('destrier');
    const p = place(s, 'sqli-union', 200);
    target(s, p.id, ev);
    stepKnight(s, HOLD_SECS * 0.6, ev);
    target(s, p.id, ev);
    stepKnight(s, HOLD_SECS * 0.4 + 0.1, ev);
    expect(s.locked).toBeNull();
    expect(p.held).toBe(false);
  });

  it('holds a packet only once: Tab after the hold runs out re-targets without holding', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.owned.push('destrier');
    const p = place(s, 'sqli-union', 200);
    target(s, p.id, ev);
    stepKnight(s, HOLD_SECS + 0.1, ev);
    cycleTarget(s, 1, ev);
    expect(s.locked).toBe(p.id);
    expect(p.held).toBe(false);
    expect(s.knight.hold).toBe(0);
  });

  it('cannot renew a hold by cycling away and back', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.owned.push('destrier');
    const p = place(s, 'sqli-union', 300), o = place(s, 'sqli-sleep', 100);
    target(s, p.id, ev);
    stepKnight(s, HOLD_SECS * 0.5, ev);
    cycleTarget(s, 1, ev);
    expect(s.locked).toBe(o.id);
    cycleTarget(s, -1, ev);
    expect(s.locked).toBe(p.id);
    expect(p.held).toBe(false);
    expect(s.knight.hold).toBe(0);
  });

  it('keeps the lock on a packet he already held and throws from his post', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.owned.push('destrier');
    const p = place(s, 'sqli-union', 200);
    target(s, p.id, ev);
    stepKnight(s, HOLD_SECS + 0.1, ev);
    cycleTarget(s, 1, ev);
    for (let i = 0; i < 120; i++) stepKnight(s, 1 / 60, ev);
    expect(s.locked).toBe(p.id);
    expect(s.knight.x).toBe(KN_X);
    throwSpear(s, ev);
    expect(p.doomed).toBe(true);
  });

  it('never rides past his post', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.owned.push('destrier');
    const p = place(s, 'sqli-union', KN_X - PKT_W);
    target(s, p.id, ev);
    for (let i = 0; i < 60; i++) stepKnight(s, 1 / 60, ev);
    expect(s.knight.x).toBe(KN_X);
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

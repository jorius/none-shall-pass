// packages
import { describe, expect, it } from 'vitest';

// core
import { BASE_SPEED, DESTRIER_SLOW, ENTER_MULT, FW_X, LANE_X0, LOCK_X, PKT_W, RESOLVE_DELAY } from './constants';
import { CAMPAIGN } from './content/waves';
import type { Difficulty } from './difficulty';
import type { RunEvent } from './events';
import { pickTemplate, spawn, stepPackets, stepPending } from './field';
import { mulberry32 } from './rng';
import { freshState, place } from './testkit';

describe('pickTemplate', () => {
  it('respects a wave\'s allowed families', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 300; i++) expect(['legit', 'scan']).toContain(pickTemplate(rng, CAMPAIGN[0]).kind);
  });
  it('boosts the wave\'s family', () => {
    const rng = mulberry32(4);
    const kinds = Array.from({ length: 2000 }, () => pickTemplate(rng, CAMPAIGN[4]).kind);
    expect(kinds.filter((k) => k === 'flood').length).toBeGreaterThan(kinds.filter((k) => k === 'xss').length);
  });
});

describe('spawn', () => {
  it('puts the packet behind the gutter and records repeat IPs on auth lanes', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.wave = 2;
    let p = null;
    for (let i = 0; i < 20 && !(p && p.lane <= 1); i++) { s.packets = []; p = spawn(s, mulberry32(i), ev); }
    expect(p!.x).toBe(LANE_X0 - PKT_W);
    expect(s.seen[p!.src]).toBeGreaterThanOrEqual(1);
    expect(ev.some((e) => e.type === 'spawned')).toBe(true);
  });
  it('never stacks two packets at the lane mouth', () => {
    const s = freshState(), ev: RunEvent[] = [];
    const rng = mulberry32(11);
    for (let i = 0; i < 40; i++) spawn(s, rng, ev);
    for (const a of s.packets) for (const b of s.packets) {
      if (a !== b && a.lane === b.lane) expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(PKT_W);
    }
    expect(s.packets.length).toBeLessThanOrEqual(5);
  });
  it('deals no tricky or sneaky packet to an intern before wave 4', () => {
    const tiers = (difficulty: Difficulty): number[] => {
      const s = freshState({ difficulty }), ev: RunEvent[] = [], rng = mulberry32(9), out: number[] = [];
      s.wave = 3;
      for (let i = 0; i < 500; i++) { s.packets = []; out.push(spawn(s, rng, ev)!.t.tier ?? 1); }
      return out;
    };
    expect(tiers('intern').every((t) => t === 1)).toBe(true);
    // The same wave deals them to an analyst, so it is the gate that keeps them out.
    expect(tiers('analyst').some((t) => t > 1)).toBe(true);
  });
});

describe('stepPackets', () => {
  it('moves packets at wave speed, slower in the mounted knight\'s lane', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.owned.push('destrier');
    const a = place(s, 'legit-socks', 100), b = place(s, 'legit-login', 100);
    stepPackets(s, 1, ev);
    expect(a.x).toBeCloseTo(100 + BASE_SPEED * DESTRIER_SLOW[1]);
    expect(b.x).toBeCloseTo(100 + BASE_SPEED);
  });

  it('stops scans at the port panel', () => {
    const s = freshState(), ev: RunEvent[] = [];
    const p = place(s, 'scan-rdp', LOCK_X - PKT_W - 1);
    stepPackets(s, 0.1, ev);
    expect(p.dead).toBe(true);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'shattered', by: 'rule', ruleId: 'lockdown' }));
  });

  it('runs firewall rules at the fire, otherwise lets the fire eat the packet', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.owned.push('quote');
    const blocked = place(s, 'sqli-tautology', FW_X - PKT_W - 1);
    const passes = place(s, 'sqli-encoded', FW_X - PKT_W - 1);
    stepPackets(s, 0.1, ev);
    expect(blocked.dead).toBe(true);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'shattered', packet: blocked, by: 'rule', ruleId: 'quote' }));
    expect(passes.entering).toBe(true);
    expect(ev).toContainEqual({ type: 'entered', packetId: passes.id });
  });

  it('consumes an entering packet at enter speed, then resolves it after the delay', () => {
    const s = freshState(), ev: RunEvent[] = [];
    const p = place(s, 'legit-socks', FW_X - PKT_W + 1);
    stepPackets(s, 0.01, ev);
    expect(p.entering).toBe(true);
    const secs = PKT_W / (BASE_SPEED * ENTER_MULT) + 0.05;
    let t = 0;
    for (; t < 0.4; t += 1 / 60) stepPackets(s, 1 / 60, ev);
    expect(p.dead).toBe(false);
    for (; t < secs; t += 1 / 60) stepPackets(s, 1 / 60, ev);
    expect(p.dead).toBe(true);
    expect(s.pending.length).toBe(1);
    expect(ev).toContainEqual({ type: 'consumed', packetId: p.id });
    stepPending(s, RESOLVE_DELAY / 2, ev);
    expect(s.stats.served).toBe(0);
    stepPending(s, RESOLVE_DELAY, ev);
    expect(s.stats.served).toBe(1);
    expect(s.pending.length).toBe(0);
  });

  it('untargets a packet that reaches the fire', () => {
    const s = freshState(), ev: RunEvent[] = [];
    const p = place(s, 'legit-socks', FW_X - PKT_W - 1);
    s.locked = p.id;
    stepPackets(s, 0.1, ev);
    expect(s.locked).toBeNull();
  });

  it('marks packets slowed by the tarpit', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.owned.push('tarpit');
    s.seen['203.0.113.66'] = 3;
    const p = place(s, 'brute-admin', 400, '203.0.113.66');
    stepPackets(s, 1, ev);
    expect(p.slowed).toBe(true);
    expect(p.x).toBeCloseTo(400 + BASE_SPEED * 0.4);
    p.x = FW_X - PKT_W - 1;
    stepPackets(s, 0.1, ev);
    expect(p.entering).toBe(true);
    expect(p.slowed).toBe(false);
  });

  it('stops processing once the run ends mid-step', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.uptime = 1;
    const a = place(s, 'sqli-union', FW_X - 1);
    a.entering = true; a.checked = true;
    stepPackets(s, 0.1, ev);
    stepPending(s, 1, ev);
    expect(s.phase).toBe('ended');
  });

  it('leaves later packets alone once a rule ends the run', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.owned.push('quote');
    s.rep = 1;
    place(s, 'legit-oreilly', FW_X - PKT_W - 1);
    const next = place(s, 'legit-socks', FW_X - PKT_W - 1);
    stepPackets(s, 0.1, ev);
    expect(s.endReason).toBe('usersGone');
    expect(next.x).toBe(FW_X - PKT_W - 1);
    expect(next.checked).toBe(false);
    expect(next.entering).toBe(false);
    expect(ev.some((e) => e.type === 'entered')).toBe(false);
  });
});

describe('stepPending', () => {
  it('stops resolving once a breach ends the run', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.uptime = 1;
    const a = place(s, 'sqli-union', FW_X), b = place(s, 'sqli-tautology', FW_X);
    a.dead = true; b.dead = true;
    s.pending.push({ packet: a, t: 0.1 }, { packet: b, t: 0.1 });
    stepPending(s, 1, ev);
    expect(s.endReason).toBe('serverDown');
    expect(ev.filter((e) => e.type === 'resolved').length).toBe(1);
    expect(s.stats.breaches.sqli).toBe(1);
  });
});

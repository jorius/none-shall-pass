// packages
import { describe, expect, it } from 'vitest';

// core
import type { RunEvent } from './events';
import { checkEnd, earn, kill, resolve, untarget } from './outcomes';
import { freshState, place } from './testkit';

const types = (ev: RunEvent[]) => ev.map((e) => e.type);

describe('earn', () => {
  it('applies the hints and root multipliers to score but not credits', () => {
    const s = freshState({ hints: true, root: true });
    earn(s, 100);
    expect(s.score).toBe(Math.round(100 * 0.75 * 1.5));
    expect(s.credits).toBe(100);
  });
});

describe('kill', () => {
  it('scores knight hits by tier and logs them', () => {
    const s = freshState(), ev: RunEvent[] = [];
    kill(s, place(s, 'sqli-orderby', 300), 'knight', ev);
    expect(s.score).toBe(150);
    expect(s.stats.hits[3]).toBe(1);
    expect(types(ev)).toEqual(['shattered', 'float', 'log', 'say']);
    expect(s.log[0].outcome).toBe('hit');
    expect(ev.find((e) => e.type === 'float')).toMatchObject({ kind: 'sneaky', value: 150 });
  });

  it('costs reputation for a false positive and says so', () => {
    const s = freshState(), ev: RunEvent[] = [];
    kill(s, place(s, 'legit-oreilly', 300), 'knight', ev);
    expect(s.rep).toBe(9);
    expect(s.score).toBe(0);
    expect(s.stats.falsePositives).toBe(1);
    expect(ev).toContainEqual({ type: 'say', line: 'oops' });
    expect(s.log[0]).toMatchObject({ outcome: 'fp', fpBy: 'knight' });
  });

  it('pays rules and squires flat amounts and records bans', () => {
    const s = freshState(), ev: RunEvent[] = [];
    kill(s, place(s, 'brute-admin', 600, '203.0.113.66'), 'rule', ev, 'f2b');
    kill(s, place(s, 'scan-rdp', 600), 'squire', ev);
    expect(s.score).toBe(20 + 30);
    expect(s.banned).toEqual(['203.0.113.66']);
    expect(ev).toContainEqual({ type: 'banned', ip: '203.0.113.66', count: 1 });
  });

  it('untargets the packet it kills', () => {
    const s = freshState(), ev: RunEvent[] = [];
    const p = place(s, 'sqli-tautology', 300);
    s.locked = p.id; p.held = true;
    kill(s, p, 'knight', ev);
    expect(s.locked).toBeNull();
    expect(ev[0]).toEqual({ type: 'targeted', packetId: null });
  });

  it('ends the run when reputation hits zero', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.rep = 1;
    kill(s, place(s, 'legit-socks', 300), 'knight', ev);
    expect(s.phase).toBe('ended');
    expect(s.endReason).toBe('usersGone');
    expect(ev).toContainEqual({ type: 'runEnded', reason: 'usersGone' });
  });
});

describe('resolve', () => {
  it('serves real users and pays more for decoys', () => {
    const s = freshState(), ev: RunEvent[] = [];
    resolve(s, place(s, 'legit-socks', 906), ev);
    resolve(s, place(s, 'decoy-union', 906), ev);
    expect(s.score).toBe(50);
    expect(s.stats.served).toBe(1);
    expect(s.stats.decoysKept).toBe(1);
  });

  it('neutralizes with a server fix', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.owned.push('prepared');
    resolve(s, place(s, 'sqli-union', 906), ev);
    expect(s.uptime).toBe(100);
    expect(s.stats.neutralized).toBe(1);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'resolved', outcome: 'neutralized', fixId: 'prepared' }));
  });

  it('breaches, damages uptime and picks the right line', () => {
    const s = freshState(), ev: RunEvent[] = [];
    resolve(s, place(s, 'sqli-union', 906), ev);
    expect(s.uptime).toBe(88);
    expect(ev).toContainEqual({ type: 'say', line: 'firstBreach' });
    expect(ev).toContainEqual({ type: 'uptime', before: 100, after: 88 });
    s.uptime = 50;
    const ev2: RunEvent[] = [];
    resolve(s, place(s, 'xss-script', 906), ev2);
    expect(ev2).toContainEqual({ type: 'say', line: 'fleshWound' });
  });

  it('counts failed logins for fail2ban', () => {
    const s = freshState(), ev: RunEvent[] = [];
    resolve(s, place(s, 'brute-admin', 906, '203.0.113.66'), ev);
    expect(s.fails['203.0.113.66']).toBe(1);
  });

  it('ignores damage in god mode and ends on zero uptime otherwise', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.god = true;
    resolve(s, place(s, 'sqli-union', 906), ev);
    expect(s.uptime).toBe(100);
    s.god = false; s.uptime = 5;
    resolve(s, place(s, 'sqli-union', 906), ev);
    expect(s.uptime).toBe(0);
    expect(s.endReason).toBe('serverDown');
  });
});

describe('untarget and checkEnd', () => {
  it('untarget is a no-op without a target', () => {
    const s = freshState(), ev: RunEvent[] = [];
    untarget(s, ev);
    expect(ev).toEqual([]);
  });
  it('checkEnd does nothing outside play', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.phase = 'draft'; s.uptime = 0;
    checkEnd(s, ev);
    expect(s.phase).toBe('draft');
  });
});

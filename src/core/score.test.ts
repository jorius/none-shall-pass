// packages
import { describe, expect, it } from 'vitest';

// core
import { grade, resultOf, shareText, type RunResult } from './score';
import { freshState } from './testkit';

const base = (over: Partial<RunResult> = {}): RunResult => {
  const s = freshState();
  s.phase = 'ended'; s.endReason = 'won'; s.score = 18420; s.wave = 6;
  return { ...resultOf(s), ...over };
};

describe('grade', () => {
  it('grades the campaign by outcome, uptime and mistakes', () => {
    expect(grade(base({ uptime: 95 }))).toBe('S');
    const twoBreaches = base({ uptime: 95 });
    twoBreaches.stats = { ...twoBreaches.stats, breaches: { ...twoBreaches.stats.breaches, sqli: 2 } };
    expect(grade(twoBreaches)).toBe('A');
    const fps = base({ uptime: 80 }); fps.stats = { ...fps.stats, falsePositives: 3 };
    expect(grade(fps)).toBe('B');
    expect(grade(base({ uptime: 60 }))).toBe('B');
    expect(grade(base({ uptime: 30 }))).toBe('C');
    expect(grade(base({ uptime: 10 }))).toBe('D');
    expect(grade(base({ won: false, reason: 'serverDown', uptime: 0 }))).toBe('F');
    expect(grade(base({ won: false, reason: 'usersGone' }))).toBe('F');
  });
  it('applies each threshold at its exact edge', () => {
    const oneBreach = base({ uptime: 90 });
    oneBreach.stats = { ...oneBreach.stats, breaches: { ...oneBreach.stats.breaches, scan: 1 } };
    expect(grade(oneBreach)).toBe('S');
    const twoFps = base({ uptime: 75 }); twoFps.stats = { ...twoFps.stats, falsePositives: 2 };
    expect(grade(twoFps)).toBe('A');
    expect(grade(base({ uptime: 74 }))).toBe('B');
    expect(grade(base({ uptime: 50 }))).toBe('B');
    expect(grade(base({ uptime: 49 }))).toBe('C');
    expect(grade(base({ uptime: 25 }))).toBe('C');
    expect(grade(base({ uptime: 24 }))).toBe('D');
  });
  it('has no grade in overtime', () => {
    expect(grade(base({ mode: 'overtime' }))).toBeNull();
  });
});

describe('shareText', () => {
  it('formats the campaign line in English and Spanish', () => {
    const r = base({ uptime: 80 });
    r.stats = { ...r.stats, falsePositives: 1, breaches: { ...r.stats.breaches, xss: 2 } };
    expect(shareText(r, 'en')).toBe('⚔ NONE SHALL PASS — Grade A · 18,420 pts · 2 breaches · 1 angry user\njorius.github.io/none-shall-pass');
    expect(shareText(r, 'es')).toBe('⚔ NONE SHALL PASS — Nota A · 18.420 pts · 2 brechas · 1 usuario molesto\njorius.github.io/none-shall-pass');
  });
  it('marks root and tampered runs and formats overtime', () => {
    const r = base({ mode: 'overtime', wave: 7, wavesCleared: 6, root: true, tampered: true, score: 31200 });
    expect(shareText(r, 'en')).toBe('⚔ NONE SHALL PASS · OVERTIME — wave 7 · 31,200 pts · ROOT · TAMPERED\njorius.github.io/none-shall-pass');
  });
});

describe('resultOf', () => {
  it('copies what the debrief needs', () => {
    const s = freshState({ root: true });
    s.phase = 'ended'; s.endReason = 'serverDown'; s.uptime = 0; s.wave = 3; s.tampered = true;
    const r = resultOf(s);
    expect(r).toMatchObject({ mode: 'campaign', root: true, tampered: true, won: false, reason: 'serverDown', wave: 3, uptime: 0 });
  });
});

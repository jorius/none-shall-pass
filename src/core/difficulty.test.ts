// packages
import { describe, expect, it } from 'vitest';

// core
import { allowsHints, DIFFICULTIES, DIFFICULTY_IDS, tierWeight } from './difficulty';
import { createState, multiplier, packetSpeed } from './state';
import { cfg } from './testkit';

describe('difficulty', () => {
  it('lists the four difficulties with the spec numbers', () => {
    expect(DIFFICULTY_IDS).toEqual(['intern', 'analyst', 'incident', 'zeroday']);
    expect(DIFFICULTIES.intern).toMatchObject({ mult: 0.5, speed: 0.75, rep: 14, hints: true });
    expect(DIFFICULTIES.analyst).toMatchObject({ mult: 1, speed: 1, rep: 10, hints: true });
    expect(DIFFICULTIES.incident).toMatchObject({ mult: 1.5, speed: 1.25, rep: 8, hints: true });
    expect(DIFFICULTIES.zeroday).toMatchObject({ mult: 2, speed: 1.5, rep: 5, hints: false });
  });

  // Wave 1 deals scans and logins only, so Zero-day's sneaky packets come with their family's first wave, not wave 1.
  it('describes Zero-day without promising sneaky packets in wave 1', () => {
    expect(DIFFICULTIES.zeroday.desc.en).toBe('Packets at 150%, 5 reputation, sneaky attacks from their first wave and more of them, no hints.');
    expect(DIFFICULTIES.zeroday.desc.es).toBe('Paquetes al 150%, 5 de reputación, ataques sigilosos desde su primera oleada y más de ellos, sin pistas.');
  });

  it('gates the tiers: no tricky packets for an intern before wave 4, more of them for the harder ones', () => {
    expect(tierWeight('intern', 3, 2)).toBe(0);
    expect(tierWeight('intern', 3, 3)).toBe(0);
    expect(tierWeight('intern', 4, 2)).toBe(1);
    expect(tierWeight('analyst', 1, 3)).toBe(1);
    expect(tierWeight('incident', 1, 2)).toBe(1);
    expect(tierWeight('incident', 2, 2)).toBe(2);
    expect(tierWeight('zeroday', 1, 3)).toBe(2.5);
    expect(tierWeight('zeroday', 1, 2)).toBe(1.5);
    for (const d of DIFFICULTY_IDS) expect(tierWeight(d, 1, 1)).toBe(1);
  });

  it('feeds the score multiplier, the packet speed, the reputation and the hint lock', () => {
    const z = createState(cfg({ difficulty: 'zeroday', hints: true }));
    expect(multiplier(z)).toBe(2);
    expect(packetSpeed(z)).toBeCloseTo(72 * 1.5);
    expect(z.rep).toBe(5);
    expect(z.hints).toBe(false);
    expect(allowsHints('zeroday')).toBe(false);
    const i = createState(cfg({ difficulty: 'intern', hints: true, root: true }));
    expect(multiplier(i)).toBeCloseTo(0.5 * 0.75 * 1.5);
    expect(i.rep).toBe(14);
    expect(i.hints).toBe(true);
  });
});

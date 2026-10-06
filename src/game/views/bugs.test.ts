// packages
import { describe, expect, it } from 'vitest';

// local
import { bugPath, flyPlan, LAP_SECS } from './bugs';

describe('bug paths', () => {
  it('laps the edge of a 340×54 card: top edge left to right, then down the right side, back along the bottom, up the left', () => {
    expect(bugPath('spider', 0, 340, 54)).toMatchObject({ x: 0, y: 0 });
    expect(bugPath('spider', 0.4, 340, 54).x).toBeGreaterThan(300);
    expect(bugPath('spider', 0.5, 340, 54)).toMatchObject({ x: 340, y: 54 });
    const p = bugPath('spider', 0.99, 340, 54);
    expect(p.x).toBe(0); expect(p.y).toBeGreaterThan(0); expect(p.y).toBeLessThan(10);
  });

  it('turns the sprite along the edge', () => {
    expect(bugPath('beetle', 0.1, 340, 54).rot).toBe(0);
    expect(bugPath('beetle', 0.45, 340, 54).rot).toBeCloseTo(Math.PI / 2);
    expect(bugPath('beetle', 0.6, 340, 54).rot).toBeCloseTo(Math.PI);
  });

  it('gives each species its lap time', () => {
    expect(LAP_SECS).toEqual({ spider: 7, beetle: 9, worm: 16, fly: 0, gnat: 0 });
  });

  it('plans five landing spots for a fly, inside or just outside the card, deterministically', () => {
    const a = flyPlan(3, 340, 54), b = flyPlan(3, 340, 54);
    expect(a).toEqual(b);
    expect(a.length).toBe(5);
    for (const s of a) { expect(s.x).toBeGreaterThan(-20); expect(s.x).toBeLessThan(360); expect(s.stay).toBeGreaterThanOrEqual(1); expect(s.stay).toBeLessThanOrEqual(2); }
    expect(a.some((s) => s.y > 10 && s.y < 44)).toBe(true); // at least one lands across the payload
  });
});

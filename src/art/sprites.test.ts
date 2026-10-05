// packages
import { describe, expect, it } from 'vitest';

// core
import { RACK } from '../core/constants';
import { CARDS } from '../core/content/cards';

// local
import { BUG_OF, critter, iconGrid, knightFoot, knightHorse, rackSprite, spear, SPRITE_DEFS } from './sprites';

const size = (g: (string | null)[][]) => [g[0].length, g.length];
const filled = (g: (string | null)[][]) => g.flat().filter(Boolean).length;

describe('sprites', () => {
  it('keeps the knight inside a lane and the horse a little taller', () => {
    expect(size(knightFoot(false))).toEqual([21, 30]);
    expect(size(knightHorse(0, false))).toEqual([37, 33]);
    expect(filled(knightFoot(true))).toBeLessThan(filled(knightFoot(false)));
    expect(knightHorse(0, false)).not.toEqual(knightHorse(1, false));
  });

  it('builds a full-height rack with units and LEDs', () => {
    const r = rackSprite(RACK.rows);
    expect(size(r.grid)).toEqual([40, RACK.rows + 2]);
    expect(r.units.length).toBe(16);
    expect(r.leds.length).toBeGreaterThan(30);
  });

  it('animates every bug and maps every attack family to one', () => {
    for (const kind of Object.values(BUG_OF)) expect(critter(kind, 0)).not.toEqual(critter(kind, 1));
    expect(BUG_OF).toEqual({ sqli: 'spider', xss: 'worm', brute: 'beetle', scan: 'fly', flood: 'gnat' });
  });

  it('has an icon for every card and unique texture keys', () => {
    for (const c of CARDS) expect(filled(iconGrid(c.icon))).toBeGreaterThan(10);
    const keys = SPRITE_DEFS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(expect.arrayContaining(['knight-foot-idle', 'knight-horse-1', 'squire-throw', 'spear', 'spear-small', 'hammer', 'lock-shut', 'lock-open', 'bug-gnat-1']));
    // registerTextures adds the rack on its own (its size follows RACK.rows), so no def may claim that key.
    expect(keys).not.toContain('rack');
    expect(size(spear())).toEqual([27, 5]);
  });
});

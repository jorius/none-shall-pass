// packages
import { describe, expect, it } from 'vitest';

// core
import { RACK } from '../core/constants';
import { CARDS } from '../core/content/cards';

// local
import { PAL } from './pixels';
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

describe('icon set', () => {
  it('draws every card icon with palette letters only, inside a 16×14 box', () => {
    for (const c of CARDS) {
      const g = iconGrid(c.icon);
      expect(g.length).toBeGreaterThan(0);
      for (const row of g) for (const ch of row) if (ch) expect(PAL[ch], `${c.icon} uses ${ch}`).toBeDefined();
      if (c.icon !== 'horse' && c.icon !== 'squire') { expect(g[0].length).toBe(16); expect(g.length).toBe(14); }
    }
  });

  it('maps the locked set', () => {
    const icon = (id: string) => CARDS.find((c) => c.id === id)!.icon;
    expect(icon('obs1')).toBe('eye'); expect(icon('lens')).toBe('lens'); expect(icon('f2b')).toBe('ban'); expect(icon('tarpit')).toBe('snail');
    expect(icon('prepared')).toBe('puzzle'); expect(icon('sortlist')).toBe('shieldTick'); expect(icon('mfa')).toBe('key'); expect(icon('csp')).toBe('bubble');
    expect(icon('backup')).toBe('db'); expect(icon('lockdown')).toBe('lock'); expect(icon('quote')).toBe('grate'); expect(icon('cdn')).toBe('cloud');
    // The twelve above plus the two actors (horse, squire): the eighteen cards share fourteen icons.
    expect(new Set(CARDS.map((c) => c.icon)).size).toBe(14);
  });

  it('keeps the puzzle piece violet and flat', () => {
    const cells = iconGrid('puzzle').flat().filter(Boolean);
    expect(cells.every((c) => c === 'u' || c === 'o')).toBe(true);
  });

  it('keeps every sprite def on palette letters', () => {
    for (const d of SPRITE_DEFS) for (const row of d.grid()) for (const ch of row) if (ch) expect(PAL[ch], `${d.key} uses ${ch}`).toBeDefined();
  });
});

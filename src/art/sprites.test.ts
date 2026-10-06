// packages
import { describe, expect, it } from 'vitest';

// core
import { RACK } from '../core/constants';
import { CARDS } from '../core/content/cards';
import { KNIGHT_IDS, KNIGHTS } from '../core/content/knights';

// local
import { PAL, type Grid } from './pixels';
import { BUG_OF, critter, iconGrid, knightFoot, knightHorse, knightKey, rackSprite, spear, SPRITE_DEFS, squire, wormPart } from './sprites';

// The v1 Black Knight on foot (`knightFoot(false)` before the six knights), captured once: his body must stay where it was.
const V1_FOOT: Grid = [
  [null, null, null, null, null, null, null, null, null, null, 'o', 'o', null, null, null, null, null, 'o', null, null, null],
  [null, null, null, null, null, null, null, null, null, 'o', 'R', 'R', 'o', null, null, null, 'o', 'S', 'o', null, null],
  [null, null, null, null, null, null, null, null, 'o', 'R', 'R', 'R', 'R', 'o', null, 'o', 's', 'S', 's', 'o', null],
  [null, null, null, null, null, null, null, null, 'o', 'R', 'R', 'r', 'r', 'r', 'o', 'o', 's', 'S', 's', 'o', null],
  [null, null, null, null, null, null, 'o', 'o', 'o', 'o', 'R', 'o', 'r', 'r', 'r', 'o', 's', 'S', 's', 'o', null],
  [null, null, null, null, null, 'o', 'l', 'l', 'm', 'm', 'm', 'd', 'o', 'o', 'o', null, 'o', 'S', 'o', null, null],
  [null, null, null, null, 'o', 'l', 'w', 'l', 'm', 'm', 'm', 'm', 'd', 'o', null, null, 'o', 's', 'o', null, null],
  [null, null, null, null, 'o', 'l', 'l', 'm', 'm', 'm', 'm', 'm', 'd', 'o', null, null, 'o', 'T', 'o', null, null],
  [null, null, null, null, 'o', 'R', 'R', 'R', 'R', 'm', 'm', 'm', 'd', 'o', null, null, 'o', 'T', 'o', null, null],
  [null, null, null, null, 'o', 'k', 'k', 'm', 'm', 'm', 'm', 'd', 'd', 'o', null, null, 'o', 'T', 'o', null, null],
  [null, null, null, null, 'o', 'l', 'm', 'k', 'm', 'm', 'm', 'd', 'd', 'o', null, null, 'o', 'T', 'o', null, null],
  [null, null, null, null, null, 'o', 'm', 'm', 'm', 'm', 'd', 'd', 'o', null, null, null, 'o', 'T', 'o', null, null],
  [null, null, null, null, 'o', 'o', 'o', 'd', 'd', 'd', 'd', 'o', 'o', 'o', 'o', null, 'o', 'T', 'o', null, null],
  [null, 'o', 'o', 'o', 'l', 'l', 'm', 'd', 'm', 'm', 'm', 'd', 'm', 'm', 'd', 'o', 'o', 'T', 'o', null, null],
  ['o', 'l', 'l', 'l', 'l', 'l', 'l', 'd', 'm', 'm', 'm', 'd', 'm', 'm', 'm', 'd', 'o', 'T', 'o', null, null],
  ['o', 'l', 'B', 'B', 'B', 'B', 'b', 'd', 'k', 'k', 'R', 'k', 'k', 'm', 'd', 'd', 'm', 'l', 'd', 'o', null],
  ['o', 'l', 'B', 'B', 'w', 'B', 'b', 'd', 'k', 'k', 'R', 'k', 'k', 'm', 'd', 'o', 'd', 'm', 'd', 'o', null],
  ['o', 'l', 'B', 'w', 'w', 'w', 'b', 'd', 'k', 'R', 'R', 'R', 'k', 'm', 'd', 'o', 'o', 'T', 'o', null, null],
  ['o', 'l', 'B', 'B', 'w', 'B', 'b', 'd', 'k', 'k', 'R', 'k', 'k', 'm', 'd', 'o', 'o', 'T', 'o', null, null],
  ['o', 'l', 'B', 'B', 'w', 'B', 'b', 'd', 'k', 'k', 'R', 'k', 'k', 'd', 'd', 'o', 'o', 'T', 'o', null, null],
  [null, 'o', 'l', 'B', 'B', 'b', 'o', 't', 't', 't', 't', 'y', 't', 't', 't', 'o', 'o', 'T', 'o', null, null],
  [null, 'o', 'l', 'B', 'b', 'o', 'o', 'm', 'm', 'd', 'o', 'm', 'm', 'd', 'o', null, 'o', 'T', 'o', null, null],
  [null, null, 'o', 'l', 'b', 'o', 'o', 'l', 'm', 'd', 'o', 'm', 'm', 'd', 'o', null, 'o', 'T', 'o', null, null],
  [null, null, 'o', 'l', 'o', null, 'o', 'l', 'm', 'd', 'o', 'm', 'm', 'd', 'o', null, 'o', 'T', 'o', null, null],
  [null, null, null, 'o', null, null, 'o', 'm', 'm', 'd', 'o', 'm', 'd', 'd', 'o', null, 'o', 'T', 'o', null, null],
  [null, null, null, null, null, null, 'o', 'l', 'm', 'd', 'o', 'm', 'm', 'd', 'o', null, 'o', 'T', 'o', null, null],
  [null, null, null, null, null, 'o', 'o', 'l', 'm', 'd', 'o', 'm', 'm', 'd', 'o', null, 'o', 'T', 'o', null, null],
  [null, null, null, null, 'o', 'l', 'l', 'm', 'm', 'd', 'o', 'm', 'm', 'm', 'd', 'o', 'o', 'T', 'o', null, null],
  [null, null, null, null, null, 'o', 'o', 'o', 'o', 'o', null, 'o', 'o', 'o', 'o', null, 'o', 'T', 'o', null, null],
  [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 'o', null, null, null],
];

const size = (g: (string | null)[][]) => [g[0].length, g.length];
const filled = (g: (string | null)[][]) => g.flat().filter(Boolean).length;
const BLACK = KNIGHTS.black.look;

describe('sprites', () => {
  it('keeps the knight inside a lane and the horse a little taller', () => {
    expect(size(knightFoot(BLACK, false))).toEqual([21, 30]);
    expect(size(knightHorse(BLACK, 0, false))).toEqual([37, 33]);
    expect(filled(knightFoot(BLACK, true))).toBeLessThan(filled(knightFoot(BLACK, false)));
    expect(knightHorse(BLACK, 0, false)).not.toEqual(knightHorse(BLACK, 1, false));
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
    expect(keys).toEqual(expect.arrayContaining(['knight-black-foot-idle', 'knight-ghost-horse-1', 'squire-throw', 'spear', 'spear-small', 'hammer', 'lock-shut', 'lock-open', 'bug-gnat-1',
      'worm-head', 'worm-body', 'worm-tail', 'bug-worm-1', 'bug-fly-wing']));
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

describe('knights and the squire', () => {
  it('registers seven textures per knight, on that knight\'s palette', () => {
    for (const id of KNIGHT_IDS) {
      for (const pose of ['foot-idle', 'foot-throw', 'horse-0', 'horse-1', 'horse-throw', 'down', 'cheer'] as const) {
        const def = SPRITE_DEFS.find((d) => d.key === knightKey(id, pose));
        expect(def, `${id} ${pose}`).toBeDefined();
        expect(def!.pal ?? {}).toEqual(KNIGHTS[id].pal);
        const g = def!.grid();
        expect(g.length).toBeGreaterThanOrEqual(30);
      }
    }
  });

  it('draws the Black Knight\'s body as before: only the shield and spear columns changed', () => {
    const now = knightFoot(KNIGHTS.black.look, false);
    // The helmet, chest and legs occupy the same cells as the v1 sprite (columns 10..12, rows 1..27).
    for (let y = 1; y <= 27; y++) for (let x = 10; x <= 12; x++) expect(now[y][x] !== null).toBe(V1_FOOT[y][x] !== null);
  });

  it('gives the squire his own body, not the knight\'s', () => {
    const sq = squire(false), kn = knightFoot(KNIGHTS.black.look, false);
    expect(sq.length).toBe(30);
    expect(sq.flat().filter((c) => c === 'a').length).toBeGreaterThan(30);
    expect(sq.flat().join('')).not.toBe(kn.flat().join(''));
  });

  it('has a segmented worm and a housefly with wings', () => {
    expect(wormPart('head')[0].length).toBeGreaterThan(wormPart('body')[0].length);
    expect(wormPart('tail')[0].length).toBeLessThan(wormPart('body')[0].length);
    expect(critter('fly', 0).flat().filter((c) => c === 'e').length).toBeGreaterThan(0);
    expect(critter('fly', 1).flat().join('')).not.toBe(critter('fly', 0).flat().join(''));
  });
});

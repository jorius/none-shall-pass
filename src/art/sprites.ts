// core
import type { IconId } from '../core/content/cards';
import type { MaliciousKind } from '../core/types';

// local
import { draw, grid, line, outline, poly, rect, type Grid } from './pixels';

type Rows = [number, number, string][];

const SHIELD = (x: number, y: number): Rows => [
  [y, x, 'llllll'], [y + 1, x, 'lBBBBb'], [y + 2, x, 'lBBwBb'], [y + 3, x, 'lBwwwb'], [y + 4, x, 'lBBwBb'],
  [y + 5, x, 'lBBwBb'], [y + 6, x + 1, 'lBBb'], [y + 7, x + 1, 'lBb'], [y + 8, x + 2, 'lb'], [y + 9, x + 2, 'l'],
];

const HELM = (x: number, y: number): Rows => [
  [y - 4, x + 5, 'RR'], [y - 3, x + 4, 'RRRR'], [y - 2, x + 4, 'RRrrr'], [y - 1, x + 5, 'R'], [y - 1, x + 7, 'rrr'],
  [y, x + 1, 'llmmmd'], [y + 1, x, 'lwlmmmmd'], [y + 2, x, 'llmmmmmd'], [y + 3, x, 'RRRRmmmd'], [y + 4, x, 'kkmmmmdd'],
  [y + 5, x, 'lmkmmmdd'], [y + 6, x + 1, 'mmmmdd'], [y + 7, x + 2, 'dddd'],
];

// The Black Knight on foot, facing left, spear upright (or thrown).
export const knightFoot = (throwing: boolean): Grid => {
  const rows: Rows = [];
  if (!throwing) {
    rows.push([1, 17, 'S'], [2, 16, 'sSs'], [3, 16, 'sSs'], [4, 16, 'sSs'], [5, 17, 'S'], [6, 17, 's']);
    for (let y = 7; y <= 28; y++) rows.push([y, 17, 'T']);
  }
  rows.push(...HELM(5, 5));
  rows.push(
    [13, 4, 'llmdmmmdmmd'], [14, 3, 'lwlmdmmmdmmmd'],
    [15, 7, 'dkkRkkmdd'], [16, 7, 'dkkRkkmd'], [17, 7, 'dkRRRkmd'], [18, 7, 'dkkRkkmd'], [19, 7, 'dkkRkkdd'], [20, 7, 'ttttyttt'],
    [21, 7, 'mmd'], [21, 11, 'mmd'],
    [22, 7, 'lmd'], [22, 11, 'mmd'], [23, 7, 'lmd'], [23, 11, 'mmd'], [24, 7, 'mmd'], [24, 11, 'mdd'],
    [25, 7, 'lmd'], [25, 11, 'mmd'], [26, 7, 'lmd'], [26, 11, 'mmd'], [27, 5, 'llmmd'], [27, 11, 'mmmd'],
  );
  if (!throwing) rows.push([15, 16, 'mld'], [16, 16, 'dmd']);
  else rows.push([13, 14, 'dm'], [12, 15, 'mm'], [11, 15, 'lm'], [10, 15, 'ml']);
  rows.push(...SHIELD(1, 14));
  return outline(draw(grid(21, 30), rows));
};

// The knight on his destrier; frame 0/1 are the gallop's two leg poses.
export const knightHorse = (frame: 0 | 1, throwing: boolean): Grid => {
  const g = grid(37, 33);
  poly(g, [[30, 16], [33, 17], [35, 25], [33, 24], [31, 20]], 'k');
  const legs: [number, number, number, number, string][] = frame === 0
    ? [[16, 24, 16, 30, 'H'], [29, 24, 29, 30, 'H'], [13, 24, 13, 30, 'h'], [26, 24, 26, 30, 'h']]
    : [[16, 24, 13, 30, 'H'], [29, 24, 33, 29, 'H'], [13, 24, 9, 30, 'h'], [26, 24, 29, 30, 'h']];
  legs.forEach(([x0, y0, x1, y1, c]) => { line(g, x0, y0, x1, y1, c, 2); line(g, x1, y1, x1, y1, 'k', 2); });
  poly(g, [[8, 6], [8, 3], [10, 6]], 'h');
  poly(g, [[10, 6], [11, 3], [12, 7]], 'H');
  poly(g, [[10, 7], [13, 8], [17, 15], [16, 21], [11, 21], [9, 14], [11, 11]], 'h');
  poly(g, [[7, 6], [11, 6], [12, 9], [10, 13], [6, 17], [2, 18], [0, 17], [1, 15], [5, 10]], 'h');
  poly(g, [[0, 16], [3, 15], [4, 17], [2, 18], [0, 17]], 'H');
  poly(g, [[10, 6], [12, 6], [17, 13], [17, 16], [15, 15], [12, 9]], 'k');
  g[9][8] = 'k'; g[17][1] = 'n';
  line(g, 9, 8, 6, 14, 'R'); line(g, 2, 15, 6, 14, 'R'); line(g, 6, 14, 17, 14, 'r');
  poly(g, [[12, 16], [28, 15], [31, 17], [31, 22], [28, 24], [13, 24], [11, 21]], 'h');
  poly(g, [[13, 15], [29, 15], [30, 22], [29, 25], [13, 25], [12, 22]], 'c');
  [16, 20, 24, 28].forEach((x) => line(g, x, 16, x, 23, 'C'));
  line(g, 13, 24, 29, 24, 'R'); line(g, 13, 25, 29, 25, 'r');
  draw(g, [[18, 20, 'BB'], [19, 19, 'BwwB'], [20, 20, 'BB']]);
  draw(g, [[15, 13, 'tTTTTTTTTt']]);
  if (!throwing) {
    draw(g, [[0, 25, 'S'], [1, 24, 'sSs'], [2, 24, 'sSs'], [3, 24, 'sSs'], [4, 25, 'S'], [5, 25, 's']]);
    line(g, 25, 6, 25, 26, 'T');
  }
  draw(g, HELM(14, 4));
  draw(g, [[12, 14, 'lmdmmmdmmd'], [13, 14, 'dkkRkkmdd'], [14, 14, 'dkRRRkmd'],
    [16, 18, 'lmd'], [17, 18, 'lmd'], [18, 18, 'lmd'], [19, 18, 'lmd'], [20, 17, 'llmd'], [21, 17, 'yyy']]);
  if (!throwing) draw(g, [[12, 24, 'mld'], [13, 24, 'dmd']]);
  else draw(g, [[11, 22, 'dm'], [10, 23, 'mm'], [9, 24, 'lm']]);
  draw(g, SHIELD(13, 11));
  return outline(g);
};

// A thrown spear, pointing left.
export const spear = (): Grid =>
  outline(draw(grid(27, 5), [[1, 1, 'sS'], [2, 0, 'SSSs'], [3, 1, 'sS'], [2, 4, 'TTTTTTTTTTTTTTTTTTTTt'], [1, 21, 'R'], [3, 22, 'R'], [1, 23, 'r']]));

// The server rack, `rows` tall; LEDs are returned separately so the view can blink them.
export const rackSprite = (rows: number): { grid: Grid; leds: [number, number, 'blue' | 'green'][]; units: number[] } => {
  const g = grid(40, rows + 2);
  const leds: [number, number, 'blue' | 'green'][] = [];
  const units: number[] = [];
  rect(g, 0, 0, 40, rows, 'F'); rect(g, 1, 1, 38, rows - 2, 'E');
  rect(g, 2, 2, 2, rows - 4, 'Q'); rect(g, 36, 2, 2, rows - 4, 'Q');
  for (let y = 4; y < rows - 2; y += 3) { g[y][3] = 'Z'; g[y][36] = 'Z'; }
  for (let x = 6; x < 34; x += 2) rect(g, x, 3, 1, 2, 'Z');
  let i = 0;
  for (let y = 7; y + 7 <= rows - 13; y += 8, i++) {
    units.push(y);
    rect(g, 5, y, 30, 7, 'U'); rect(g, 6, y + 1, 28, 5, 'V');
    if (i % 3 === 1) {
      for (let x = 7; x < 24; x += 2) rect(g, x, y + 2, 1, 3, 'Z');
      rect(g, 25, y + 2, 5, 3, 'G');
      leds.push([26, y + 3, 'green'], [28, y + 3, 'green']);
    } else {
      [7, 13, 19, 25].forEach((x) => { rect(g, x, y + 2, 5, 3, 'Z'); rect(g, x + 1, y + 3, 3, 1, 'l'); });
    }
    leds.push([32, y + 2, i % 2 ? 'green' : 'blue'], [32, y + 4, 'blue']);
    rect(g, 34, y + 3, 1, 1, i % 2 ? 'B' : 'R');
  }
  for (let y = 10; y < rows - 14; y++) g[y][35] = y < rows / 2 ? 'B' : 'R';
  const py = rows - 11;
  rect(g, 5, py, 30, 8, 'U'); rect(g, 6, py + 1, 28, 6, 'V');
  [9, 23].forEach((x) => { rect(g, x, py + 2, 8, 4, 'Z'); rect(g, x + 1, py + 3, 6, 2, 'Q'); rect(g, x + 3, py + 2, 2, 4, 'Q'); });
  rect(g, 2, rows, 4, 2, 'F'); rect(g, 34, rows, 4, 2, 'F');
  return { grid: g, leds, units };
};

export const ICONS = {
  grate: (): Grid => {
    const g = grid(16, 14);
    rect(g, 1, 1, 14, 12, 'd'); rect(g, 2, 2, 12, 10, 'k');
    [3, 6, 9, 12].forEach((x) => rect(g, x, 2, 1, 10, 'l'));
    rect(g, 2, 6, 12, 1, 'm');
    return outline(g);
  },
  hammer: (): Grid => outline(draw(grid(16, 14), [[1, 2, 'lllllllll'], [2, 2, 'wlmmmmmmd'], [3, 2, 'lmmmmmmmd'], [4, 2, 'dddddddddd'], [5, 6, 'T'], [6, 6, 'T'], [7, 6, 'TT'], [8, 7, 'T'], [9, 7, 'T'], [10, 7, 'TT'], [11, 8, 'T'], [12, 8, 't']])),
  tar: (): Grid => outline(draw(grid(16, 14), [[5, 4, 'C..C'], [6, 3, 'CkkC'], [8, 2, 'kkkkkkkkk'], [9, 1, 'kkkCkkkkkkkk'], [10, 1, 'kkkkkkkCkkkkk'], [11, 2, 'kkkkkkkkkkk'], [7, 9, 'C'], [6, 10, 'CC']])),
  lens: (): Grid => outline(draw(grid(16, 14), [[1, 3, 'llll'], [2, 2, 'lBBjjl'], [3, 1, 'lBBBjjl'], [4, 1, 'lBBBBjl'], [5, 1, 'lBBBBBl'], [6, 2, 'lBBBl'], [7, 3, 'lll'], [7, 7, 'T'], [8, 8, 'TT'], [9, 9, 'TT'], [10, 10, 'TT'], [11, 11, 'tt']])),
  shield: (): Grid => outline(draw(grid(16, 14), [[1, 3, 'lllllllll'], [2, 3, 'lBBBBBBBb'], [3, 3, 'lBBBBBBwb'], [4, 3, 'lBBBBBwBb'], [5, 3, 'lBwBBwBBb'], [6, 3, 'lBBwwBBBb'], [7, 4, 'lBBwBBb'], [8, 4, 'lBBBBBb'], [9, 5, 'lBBBb'], [10, 6, 'lBb'], [11, 7, 'b']])),
  tape: (): Grid => outline(draw(grid(16, 14), [[2, 1, 'kkkkkkkkkkkkk'], [3, 1, 'kllkkkkkkllkk'], [4, 1, 'klwlkkkklwlkk'], [5, 1, 'kllkkkkkkllkk'], [6, 1, 'kkkkkkkkkkkkk'], [7, 1, 'kkkTTTTTTTkkk'], [8, 1, 'kkkkkkkkkkkkk']])),
  eye: (): Grid => outline(draw(grid(16, 14), [[4, 4, 'wwwwwwww'], [5, 2, 'wwwbBBBbwwww'], [6, 1, 'wwwbBkkBbwwww'], [7, 1, 'wwwbBkkBbwwww'], [8, 2, 'wwwbBBBbwwww'], [9, 4, 'wwwwwwww'], [2, 6, 'R'], [1, 9, 'R'], [11, 12, 'r'], [12, 11, 'rr']])),
  lock: (): Grid => outline(draw(grid(16, 14), [[1, 5, 'llllll'], [2, 4, 'l'], [2, 11, 'l'], [3, 4, 'l'], [3, 11, 'l'], [4, 4, 'l'], [4, 11, 'l'],
    [5, 2, 'RRRRRRRRRRRR'], [6, 2, 'RRRRRRRRRRRR'], [7, 2, 'RRRRRkkRRRRR'], [8, 2, 'RRRRRkkRRRRR'], [9, 2, 'RRRRRRkRRRRR'], [10, 2, 'rRRRRRRRRRRr'], [11, 2, 'rrrrrrrrrrrr']])),
  cloud: (): Grid => outline(draw(grid(16, 14), [[3, 5, 'iiii'], [4, 3, 'iiiiiiii'], [4, 11, 'ii'], [5, 2, 'iiiiiiiiiiii'], [6, 1, 'iiiiiiiiiiiiii'], [7, 1, 'jjjjjjjjjjjjjj'], [8, 2, 'jjjjjjjjjjjj'], [10, 4, 'B'], [10, 8, 'B'], [10, 12, 'B'], [11, 3, 'B'], [11, 7, 'B'], [11, 11, 'B']])),
  lockShut: (): Grid => outline(draw(grid(10, 10), [[1, 3, 'llll'], [2, 2, 'l'], [2, 7, 'l'], [3, 2, 'l'], [3, 7, 'l'], [4, 1, 'RRRRRRRR'], [5, 1, 'RRRkkRRR'], [6, 1, 'RRRkkRRR'], [7, 1, 'rRRRRRRr'], [8, 1, 'rrrrrrrr']])),
  lockOpen: (): Grid => outline(draw(grid(10, 10), [[0, 3, 'llll'], [1, 2, 'l'], [1, 7, 'l'], [2, 2, 'l'], [4, 1, 'BBBBBBBB'], [5, 1, 'BBBkkBBB'], [6, 1, 'BBBkkBBB'], [7, 1, 'bBBBBBBb'], [8, 1, 'bbbbbbbb']])),
};

export type BugKind = 'spider' | 'worm' | 'beetle' | 'fly' | 'gnat';
export const BUG_OF: Record<MaliciousKind, BugKind> = { sqli: 'spider', xss: 'worm', brute: 'beetle', scan: 'fly', flood: 'gnat' };

const legLines = (g: Grid, attach: [number, number][], ends: [number, number][], c: string): void =>
  attach.forEach(([ax, ay], i) => line(g, ax, ay, ends[i][0], ends[i][1], c));
const mirror = (pts: [number, number][], w: number): [number, number][] => pts.map(([x, y]) => [w - x, y]);

export const critter = (kind: BugKind, f: 0 | 1): Grid => {
  if (kind === 'spider') {
    const g = grid(17, 13);
    const A: [number, number][] = [[3, 1], [1, 4], [1, 8], [3, 11]], B: [number, number][] = [[2, 0], [0, 3], [0, 7], [2, 10]];
    const at: [number, number][] = [[5, 4], [5, 5], [5, 7], [5, 8]];
    legLines(g, at, f ? B : A, 'r'); legLines(g, mirror(at, 16), mirror(f ? A : B, 16), 'r');
    draw(g, [[2, 7, 'RRR'], [3, 6, 'RwRwR'], [4, 6, 'RRRRR'], [5, 5, 'RRRRRRR'], [6, 5, 'RRrRrRR'], [7, 5, 'RRRRRRR'], [8, 5, 'RRrRrRR'], [9, 6, 'RRRRR'], [10, 7, 'RRR']]);
    return outline(g);
  }
  if (kind === 'beetle') {
    const g = grid(15, 14);
    const A: [number, number][] = [[1, 2], [0, 6], [1, 11]], B: [number, number][] = [[0, 3], [1, 7], [2, 12]];
    const at: [number, number][] = [[4, 4], [4, 6], [4, 9]];
    legLines(g, at, f ? B : A, 'G'); legLines(g, mirror(at, 14), mirror(f ? A : B, 14), 'G');
    line(g, 6, 2, 5, 0, 'G'); line(g, 8, 2, 9, 0, 'G');
    draw(g, [[2, 6, 'GGG'], [3, 5, 'ggGgg'], [4, 4, 'gwgGggg'], [5, 4, 'gwgGggg'], [6, 4, 'gggGggg'], [7, 4, 'gggGggg'], [8, 4, 'gggGggg'], [9, 4, 'gggGggg'], [10, 5, 'ggGgg'], [11, 6, 'ggg']]);
    return outline(g);
  }
  if (kind === 'fly') {
    const g = grid(15, 12);
    if (f) { poly(g, [[6, 4], [1, 1], [0, 4], [5, 6]], 'j'); poly(g, [[9, 4], [14, 1], [15, 4], [10, 6]], 'j'); }
    else { poly(g, [[6, 5], [2, 7], [1, 10], [6, 8]], 'j'); poly(g, [[9, 5], [13, 7], [14, 10], [9, 8]], 'j'); }
    draw(g, [[2, 6, 'RmR'], [3, 6, 'mmm'], [4, 6, 'mdm'], [5, 6, 'mdm'], [6, 6, 'mdm'], [7, 6, 'mdm'], [8, 7, 'm']]);
    return outline(g);
  }
  if (kind === 'gnat') {
    const g = grid(9, 8);
    draw(g, f ? [[1, 1, 'jj'], [1, 6, 'jj'], [2, 2, 'j'], [2, 6, 'j']] : [[5, 1, 'jj'], [5, 6, 'jj'], [4, 2, 'j'], [4, 6, 'j']]);
    draw(g, [[2, 4, 'R'], [3, 3, 'mmm'], [4, 3, 'mdm'], [5, 4, 'm']]);
    return outline(g);
  }
  const g = grid(19, 8);
  for (let i = 0; i < 7; i++) {
    const x = 1 + i * 2, y = 3 + Math.round(Math.sin(i * 0.9 + (f ? Math.PI : 0)) * 1.4);
    rect(g, x, y, 2, 2, i % 2 ? 'y' : 'T');
    if (i === 6) { rect(g, x + 2, y, 2, 2, 'y'); g[y][x + 3] = 'k'; }
  }
  return outline(g);
};

export const iconGrid = (icon: IconId): Grid =>
  icon === 'horse' ? knightHorse(0, false) : icon === 'squire' ? knightFoot(false) : ICONS[icon]();

const BUGS: BugKind[] = ['spider', 'worm', 'beetle', 'fly', 'gnat'];

export const SPRITE_DEFS: { key: string; grid: () => Grid; scale: number }[] = [
  { key: 'knight-foot-idle', grid: () => knightFoot(false), scale: 3 },
  { key: 'knight-foot-throw', grid: () => knightFoot(true), scale: 3 },
  { key: 'knight-horse-0', grid: () => knightHorse(0, false), scale: 3 },
  { key: 'knight-horse-1', grid: () => knightHorse(1, false), scale: 3 },
  { key: 'knight-horse-throw', grid: () => knightHorse(0, true), scale: 3 },
  { key: 'squire-idle', grid: () => knightFoot(false), scale: 2 },
  { key: 'squire-throw', grid: () => knightFoot(true), scale: 2 },
  { key: 'spear', grid: spear, scale: 3 },
  { key: 'spear-small', grid: spear, scale: 2 },
  { key: 'hammer', grid: ICONS.hammer, scale: 3 },
  { key: 'lock-shut', grid: ICONS.lockShut, scale: 2 },
  { key: 'lock-open', grid: ICONS.lockOpen, scale: 2 },
  ...BUGS.flatMap((b) => ([0, 1] as const).map((f) => ({ key: `bug-${b}-${f}`, grid: () => critter(b, f), scale: 2 }))),
];

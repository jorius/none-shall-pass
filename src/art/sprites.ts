// core
import type { IconId } from '../core/content/cards';
import { KNIGHT_IDS, KNIGHTS, type KnightId, type KnightLook } from '../core/content/knights';
import type { MaliciousKind } from '../core/types';

// local
import { disc, draw, ell, grid, line, outline, poly, rect, rowsToGrid, set, type Grid } from './pixels';

type Rows = [number, number, string][];
type Row = Rows[number];

const shift = (rows: Rows, dx: number, dy: number): Rows => rows.map(([y, x, s]): Row => [y + dy, x + dx, s]);

// A heater shield, 9 wide and 12 tall: a lit rim, a dark inner border and the knight's emblem centred on the field.
const EMBLEM: Record<KnightLook['shield'], string[]> = {
  cross: ['bBBwBBb', 'bBwwwBb', 'bBBwBBb', 'bBBwBBb'],
  eye: ['bBwwwBb', 'bwwkwwb', 'bBwwwBb', 'bBBBBBb'],
  blade: ['bBBwBBb', 'bBBwBBb', 'bBwwwBb', 'bBByBBb'],
  split: ['bAAABBb', 'bAAABBb', 'bAAABBb', 'bAAABBb'],
  // a white mask with dark eye holes (Ghost) and a `>_` prompt (Forge)
  mask: ['bSSSSSb', 'bSkSkSb', 'bSSSSSb', 'bBSSSBb'],
  prompt: ['bBwBBBb', 'bBBwBBb', 'bBwBBBb', 'bBBBwwb'],
};
const SHIELD = (x: number, y: number, emblem: KnightLook['shield']): Rows =>
  ['lllllllll', 'lbbbbbbbd', ...EMBLEM[emblem].map((r) => `l${r}d`), 'lbBBBBBbd', '.lbBBBbd.', '.lbBBBbd.', '..lbBbd..', '...lbd...', '....d....']
    .map((s, i): Row => [y + i, x, s]);

// The pennant below the socket: on foot it flies left of the shaft; on horseback its mirror flies right of it,
// drawn after the helmet, where a braid (which hangs down the left side) cannot cover it.
const PENNANT: Rows = [[8, 14, 'RRRR'], [9, 15, 'rRR'], [10, 16, 'rR'], [11, 17, 'r']];
const PENNANT_R: Rows = [[8, 19, 'RRRR'], [9, 19, 'RRr'], [10, 19, 'Rr'], [11, 19, 'r']];

// The spear upright at column 18: a leaf-shaped head, a gold socket, the pennant, a wrapped shaft and a butt cap; (dx, dy) moves it.
const SPEAR = (dx = 0, dy = 0, pennant: Rows = PENNANT): Rows => {
  const rows: Rows = [[0, 18, 'S'], [1, 17, 'sSS'], [2, 17, 'sSS'], [3, 17, 'sSw'], [4, 17, 'ssS'], [5, 18, 's'], [6, 18, 'y'], [7, 18, 'y'], ...pennant];
  for (let y = 8; y <= 27; y++) rows.push([y, 18, y % 5 === 0 ? 't' : 'T']);
  rows.push([28, 18, 'm']);
  return shift(rows, dx, dy);
};

// The helmet with its top-left at (x, y): a plume or goggles, a braid down the back, a closed visor or an open face, a beard.
const HELM = (x: number, y: number, look: KnightLook): Rows => {
  const rows: Rows = [];
  if (look.plume) rows.push([y - 4, x + 5, 'RR'], [y - 3, x + 4, 'RRRR'], [y - 2, x + 4, 'RRrrr'], [y - 1, x + 5, 'R'], [y - 1, x + 7, 'rrr']);
  // goggles pushed up on the helmet instead of a plume
  if (look.goggles) rows.push([y - 2, x + 1, 'yjy.yjy'], [y - 1, x + 1, 'yjyyyjy']);
  // the braid's main colour with its shade at the ties (a knight's palette swaps both)
  if (look.braid) {
    rows.push([y + 2, x + 8, 'y'], [y + 3, x + 8, 'yy'], [y + 4, x + 9, 'yy'], [y + 5, x + 8, 'yy'], [y + 6, x + 9, 'yy'], [y + 7, x + 8, 'yy'],
      [y + 8, x + 9, 'yy'], [y + 9, x + 9, 'y'], [y + 10, x + 9, 'Y'], [y + 11, x + 9, 'y'], [y + 12, x + 10, 'Y']);
  }
  rows.push([y, x + 1, 'llmmmd'], [y + 1, x, 'lwlmmmmd'], [y + 2, x, 'llmmmmmd']);
  if (look.face === 'open') rows.push([y + 3, x, 'mpppmmmd'], [y + 4, x, 'mkppPmdd'], [y + 5, x, 'mppPmmdd']);
  else rows.push([y + 3, x, 'RRRRmmmd'], [y + 4, x, 'kkmmmmdd'], [y + 5, x, 'lmkmmmdd']);
  if (look.beard === 'red') rows.push([y + 6, x + 1, 'XXXXdd'], [y + 7, x + 2, 'xXXx']);
  else if (look.beard === 'brown') rows.push([y + 6, x + 1, 'ttTtdd'], [y + 7, x + 2, 'tTtt']);
  else rows.push([y + 6, x + 1, 'mmmmdd'], [y + 7, x + 2, 'dddd']);
  return rows;
};

// The surcoat (rows 15–19 of the foot sprite): the cross, a plain field, a chevron, red-and-brown halves,
// a dark cloak with a green clasp (Ghost) and a leather apron with brass rivets (Forge).
const CHEST: Record<KnightLook['chest'], Rows> = {
  cross: [[15, 7, 'dkkRkkmdd'], [16, 7, 'dkkRkkmd'], [17, 7, 'dkRRRkmd'], [18, 7, 'dkkRkkmd'], [19, 7, 'dkkRkkdd']],
  plain: [[15, 7, 'dRRRRRmdd'], [16, 7, 'dRRRRRmd'], [17, 7, 'dRRwRRmd'], [18, 7, 'dRRRRRmd'], [19, 7, 'dRRRRRdd']],
  chevron: [[15, 7, 'dRkkkRmdd'], [16, 7, 'dkRkRkmd'], [17, 7, 'dkkRkkmd'], [18, 7, 'dkkkkkmd'], [19, 7, 'dkkkkkdd']],
  split: [[15, 7, 'dAAARRmdd'], [16, 7, 'dAAARRmd'], [17, 7, 'dAAARRmd'], [18, 7, 'dAAARRmd'], [19, 7, 'dAAARRdd']],
  cloak: [[15, 7, 'dcccccmdd'], [16, 7, 'dcgccccmd'], [17, 7, 'dcccccmd'], [18, 7, 'dcccccmd'], [19, 7, 'dcccccdd']],
  apron: [[15, 7, 'dtTTTtmdd'], [16, 7, 'dtTyTtmd'], [17, 7, 'dtTTTtmd'], [18, 7, 'dtTyTtmd'], [19, 7, 'dtTTTtdd']],
};

// The body on foot: the shoulders under the helmet, then (below the surcoat) the belt and the legs.
const SHOULDERS: Rows = [[13, 4, 'llmdmmmdmmd'], [14, 3, 'lwlmdmmmdmmmd']];
const LEGS: Rows = [[20, 7, 'ttttyttt'], [21, 7, 'mmd'], [21, 11, 'mmd'], [22, 7, 'lmd'], [22, 11, 'mmd'], [23, 7, 'lmd'], [23, 11, 'mmd'], [24, 7, 'mmd'], [24, 11, 'mdd'],
  [25, 7, 'lmd'], [25, 11, 'mmd'], [26, 7, 'lmd'], [26, 11, 'mmd'], [27, 5, 'llmmd'], [27, 11, 'mmmd']];
const GAUNTLET = (y: number): Rows => [[y, 15, 'mlld'], [y + 1, 15, 'dmmd']];
const THROWN_ARM: Rows = [[13, 14, 'dm'], [12, 15, 'mm'], [11, 15, 'lm'], [10, 15, 'ml']];

// A knight on foot, facing left, with the given spear rows and spear-arm rows.
const foot = (look: KnightLook, spear: Rows, arm: Rows): Grid =>
  outline(draw(grid(21, 30), [...spear, ...HELM(5, 5, look), ...SHOULDERS, ...CHEST[look.chest], ...LEGS, ...arm, ...SHIELD(0, 14, look.shield)]));

// The knight on foot, spear upright (or thrown).
export const knightFoot = (look: KnightLook, throwing: boolean): Grid => foot(look, throwing ? [] : SPEAR(), throwing ? THROWN_ARM : GAUNTLET(15));

// The win: the spear lifted, the fist five rows up with it. The head already sits at the top of the frame,
// so the lift shows at the other end: the shaft stops at row 23 and the butt hangs five rows off the ground.
export const knightCheer = (look: KnightLook): Grid => foot(look, SPEAR().filter(([y]) => y <= 23), GAUNTLET(10));

// The loss: the knight on one knee, spear planted.
export const knightDown = (look: KnightLook): Grid => {
  const rows: Rows = [...SPEAR(0, 2)];
  rows.push(...HELM(5, 9, look));
  rows.push(...shift(SHOULDERS, 0, 4));
  rows.push(...shift(CHEST[look.chest], 0, 4));
  rows.push([24, 7, 'ttttyttt'], [25, 5, 'mmmmmmdd'], [26, 4, 'lmmmmmmmd'], [27, 3, 'llmmd'], [27, 11, 'mmmd'], [28, 10, 'mmmd'], [28, 3, 'ldd']);
  rows.push(...GAUNTLET(19));
  rows.push(...SHIELD(0, 18, look.shield));
  return outline(draw(grid(21, 30), rows));
};

// The knight on his destrier; frame 0/1 are the gallop's two leg poses.
export const knightHorse = (look: KnightLook, frame: 0 | 1, throwing: boolean): Grid => {
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
  if (!throwing) draw(g, SPEAR(7, 0, []));
  draw(g, HELM(14, 4, look));
  if (!throwing) draw(g, shift(PENNANT_R, 7, 0));
  draw(g, [[12, 14, 'lmdmmmdmmd'], ...shift(CHEST[look.chest], 7, -2),
    [16, 18, 'lmd'], [17, 18, 'lmd'], [18, 18, 'lmd'], [19, 18, 'lmd'], [20, 17, 'llmd'], [21, 17, 'yyy']]);
  if (!throwing) draw(g, [[12, 24, 'mld'], [13, 24, 'dmd']]);
  else draw(g, [[11, 22, 'dm'], [10, 23, 'mm'], [9, 24, 'lm']]);
  // One row lower than on foot relative to the helmet, so a beard's first row clears the rim.
  draw(g, SHIELD(12, 11, look.shield));
  return outline(g);
};

// The squire, a man-at-arms in training: a kettle hat over a mail coif, a quilted gambeson with the knight's red cross,
// a round buckler and a short spear with the same pennant. Shaded like the knight, smaller and lighter.
export const squire = (throwing: boolean): Grid => {
  const g = rowsToGrid([
    '.....................',
    '.....................',
    '......lllll..........',
    '.....lwlllll.........',
    '.....llllllm.........',
    '...ddddddddddd.......',
    '....spkpppPPs........',
    '....spppppPPs........',
    '....sppPPPPPs........',
    '.....ssppPPss........',
    '......ssssss.........',
    '....aaaaaaaaa........',
    '...aaaaaaaaaaA.......',
    '..lllaaaRaaaaAA......',
    '.lmwmlaRRRaaaaAA.....',
    '.lmmmlaaRaaaaAAA.....',
    '..lllaaaaaaaaA.......',
    '....aAaAaAaAa........',
    '....aaaaaaaaa........',
    '....ttttytttt........',
    '....aaaaaaaaa........',
    '....aAaaAaaAa........',
    '.....nn...nn.........',
    '.....Hn...Hn.........',
    '.....Hn...Hn.........',
    '.....Hn...Hn.........',
    '.....tt...tt.........',
    '....ttt...ttt........',
    '...tttt...tttt.......',
    '.....................',
  ]);
  if (!throwing) {
    draw(g, [[0, 18, 'S'], [1, 17, 'sSS'], [2, 17, 'sSw'], [3, 17, 'ssS'], [4, 18, 's'], [5, 18, 'y'], [6, 14, 'RRRR'], [7, 15, 'rRR'], [8, 16, 'rR']]);
    for (let y = 6; y <= 28; y++) if (!g[y][18]) g[y][18] = 'T';
    draw(g, [[14, 16, 'pp'], [15, 16, 'pp']]);
  } else {
    draw(g, [[1, 3, 'SsTTTTTTTTTTTT'], [0, 4, 's'], [2, 4, 's'], [2, 15, 'pp'], [3, 15, 'p'], [4, 14, 'Ap'], [5, 14, 'A'], [6, 13, 'AA'], [7, 13, 'A'], [8, 13, 'A'], [9, 13, 'A'], [10, 12, 'A']]);
  }
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

// One flat shield for the SERVER branch: a dark-blue rim, a flat blue field, and a mark on it.
const shieldBase = (): Grid => draw(grid(16, 14), [[1, 3, 'bbbbbbbbb'], [2, 3, 'bBBBBBBBb'], [3, 3, 'bBBBBBBBb'], [4, 3, 'bBBBBBBBb'], [5, 3, 'bBBBBBBBb'], [6, 3, 'bBBBBBBBb'], [7, 4, 'bBBBBBb'], [8, 4, 'bBBBBBb'], [9, 5, 'bBBBb'], [10, 6, 'bBb'], [11, 7, 'b']]);
const marked = (cells: [number, number][], c = 'w'): Grid => { const g = shieldBase(); cells.forEach(([x, y]) => set(g, x, y, c)); return outline(g); };

// The card icons (16×14, flat, outlined) and the field-object grids (hammer, lockShut, lockOpen).
export const ICONS = {
  grate: (): Grid => {
    const g = grid(16, 14);
    rect(g, 1, 1, 14, 12, 'd'); rect(g, 2, 2, 12, 10, 'k');
    [3, 6, 9, 12].forEach((x) => rect(g, x, 2, 1, 10, 'l'));
    rect(g, 2, 6, 12, 1, 'm');
    return outline(g);
  },
  hammer: (): Grid => outline(draw(grid(16, 14), [[1, 2, 'lllllllll'], [2, 2, 'wlmmmmmmd'], [3, 2, 'lmmmmmmmd'], [4, 2, 'dddddddddd'], [5, 6, 'T'], [6, 6, 'T'], [7, 6, 'TT'], [8, 7, 'T'], [9, 7, 'T'], [10, 7, 'TT'], [11, 8, 'T'], [12, 8, 't']])),
  lock: (): Grid => outline(draw(grid(16, 14), [[1, 5, 'llllll'], [2, 4, 'l'], [2, 11, 'l'], [3, 4, 'l'], [3, 11, 'l'], [4, 4, 'l'], [4, 11, 'l'],
    [5, 2, 'RRRRRRRRRRRR'], [6, 2, 'RRRRRRRRRRRR'], [7, 2, 'RRRRRkkRRRRR'], [8, 2, 'RRRRRkkRRRRR'], [9, 2, 'RRRRRRkRRRRR'], [10, 2, 'RRRRRRRRRRRR'], [11, 2, 'RRRRRRRRRRRR']])),
  cloud: (): Grid => outline(draw(grid(16, 14), [[3, 5, 'iiii'], [4, 3, 'iiiiiiii'], [4, 11, 'ii'], [5, 2, 'iiiiiiiiiiii'], [6, 1, 'iiiiiiiiiiiiii'], [7, 1, 'iiiiiiiiiiiiii'], [8, 2, 'iiiiiiiiiiii'], [10, 4, 'B'], [10, 8, 'B'], [10, 12, 'B'], [11, 3, 'B'], [11, 7, 'B'], [11, 11, 'B']])),
  // an almond eye: lid line, white, blue iris, black pupil with a glint
  eye: (): Grid => outline(rowsToGrid([
    '................',
    '................',
    '......dddd......',
    '....ddSSSSdd....',
    '..ddSSSBBSSSdd..',
    '.dSSSSBbbBSSSSd.',
    'dSSSSBbikbBSSSSd',
    'dSSSSBbkkbBSSSSd',
    '.dSSSSBbbBSSSSd.',
    '..ddSSSBBSSSdd..',
    '....ddSSSSdd....',
    '......dddd......',
    '................',
    '................',
  ])),
  // a round lens: true circle rim, glass, a glint, and a handle that comes out from under the rim
  lens: (): Grid => {
    const g = grid(16, 14);
    disc(g, 6.5, 5.5, 0, 3.6, 'j');
    disc(g, 6.5, 5.5, 3.6, 5.2, 'l');
    set(g, 4, 3, 'i'); set(g, 5, 3, 'i'); set(g, 4, 4, 'i');
    // a solid handle, three cells thick, drawn after the rim so it visibly enters it
    set(g, 10, 7, 'T'); set(g, 9, 8, 'T');
    for (let i = 0; i < 6; i++) { set(g, 10 + i, 8 + i, 'T'); set(g, 11 + i, 8 + i, 'T'); set(g, 10 + i, 9 + i, 't'); }
    return outline(g);
  },
  // fail2ban: the red "no" sign over a grey person
  ban: (): Grid => {
    const g = grid(16, 14);
    disc(g, 8, 7, 0, 4.7, 'S');
    disc(g, 8, 4.9, 0, 1.7, 'm');
    disc(g, 8, 11.2, 0, 3.4, 'm', (_x, y) => y >= 8 && y <= 10);
    disc(g, 8, 7, 0, 4.7, 'R', (x, y) => Math.abs((x + 0.5 - 8) - (y + 0.5 - 7)) < 1.2);
    disc(g, 8, 7, 4.7, 6.4, 'R');
    return outline(g);
  },
  // tarpit: a snail
  snail: (): Grid => {
    const g = grid(16, 14);
    // the foot runs under the shell and out the back; the head and two eye stalks lead
    draw(g, [[8, 1, 'aaa'], [9, 0, 'aaaaa'], [10, 0, 'aaaaaaaaaaaaaa'], [11, 1, 'AAAAAAAAAAAAA']]);
    draw(g, [[7, 1, 'A'], [6, 1, 'A'], [5, 1, 'k'], [4, 1, 'k'], [7, 3, 'A'], [6, 3, 'A'], [5, 3, 'k'], [4, 3, 'k']]);
    disc(g, 10, 6.5, 0, 4.6, 'X');
    disc(g, 10, 6.5, 0, 1.0, 'k');
    disc(g, 10, 6.5, 1.8, 2.7, 'k', (x, y) => Math.atan2(y + 0.5 - 6.5, x + 0.5 - 10) > -2.2);
    disc(g, 10, 6.5, 3.4, 4.2, 'k', (x, y) => { const t = Math.atan2(y + 0.5 - 6.5, x + 0.5 - 10); return t > 0.6 && t < 3.0; });
    return outline(g);
  },
  // prepared statements: a puzzle piece — a value only fits the slot the query left for it
  puzzle: (): Grid => {
    const g = grid(16, 14);
    for (let y = 3; y <= 11; y++) for (let x = 3; x <= 11; x++) set(g, x, y, 'u');
    draw(g, [[1, 6, 'uuu'], [2, 6, 'uuu']]);
    [[11, 6], [11, 7], [11, 8], [10, 7]].forEach(([x, y]) => set(g, x, y, null));
    return outline(g);
  },
  // sort-column allow-list: the tick is the old shield's exact mark; only the lit left rim and the shaded right rim are gone
  shieldTick: (): Grid => marked([[5, 5], [6, 6], [7, 6], [7, 7], [8, 5], [9, 4], [10, 3]]),
  // MFA + SSH keys: the key and token from the v3 round, restored as they were
  key: (): Grid => outline(draw(grid(16, 14), [[3, 1, 'yyyy'], [4, 0, 'yy..yy'], [5, 0, 'y....yyyyyyyyy'], [6, 0, 'y....yyyyyyyyy'], [7, 0, 'yy..yy...y.yy'], [8, 1, 'yyyy....y.y'], [10, 10, 'ccccc'], [11, 10, 'cgcgc'], [12, 10, 'ccccc']])),
  // output encoding + CSP: a comment bubble whose <> stays text
  bubble: (): Grid => {
    const g = grid(16, 14);
    draw(g, [[1, 2, 'HHHHHHHHHHHH'], [2, 1, 'HhhhhhhhhhhhhH'], [3, 1, 'HhhhhhhhhhhhhH'], [4, 1, 'HhhhhhhhhhhhhH'], [5, 1, 'HhhhhhhhhhhhhH'], [6, 1, 'HhhhhhhhhhhhhH'], [7, 1, 'HhhhhhhhhhhhhH'], [8, 1, 'HhhhhhhhhhhhhH'], [9, 2, 'HHHHHHHHHHHH'], [10, 3, 'HhH'], [11, 3, 'HH'], [12, 3, 'H']]);
    draw(g, [[3, 5, 'b'], [4, 4, 'b'], [5, 3, 'b'], [6, 4, 'b'], [7, 5, 'b'], [3, 9, 'b'], [4, 10, 'b'], [5, 11, 'b'], [6, 10, 'b'], [7, 9, 'b']]);
    return outline(g);
  },
  // restore from backup: the classic database, a cylinder seen from slightly above, plus a green restore arrow
  db: (): Grid => {
    const g = grid(16, 14);
    for (let y = 3; y <= 11; y++) for (let x = 1; x <= 11; x++) set(g, x, y, 'l');
    ell(g, 6.5, 11, 5.5, 2.2, 'm', (_x, y) => y >= 11);
    for (const cy of [5.8, 8.6]) ell(g, 6.5, cy, 5.5, 2.0, 'm', (_x, y, d) => d >= 0.4 && y + 0.5 > cy);
    ell(g, 6.5, 3, 5.5, 2.2, 'w');
    ell(g, 6.5, 3, 5.5, 2.2, 'l', (_x, _y, d) => d >= 0.45);
    draw(g, [[4, 14, 'g'], [5, 13, 'ggg'], [6, 14, 'g'], [7, 14, 'g'], [8, 14, 'g'], [9, 14, 'g'], [10, 14, 'g']]);
    return outline(g);
  },
  lockShut: (): Grid => outline(draw(grid(10, 10), [[1, 3, 'llll'], [2, 2, 'l'], [2, 7, 'l'], [3, 2, 'l'], [3, 7, 'l'], [4, 1, 'RRRRRRRR'], [5, 1, 'RRRkkRRR'], [6, 1, 'RRRkkRRR'], [7, 1, 'rRRRRRRr'], [8, 1, 'rrrrrrrr']])),
  lockOpen: (): Grid => outline(draw(grid(10, 10), [[0, 3, 'llll'], [1, 2, 'l'], [1, 7, 'l'], [2, 2, 'l'], [4, 1, 'BBBBBBBB'], [5, 1, 'BBBkkBBB'], [6, 1, 'BBBkkBBB'], [7, 1, 'bBBBBBBb'], [8, 1, 'bbbbbbbb']])),
};

export type BugKind = 'spider' | 'worm' | 'beetle' | 'fly' | 'gnat';
export const BUG_OF: Record<MaliciousKind, BugKind> = { sqli: 'spider', xss: 'worm', brute: 'beetle', scan: 'fly', flood: 'gnat' };

const legLines = (g: Grid, attach: [number, number][], ends: [number, number][], c: string): void =>
  attach.forEach(([ax, ay], i) => line(g, ax, ay, ends[i][0], ends[i][1], c));
const mirror = (pts: [number, number][], w: number): [number, number][] => pts.map(([x, y]) => [w - x, y]);

// The housefly: a dark body, red eyes, platinum wings; frame 1 lifts the wings, the blur frame shows both positions.
const FLY_BODY: Rows = [[2, 1, 'RR'], [3, 0, 'RRkk'], [3, 4, 'cccc'], [4, 1, 'kkkcCcCc'], [5, 2, 'kkcccc'], [6, 2, 'k.k.k']];
const FLY_WINGS: [Rows, Rows] = [[[1, 4, 'eeee'], [2, 5, 'ee']], [[0, 4, 'eeee'], [1, 3, 'ee']]];
const housefly = (wings: Rows): Grid => outline(draw(draw(grid(10, 8), wings), FLY_BODY));
export const flyBlur = (): Grid => housefly([...FLY_WINGS[0], ...FLY_WINGS[1]]);

// The worm that crawls a card's edge, in segments: a head with an eye, bodies, a tail.
// Each part keeps a one-cell margin all round, so the outline closes on every side however the part is turned.
export const wormPart = (part: 'head' | 'body' | 'tail'): Grid => {
  if (part === 'head') return outline(draw(grid(10, 7), [[1, 3, 'yyyy'], [2, 2, 'yTTTTy'], [3, 1, 'yTTkTTTy'], [4, 2, 'yTTTTy'], [5, 3, 'yyyy']]));
  if (part === 'body') return outline(draw(grid(8, 8), [[1, 3, 'yy'], [2, 2, 'yTTy'], [3, 1, 'yTTTTy'], [4, 1, 'yTTTTy'], [5, 2, 'yTTy'], [6, 3, 'yy']]));
  return outline(draw(grid(6, 6), [[1, 2, 'yy'], [2, 1, 'yTTy'], [3, 1, 'yTTy'], [4, 2, 'yy']]));
};

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
  if (kind === 'fly') return housefly(FLY_WINGS[f]);
  if (kind === 'gnat') {
    const g = grid(9, 8);
    draw(g, f ? [[1, 1, 'jj'], [1, 6, 'jj'], [2, 2, 'j'], [2, 6, 'j']] : [[5, 1, 'jj'], [5, 6, 'jj'], [4, 2, 'j'], [4, 6, 'j']]);
    draw(g, [[2, 4, 'R'], [3, 3, 'mmm'], [4, 3, 'mdm'], [5, 4, 'm']]);
    return outline(g);
  }
  // the one-piece worm the rack's crawling bugs still use
  const g = grid(19, 8);
  for (let i = 0; i < 7; i++) {
    const x = 1 + i * 2, y = 3 + Math.round(Math.sin(i * 0.9 + (f ? Math.PI : 0)) * 1.4);
    rect(g, x, y, 2, 2, i % 2 ? 'y' : 'T');
    if (i === 6) { rect(g, x + 2, y, 2, 2, 'y'); g[y][x + 3] = 'k'; }
  }
  return outline(g);
};

export const iconGrid = (icon: IconId): Grid =>
  icon === 'horse' ? knightHorse(KNIGHTS.black.look, 0, false) : icon === 'squire' ? squire(false) : ICONS[icon]();

export type KnightPose = 'foot-idle' | 'foot-throw' | 'horse-0' | 'horse-1' | 'horse-throw' | 'down' | 'cheer';
export const knightKey = (id: KnightId, pose: KnightPose): string => `knight-${id}-${pose}`;

export type SpriteDef = { key: string; grid: () => Grid; scale: number; pal?: Record<string, string> };

// Every pose of one knight, drawn from his look and painted on his palette.
const knightDefs = (id: KnightId): SpriteDef[] => {
  const k = KNIGHTS[id], L = k.look;
  const poses: Record<KnightPose, () => Grid> = {
    'foot-idle': () => knightFoot(L, false), 'foot-throw': () => knightFoot(L, true), 'horse-0': () => knightHorse(L, 0, false),
    'horse-1': () => knightHorse(L, 1, false), 'horse-throw': () => knightHorse(L, 0, true), down: () => knightDown(L), cheer: () => knightCheer(L),
  };
  return (Object.keys(poses) as KnightPose[]).map((pose) => ({ key: knightKey(id, pose), grid: poses[pose], scale: 3, pal: k.pal }));
};

const BUGS: BugKind[] = ['spider', 'worm', 'beetle', 'fly', 'gnat'];

export const SPRITE_DEFS: SpriteDef[] = [
  ...KNIGHT_IDS.flatMap(knightDefs),
  { key: 'squire-idle', grid: () => squire(false), scale: 2 },
  { key: 'squire-throw', grid: () => squire(true), scale: 2 },
  { key: 'worm-head', grid: () => wormPart('head'), scale: 2 }, { key: 'worm-body', grid: () => wormPart('body'), scale: 2 }, { key: 'worm-tail', grid: () => wormPart('tail'), scale: 2 },
  { key: 'spear', grid: spear, scale: 3 },
  { key: 'spear-small', grid: spear, scale: 2 },
  { key: 'hammer', grid: ICONS.hammer, scale: 3 },
  { key: 'lock-shut', grid: ICONS.lockShut, scale: 2 },
  { key: 'lock-open', grid: ICONS.lockOpen, scale: 2 },
  ...BUGS.flatMap((b) => ([0, 1] as const).map((f) => ({ key: `bug-${b}-${f}`, grid: () => critter(b, f), scale: 2 }))),
  { key: 'bug-fly-wing', grid: flyBlur, scale: 2 },
];

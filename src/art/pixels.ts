export type Grid = (string | null)[][];

// One character per palette colour; 'o' is the auto-outline.
export const PAL: Record<string, string> = {
  o: '#0b0c10',
  l: '#8f9bb3', w: '#d5dceb', m: '#5d6680', d: '#3a4152', k: '#1b1d24',
  R: '#ff2f2f', r: '#a3161c', B: '#2fb6ff', b: '#16608f',
  T: '#a0703a', t: '#6b4722', S: '#eef2f7', s: '#a7b2c4', y: '#d9b44a',
  h: '#cfc9ba', H: '#958f81', n: '#6d685d', c: '#2a2c35', C: '#3a3d4a',
  F: '#121317', E: '#24272f', Q: '#3c414d', U: '#4a5061', V: '#2b2f39', Z: '#16181d', G: '#14532d', g: '#3ddc84',
  i: '#e8f8ff', j: '#8fdcff', x: '#7a2a1a', X: '#a8432a', z: '#5a1e12',
  // The icon set and the knights' gear: violet, leather, skin, a pale grey and the braid shade (y stays the gold).
  u: '#b48cff', q: '#6e4bb5', a: '#c8a46a', A: '#8f6f3e', p: '#e2b48c', P: '#b9825c', e: '#c9d4e2', Y: '#b8963e',
};

export const grid = (w: number, h: number): Grid => Array.from({ length: h }, () => Array<string | null>(w).fill(null));

// Rows of palette letters, '.' for an empty cell.
export const rowsToGrid = (rows: string[]): Grid => rows.map((r) => [...r].map((c) => (c === '.' ? null : c)));

export const set = (g: Grid, x: number, y: number, c: string | null): void => {
  if (g[y] && x >= 0 && x < g[0].length) g[y][x] = c;
};

export const draw = (g: Grid, rows: [number, number, string][], dx = 0, dy = 0): Grid => {
  for (const [y, x0, str] of rows) {
    [...str].forEach((ch, i) => {
      const yy = y + dy, xx = x0 + i + dx;
      if (ch !== '.' && g[yy] && xx >= 0 && xx < g[0].length) g[yy][xx] = ch;
    });
  }
  return g;
};

export const rect = (g: Grid, x: number, y: number, w: number, h: number, c: string): void => {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && i >= 0 && i < g[0].length) g[j][i] = c;
};

export const poly = (g: Grid, pts: [number, number][], c: string): void => {
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
    const px = x + 0.5, py = y + 0.5;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) g[y][x] = c;
  }
};

export const line = (g: Grid, x0: number, y0: number, x1: number, y1: number, c: string, w = 1): void => {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
    for (let k = 0; k < w; k++) if (g[y] && x + k >= 0 && x + k < g[0].length) g[y][x + k] = c;
  }
};

// Fills the cells whose centre lies inside the ellipse (rx, ry) around (cx, cy); keep(x, y, d) narrows it,
// where d is the normalised distance (1 at the edge), so a ring is `d >= 0.6`.
export const ell = (g: Grid, cx: number, cy: number, rx: number, ry: number, c: string, keep?: (x: number, y: number, d: number) => boolean): void => {
  g.forEach((row, y) => row.forEach((_, x) => {
    const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, d = u * u + v * v;
    if (d < 1 && (!keep || keep(x, y, d))) g[y][x] = c;
  }));
};
export const disc = (g: Grid, cx: number, cy: number, r0: number, r1: number, c: string, keep?: (x: number, y: number, d: number) => boolean): void => {
  g.forEach((row, y) => row.forEach((_, x) => {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d >= r0 && d < r1 && (!keep || keep(x, y, d))) g[y][x] = c;
  }));
};

export const outline = (g: Grid): Grid => {
  const out = g.map((r) => r.slice());
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
    if (g[y][x]) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => g[y + b]?.[x + a])) out[y][x] = 'o';
  }
  return out;
};

type FillCtx = { fillStyle: string | CanvasGradient | CanvasPattern; fillRect(x: number, y: number, w: number, h: number): void };

// Paints each row's runs of one letter as one rect; `pal` swaps letters for this sprite, the rest fall back to PAL.
export const paintGrid = (ctx: FillCtx, g: Grid, scale: number, pal: Record<string, string> = PAL): void => {
  g.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      if (!c) { x++; continue; }
      let e = x;
      while (e + 1 < row.length && row[e + 1] === c) e++;
      ctx.fillStyle = pal[c] ?? PAL[c];
      ctx.fillRect(x * scale, y * scale, (e - x + 1) * scale, scale);
      x = e + 1;
    }
  });
};

// packages
import { describe, expect, it } from 'vitest';

// local
import { draw, grid, line, outline, paintGrid, PAL, poly, rect } from './pixels';

describe('pixel helpers', () => {
  it('draws rows with offsets and ignores dots and out-of-bounds pixels', () => {
    const g = draw(grid(4, 3), [[0, 0, 'R.R'], [1, 3, 'RR']], 0, 1);
    expect(g[1]).toEqual(['R', null, 'R', null]);
    expect(g[2]).toEqual([null, null, null, 'R']);
  });

  it('outlines filled shapes with o on 4-neighbours only', () => {
    const g = grid(3, 3);
    g[1][1] = 'R';
    const o = outline(g);
    expect(o.map((r) => r.map((c) => c ?? '.').join(''))).toEqual(['.o.', 'oRo', '.o.']);
  });

  it('fills polygons, rects and lines', () => {
    const g = grid(6, 6);
    rect(g, 0, 0, 2, 2, 'B');
    poly(g, [[2, 2], [6, 2], [6, 6], [2, 6]], 'R');
    line(g, 0, 5, 1, 5, 'k');
    expect(g[0][1]).toBe('B');
    expect(g[3][3]).toBe('R');
    expect(g[5][0]).toBe('k');
  });

  it('paints horizontal runs with the palette colour', () => {
    const calls: [string, number, number, number, number][] = [];
    const ctx = { fillStyle: '' as string, fillRect(x: number, y: number, w: number, h: number) { calls.push([this.fillStyle, x, y, w, h]); } };
    const g = grid(4, 1);
    g[0] = ['R', 'R', null, 'B'];
    paintGrid(ctx, g, 3);
    expect(calls).toEqual([[PAL.R, 0, 0, 6, 3], [PAL.B, 9, 0, 3, 3]]);
  });
});

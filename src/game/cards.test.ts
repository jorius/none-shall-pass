// packages
import { describe, expect, it } from 'vitest';

// local
import { drawCard } from './cards';

// A 2D context that only measures (seven units a character) and counts the underlines stroked.
const fakeContext = (): { ctx: CanvasRenderingContext2D; strokes: () => number } => {
  let strokes = 0;
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', textAlign: 'left', textBaseline: 'alphabetic',
    clearRect: () => undefined, fillRect: () => undefined, strokeRect: () => undefined, fillText: () => undefined,
    measureText: (s: string) => ({ width: s.length * 7 }), beginPath: () => undefined, lineTo: () => undefined, stroke: () => { strokes++; },
  };
  return { ctx: ctx as unknown as CanvasRenderingContext2D, strokes: () => strokes };
};

const card = (hints: string[], hintsOn = true) => ({ src: '192.0.2.10', port: '/search', text: "GET /search?q=' OR 1=1--", hints, hintsOn, decodedTag: null, state: 'idle' as const, root: false });

describe('drawCard', () => {
  it('underlines each hint it finds, once per occurrence', () => {
    const { ctx, strokes } = fakeContext();
    drawCard(ctx, card(["' OR 1=1--", 'search', 'nope']));
    expect(strokes()).toBe(2);
  });

  it('underlines nothing with hints off', () => {
    const { ctx, strokes } = fakeContext();
    drawCard(ctx, card(["' OR 1=1--"], false));
    expect(strokes()).toBe(0);
  });

  it('skips an empty hint instead of hanging on it', () => {
    const { ctx, strokes } = fakeContext();
    drawCard(ctx, card(['', "' OR 1=1--", '']));
    expect(strokes()).toBe(1);
  });
});

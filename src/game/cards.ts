// core
import { CSS } from '../core/palette';
import type { Chip } from '../core/types';

export type CardState = 'idle' | 'hover' | 'locked' | 'slowed';
export const CARD_TEX_W = 680;
export const CARD_TEX_H = 108;
const S = 2;

const BG: Record<CardState, string> = { idle: CSS.sub, hover: '#3b3b3b', locked: '#3a2e2e', slowed: '#2c2a26' };
const BORDER: Record<CardState, string> = { idle: CSS.dim, hover: CSS.ink, locked: CSS.red, slowed: CSS.dim };
// Protocol only, never maliciousness: a shopper's GET and an injected GET wear the same chip. Red stays for the target and the hints.
export const CHIP_COLOR: Record<Chip, string> = { GET: '#2fb6ff', POST: '#d9b44a', SSH: '#5fd38d', SMTP: '#b48cff', TCP: '#a4a197' };
const ENCODED = '#8fdcff';

// Root mode's amber matrix keeps only luminance, under which the red target would be the darkest outline on the field.
// White comes out as its brightest amber, above the ink of a hovered card.
export const targetColor = (root: boolean): string => (root ? '#ffffff' : CSS.red);

const fit = (ctx: CanvasRenderingContext2D, text: string, max: number): string => {
  if (ctx.measureText(text).width <= max) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(`${text.slice(0, mid)}…`).width <= max) lo = mid; else hi = mid - 1;
  }
  return `${text.slice(0, lo)}…`;
};

// %XX escapes and the + that stands for a space: what the decoding lens would turn back into text.
export const encodedSpans = (text: string): [number, number][] => {
  const out: [number, number][] = [];
  const re = /%[0-9A-Fa-f]{2}|\+/g;
  for (let m = re.exec(text); m; m = re.exec(text)) out.push([m.index, m.index + m[0].length]);
  return out;
};

// Draws one packet card into a 2x canvas: the protocol chip, the path and the source on top, the payload alone below.
export const drawCard = (ctx: CanvasRenderingContext2D, o: { chip: Chip; path: string; src: string; payload: string; hints: string[]; hintsOn: boolean; decodedTag: string | null; state: CardState; root: boolean }): void => {
  ctx.clearRect(0, 0, CARD_TEX_W, CARD_TEX_H);
  ctx.fillStyle = BG[o.state];
  ctx.fillRect(0, 0, CARD_TEX_W, CARD_TEX_H);
  ctx.strokeStyle = o.state === 'locked' ? targetColor(o.root) : BORDER[o.state];
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, CARD_TEX_W - 2, CARD_TEX_H - 2);
  if (o.state === 'locked') {
    ctx.fillStyle = CSS.red; ctx.fillRect(0, 0, 6, CARD_TEX_H);
    ctx.fillStyle = CSS.blue; ctx.fillRect(CARD_TEX_W - 6, 0, 6, CARD_TEX_H);
  }
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  // Top row: the chip, the path, and the source on the right.
  ctx.font = `700 ${12 * S}px "Space Mono"`;
  const chipW = ctx.measureText(o.chip).width + 10 * S;
  ctx.fillStyle = CHIP_COLOR[o.chip]; ctx.fillRect(9 * S, 6 * S, chipW, 16 * S);
  ctx.fillStyle = CSS.paper; ctx.fillText(o.chip, 9 * S + 5 * S, 18 * S);
  ctx.font = `${13 * S}px "Space Mono"`;
  ctx.fillStyle = CSS.ink; ctx.fillText(o.path, 9 * S + chipW + 6 * S, 18 * S);
  ctx.textAlign = 'right'; ctx.fillStyle = CSS.dim; ctx.fillText(o.src, CARD_TEX_W - 9 * S, 18 * S);
  ctx.textAlign = 'left';
  // Bottom row: the payload only, with the decoded tag in front when the lens is on.
  let x = 9 * S;
  if (o.decodedTag) {
    ctx.font = `700 ${12 * S}px "Space Mono"`;
    const w = ctx.measureText(o.decodedTag).width + 8 * S;
    ctx.fillStyle = CSS.blue; ctx.fillRect(x, 30 * S, w, 16 * S);
    ctx.fillStyle = CSS.paper; ctx.fillText(o.decodedTag, x + 4 * S, 42 * S);
    x += w + 5 * S;
  }
  ctx.font = `${15 * S}px "IBM Plex Mono"`;
  const shown = fit(ctx, o.payload, CARD_TEX_W - 9 * S - x);
  ctx.fillStyle = CSS.ink;
  ctx.fillText(shown, x, 44 * S);
  // Encoding, always on and free: the same glyphs drawn again in cyan, with a dotted underline.
  ctx.fillStyle = ENCODED; ctx.strokeStyle = ENCODED; ctx.lineWidth = 2;
  ctx.setLineDash([2 * S, 2 * S]);
  for (const [a, b] of encodedSpans(shown)) {
    const x0 = x + ctx.measureText(shown.slice(0, a)).width, w = ctx.measureText(shown.slice(a, b)).width;
    ctx.fillText(shown.slice(a, b), x0, 44 * S);
    ctx.beginPath(); ctx.moveTo(x0, 48 * S); ctx.lineTo(x0 + w, 48 * S); ctx.stroke();
  }
  ctx.setLineDash([]);
  if (!o.hintsOn) return;
  ctx.strokeStyle = CSS.red;
  ctx.lineWidth = 2;
  for (const h of o.hints) {
    // An empty hint matches at every position and would never advance.
    if (!h) continue;
    let from = 0, i: number;
    while ((i = shown.indexOf(h, from)) >= 0) {
      const x0 = x + ctx.measureText(shown.slice(0, i)).width;
      const w = ctx.measureText(h).width;
      ctx.beginPath();
      for (let dx = 0; dx <= w; dx += 2) ctx.lineTo(x0 + dx, 49 * S + Math.sin(dx / 3) * 2);
      ctx.stroke();
      from = i + h.length;
    }
  }
};

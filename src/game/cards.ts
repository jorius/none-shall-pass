// core
import { CSS } from '../core/palette';

export type CardState = 'idle' | 'hover' | 'locked' | 'held' | 'slowed';
export const CARD_TEX_W = 580;
export const CARD_TEX_H = 104;
const S = 2;

const BG: Record<CardState, string> = { idle: CSS.sub, hover: '#3b3b3b', locked: '#3a2e2e', held: '#33302a', slowed: '#2c2a26' };
const BORDER: Record<CardState, string> = { idle: CSS.dim, hover: CSS.ink, locked: CSS.red, held: CSS.gold, slowed: CSS.dim };

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

// Draws one packet card into a 2x canvas: source and lane on top, payload below.
export const drawCard = (ctx: CanvasRenderingContext2D, o: { src: string; port: string; text: string; hints: string[]; hintsOn: boolean; decodedTag: string | null; state: CardState; root: boolean }): void => {
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
  ctx.font = `${13 * S}px "Space Mono"`;
  ctx.fillStyle = CSS.dim;
  ctx.textAlign = 'left';
  ctx.fillText(o.src, 9 * S, 19 * S);
  ctx.textAlign = 'right';
  ctx.fillText(o.port, CARD_TEX_W - 9 * S, 19 * S);
  ctx.textAlign = 'left';
  let x = 9 * S;
  if (o.decodedTag) {
    ctx.font = `700 ${13 * S}px "Space Mono"`;
    const w = ctx.measureText(o.decodedTag).width + 8 * S;
    ctx.fillStyle = CSS.blue; ctx.fillRect(x, 26 * S, w, 17 * S);
    ctx.fillStyle = CSS.paper; ctx.fillText(o.decodedTag, x + 4 * S, 39 * S);
    x += w + 5 * S;
  }
  ctx.font = `${14 * S}px "IBM Plex Mono"`;
  const shown = fit(ctx, o.text, CARD_TEX_W - 9 * S - x);
  ctx.fillStyle = CSS.ink;
  ctx.fillText(shown, x, 40 * S);
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
      for (let dx = 0; dx <= w; dx += 2) ctx.lineTo(x0 + dx, 45 * S + Math.sin(dx / 3) * 2);
      ctx.stroke();
      from = i + h.length;
    }
  }
};

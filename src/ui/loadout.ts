// core
import { FIELD_H, FIELD_TOP } from '../core/constants';
import { cardById, type CardId } from '../core/content/cards';
import type { RunEvent } from '../core/events';
import type { Run } from '../core/run';

// art
import { iconUrl } from '../art/dataurl';

// game
import type { View } from '../game/view';

// i18n
import { loc } from '../i18n';

// local
import { el } from './dom';
import type { Inspector } from './inspector';

// Tiered cards replace each other, so only the highest owned tier of a chain gets a tile.
const CHAINS: readonly (readonly CardId[])[] = [['obs1', 'obs2', 'obs3'], ['destrier', 'destrier2', 'destrier3']];
const outranked = (id: CardId, owned: CardId[]): boolean =>
  CHAINS.some((chain) => { const i = chain.indexOf(id); return i >= 0 && chain.slice(i + 1).some((higher) => owned.includes(higher)); });
const shown = (owned: CardId[]): CardId[] => owned.filter((id) => !outranked(id, owned));

// The column runs from .loadout's top to a few px above the uptime strip, which starts where the field ends.
// It cannot grow sideways (the knight's post is to its left, the rack to its right), so a long run shrinks the tiles.
const COLUMN_TOP = FIELD_TOP + 6;
const COLUMN_BOTTOM = FIELD_TOP + FIELD_H - 4;
const TILE_H = 38, GAP = 5, TIGHT_GAP = 3;

export const tileFit = (n: number): { h: number; gap: number } => {
  const room = COLUMN_BOTTOM - COLUMN_TOP, gaps = Math.max(0, n - 1);
  const gap = n * TILE_H + gaps * GAP <= room ? GAP : TIGHT_GAP;
  return { h: Math.min(TILE_H, Math.floor((room - gaps * gap) / Math.max(1, n))), gap };
};

// A column of owned upgrades beside the rack; hovering one explains it in the inspector.
export class LoadoutTiles implements View {
  private readonly box: HTMLElement;

  constructor(ui: HTMLElement, private readonly inspector: Inspector) {
    this.box = el('div', 'loadout', ui);
    // On the column, not on each tile: a rebuild under the pointer (every H press) removes a tile without its mouseleave.
    this.box.addEventListener('mouseleave', () => inspector.leave());
  }

  private render(owned: CardId[]): void {
    const ids = shown(owned), fit = tileFit(ids.length);
    this.box.replaceChildren();
    this.box.style.gap = `${fit.gap}px`;
    for (const id of ids) {
      const c = cardById(id);
      const tile = el('div', `ltile ${c.cat}`, this.box);
      tile.style.height = `${fit.h}px`;
      tile.title = loc(c.name);
      const img = el('img', 'px', tile);
      img.src = iconUrl(c.icon, 'tile');
      img.alt = loc(c.name);
      tile.addEventListener('mouseenter', () => this.inspector.card(c));
    }
  }

  start(run: Run): void { this.render(run.state.owned); }
  refresh(run: Run | null): void { if (run) this.render(run.state.owned); }
  event(ev: RunEvent): void { if (ev.type === 'owned') this.render(ev.owned); }
}

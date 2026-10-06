// core
import { FIELD_H, FIELD_TOP, FIELD_W } from '../core/constants';
import { cardById, type Card, type CardId } from '../core/content/cards';
import type { RunEvent } from '../core/events';
import type { Screen } from '../core/keys';
import { destrierLevel, obsLevel } from '../core/rules';
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

// The two tiered chains: their tiles carry level pips, and a higher tier replaces the tile of the one below.
export type Family = 'destrier' | 'obs';
export const familyOf = (id: CardId): Family | null => (id.startsWith('destrier') ? 'destrier' : id.startsWith('obs') ? 'obs' : null);
export const levelOf = (owned: readonly CardId[], family: Family): 0 | 1 | 2 | 3 => (family === 'destrier' ? destrierLevel(owned) : obsLevel(owned));

// Tiered cards replace each other, so only the highest owned tier of a chain gets a tile.
const CHAINS: readonly (readonly CardId[])[] = [['obs1', 'obs2', 'obs3'], ['destrier', 'destrier2', 'destrier3']];
const outranked = (id: CardId, owned: readonly CardId[]): boolean =>
  CHAINS.some((chain) => { const i = chain.indexOf(id); return i >= 0 && chain.slice(i + 1).some((higher) => owned.includes(higher)); });
const shown = (owned: readonly CardId[]): CardId[] => owned.filter((id) => !outranked(id, owned));

// The column runs from .loadout's top to a few px above the uptime strip, which starts where the field ends.
// It cannot grow sideways (the knight's post is to its left, the rack to its right), so a long run shrinks the tiles.
const COLUMN_X = 1076;
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
  private owned: CardId[] = [];
  // A card is bought under the draft screen, which covers the column: its tile flashes once the field is back in view.
  private pending = new Set<CardId>();
  private inView = true;

  constructor(private readonly ui: HTMLElement, private readonly inspector: Inspector) {
    this.box = el('div', 'loadout', ui);
    // On the column, not on each tile: a rebuild under the pointer (every H press) removes a tile without its mouseleave.
    this.box.addEventListener('mouseleave', () => inspector.leave());
  }

  private render(owned: readonly CardId[], flash: ReadonlySet<CardId> = new Set()): void {
    this.owned = [...owned];
    const ids = shown(owned), fit = tileFit(ids.length);
    this.box.replaceChildren();
    this.box.style.gap = `${fit.gap}px`;
    ids.forEach((id, i) => {
      const c = cardById(id), family = familyOf(id);
      const tile = el('div', `ltile ${c.cat}`, this.box);
      tile.style.height = `${fit.h}px`;
      tile.title = loc(c.name);
      const img = el('img', 'px', tile);
      img.src = iconUrl(c.icon, 'tile');
      img.alt = loc(c.name);
      if (family) {
        const lvl = el('div', 'lvl', tile), level = levelOf(owned, family);
        for (let n = 1; n <= 3; n++) el('i', n <= level ? 'on' : '', lvl);
      }
      tile.addEventListener('mouseenter', () => this.inspector.card(c));
      if (flash.has(id)) this.flash(tile, c, COLUMN_TOP + i * (fit.h + fit.gap));
    });
  }

  // The tile lights up, and its name (without its "· logs" tag) rises beside it, ending just left of the column.
  private flash(tile: HTMLElement, c: Card, top: number): void {
    tile.classList.add('flash');
    tile.addEventListener('animationend', () => tile.classList.remove('flash'));
    const f = el('div', 'float gold', this.ui, loc(c.name).split(' ·')[0]);
    f.style.right = `${FIELD_W - COLUMN_X + 6}px`;
    f.style.top = `${top}px`;
    // Gone when its rise ends, not on a wall clock: a paused game freezes the rise and keeps it on screen.
    f.addEventListener('animationend', () => f.remove());
  }

  start(run: Run): void { this.pending.clear(); this.render(run.state.owned); }
  refresh(run: Run | null): void { if (run) this.render(run.state.owned); }

  screen(s: Screen): void {
    this.inView = s === 'playing';
    if (!this.inView || !this.pending.size) return;
    this.render(this.owned, this.pending);
    this.pending.clear();
  }

  event(ev: RunEvent): void {
    if (ev.type !== 'owned') return;
    // A tile is new when its id was not shown before: a card just bought, or a tier that replaced the one below it.
    const before = shown(this.owned);
    const fresh = shown(ev.owned).filter((id) => !before.includes(id));
    if (this.inView) { this.render(ev.owned, new Set(fresh)); return; }
    fresh.forEach((id) => this.pending.add(id));
    this.render(ev.owned);
  }
}

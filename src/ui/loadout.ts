// core
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

// Observability tiers replace each other, so only the highest owned one gets a tile.
const shown = (owned: CardId[]): CardId[] => owned.filter((id) => !(id === 'obs1' && (owned.includes('obs2') || owned.includes('obs3'))) && !(id === 'obs2' && owned.includes('obs3')));

// A column of owned upgrades beside the rack; hovering one explains it in the inspector.
export class LoadoutTiles implements View {
  private readonly box: HTMLElement;

  constructor(ui: HTMLElement, private readonly inspector: Inspector) {
    this.box = el('div', 'loadout', ui);
  }

  private render(owned: CardId[]): void {
    this.box.replaceChildren();
    for (const id of shown(owned)) {
      const c = cardById(id);
      const tile = el('div', `ltile ${c.cat}`, this.box);
      tile.title = loc(c.name);
      const img = el('img', 'px', tile);
      img.src = iconUrl(c.icon, 'tile');
      img.alt = loc(c.name);
      tile.addEventListener('mouseenter', () => this.inspector.card(c));
      tile.addEventListener('mouseleave', () => this.inspector.leave());
    }
  }

  start(run: Run): void { this.render(run.state.owned); }
  refresh(run: Run | null): void { if (run) this.render(run.state.owned); }
  event(ev: RunEvent): void { if (ev.type === 'owned') this.render(ev.owned); }
}

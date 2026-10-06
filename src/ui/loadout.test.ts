// @vitest-environment jsdom
// packages
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// core
import { Run } from '../core/run';
import { cfg } from '../core/testkit';

// i18n
import { setLang } from '../i18n';

// local
import { Inspector } from './inspector';
import { LoadoutTiles } from './loadout';

// jsdom has no canvas to paint the icons on.
vi.mock('../art/dataurl', () => ({ iconUrl: (icon: string, size: string) => `data:image/png;${icon}-${size}` }));

describe('LoadoutTiles', () => {
  let ui: HTMLElement, tiles: LoadoutTiles, run: Run;
  const all = (): HTMLElement[] => [...ui.querySelectorAll<HTMLElement>('.loadout .ltile')];
  beforeEach(() => {
    ui = document.createElement('div');
    const bottom = document.createElement('div');
    ui.appendChild(bottom);
    const ins = new Inspector(bottom);
    tiles = new LoadoutTiles(ui, ins);
    run = new Run(cfg());
    ins.start(run);
    tiles.start(run);
  });
  afterEach(() => setLang('en'));

  it('shows one tile per owned card, the highest observability tier only', () => {
    expect(all().map((t) => t.className)).toEqual(['ltile FIREWALL']);
    tiles.event({ type: 'owned', owned: ['lockdown', 'obs1', 'obs2', 'squire', 'csp'] });
    expect(all().map((t) => t.title)).toEqual(['Port lockdown', 'Observability II · metrics', 'Squire', 'Output encoding + CSP']);
    expect(all().map((t) => t.className)).toEqual(['ltile FIREWALL', 'ltile KNIGHT', 'ltile KNIGHT', 'ltile SERVER']);
    expect(all()[1].querySelector('img')?.getAttribute('src')).toBe('data:image/png;eye-tile');
  });

  it('explains a tile in the inspector while it is hovered', () => {
    all()[0].dispatchEvent(new MouseEvent('mouseenter'));
    expect(ui.querySelector('.ins .cname')?.textContent).toBe('Port lockdown');
    all()[0].dispatchEvent(new MouseEvent('mouseleave'));
    expect(ui.querySelector('.ins .cname')).toBeNull();
  });

  it('renames its tiles in Spanish on refresh', () => {
    setLang('es');
    tiles.refresh(run);
    expect(all()[0].title).toBe('Puertos cerrados');
    expect(all()[0].querySelector('img')?.alt).toBe('Puertos cerrados');
  });
});

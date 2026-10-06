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
import { LoadoutTiles, tileFit } from './loadout';

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

  it('explains a tile in the inspector while the pointer is on the column', () => {
    all()[0].dispatchEvent(new MouseEvent('mouseenter'));
    expect(ui.querySelector('.ins .cname')?.textContent).toBe('Port lockdown');
    ui.querySelector('.loadout')!.dispatchEvent(new MouseEvent('mouseleave'));
    expect(ui.querySelector('.ins .cname')).toBeNull();
  });

  it('lets go of the card when the pointer leaves, even after the tiles were rebuilt under it', () => {
    all()[0].dispatchEvent(new MouseEvent('mouseenter'));
    tiles.refresh(run);
    expect(ui.querySelector('.ins .cname')?.textContent).toBe('Port lockdown');
    ui.querySelector('.loadout')!.dispatchEvent(new MouseEvent('mouseleave'));
    expect(ui.querySelector('.ins .cname')).toBeNull();
  });

  // y 62 is .loadout's top; the uptime strip starts at y 506 and the column keeps 4px clear of it.
  it('sizes the tiles so any loadout fits between the HUD and the uptime strip', () => {
    for (let n = 1; n <= 16; n++) {
      const { h, gap } = tileFit(n);
      expect(62 + n * h + (n - 1) * gap, `${n} tiles`).toBeLessThanOrEqual(502);
      expect(h, `${n} tiles`).toBeLessThanOrEqual(38);
      expect(h, `${n} tiles`).toBeGreaterThanOrEqual(24);
      if (n <= 10) expect({ h, gap }).toEqual({ h: 38, gap: 5 });
    }
    expect(tileFit(13)).toEqual({ h: 31, gap: 3 });
  });

  it('shrinks the tiles of the longest possible loadout, 13 of them', () => {
    // Every card but the one-shot backup; the three observability tiers share a tile.
    tiles.event({ type: 'owned', owned: ['lockdown', 'destrier', 'squire', 'lens', 'obs1', 'obs2', 'obs3', 'quote', 'f2b', 'tarpit', 'cdn', 'prepared', 'sortlist', 'mfa', 'csp'] });
    expect(all()).toHaveLength(13);
    expect(all().every((t) => t.style.height === '31px')).toBe(true);
    expect((ui.querySelector('.loadout') as HTMLElement).style.gap).toBe('3px');
    tiles.event({ type: 'owned', owned: ['lockdown'] });
    expect(all()[0].style.height).toBe('38px');
    expect((ui.querySelector('.loadout') as HTMLElement).style.gap).toBe('5px');
  });

  it('renames its tiles in Spanish on refresh', () => {
    setLang('es');
    tiles.refresh(run);
    expect(all()[0].title).toBe('Puertos cerrados');
    expect(all()[0].querySelector('img')?.alt).toBe('Puertos cerrados');
  });
});

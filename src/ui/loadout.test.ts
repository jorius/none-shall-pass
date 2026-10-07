// @vitest-environment jsdom
// packages
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// core
import type { CardId } from '../core/content/cards';
import { Run } from '../core/run';
import { cfg } from '../core/testkit';

// i18n
import { setLang } from '../i18n';

// local
import { Inspector } from './inspector';
import { familyOf, levelOf, LoadoutTiles, tileFit } from './loadout';

// jsdom has no canvas to paint the icons on.
vi.mock('../art/dataurl', () => ({ iconUrl: (icon: string, size: string) => `data:image/png;${icon}-${size}` }));

describe('LoadoutTiles', () => {
  let ui: HTMLElement, ins: Inspector, tiles: LoadoutTiles, run: Run;
  const all = (): HTMLElement[] => [...ui.querySelectorAll<HTMLElement>('.loadout .ltile')];
  beforeEach(() => {
    ui = document.createElement('div');
    const bottom = document.createElement('div');
    ui.appendChild(bottom);
    ins = new Inspector(bottom);
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
    // The three tiles the loadout just gained flash; the one it had does not.
    expect(all().map((t) => t.className)).toEqual(['ltile FIREWALL', 'ltile KNIGHT flash', 'ltile KNIGHT flash', 'ltile SERVER flash']);
    expect(all()[1].querySelector('img')?.getAttribute('src')).toBe('data:image/png;eye-tile');
  });

  it('shows the highest Destrier tier on one tile, as the observability tiers do', () => {
    tiles.event({ type: 'owned', owned: ['lockdown', 'destrier', 'destrier2', 'destrier3', 'obs1'] });
    // Nothing has used the charge yet, so the Destrier III tile says it is ready.
    expect(all().map((t) => t.title)).toEqual(['Port lockdown', 'Destrier III · charge · CHARGE READY · C', 'Observability I · logs']);
    tiles.event({ type: 'owned', owned: ['lockdown', 'destrier', 'destrier2'] });
    expect(all().map((t) => t.title)).toEqual(['Port lockdown', 'Destrier II']);
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
    // Every card but the one-shot backup; the three observability tiers share a tile, and so do the three Destrier tiers.
    tiles.event({ type: 'owned', owned: ['lockdown', 'destrier', 'destrier2', 'destrier3', 'squire', 'lens', 'obs1', 'obs2', 'obs3', 'quote', 'f2b', 'tarpit', 'cdn', 'prepared', 'sortlist', 'mfa', 'csp'] });
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

  const pips = (): number[] => [...ui.querySelectorAll('.ltile .lvl')].map((l) => l.querySelectorAll('i.on').length);
  const flashed = (): string[] => all().filter((t) => t.classList.contains('flash')).map((t) => t.title);
  const floats = (): string[] => [...ui.querySelectorAll('.float.gold')].map((f) => f.textContent ?? '');

  it('shows level pips on the Destrier and Observability tiles and flashes a level-up with a float', () => {
    run.state.owned.push('destrier', 'obs1');
    tiles.start(run);
    expect(pips()).toEqual([1, 1]); // lockdown has no pips; Destrier I and Observability I show 1 of 3
    expect(flashed()).toEqual([]);
    run.state.owned.push('obs2');
    tiles.event({ type: 'owned', owned: [...run.state.owned] });
    const obs = all().find((t) => t.classList.contains('flash'))!;
    expect(obs.querySelectorAll('.lvl i.on').length).toBe(2);
    expect(obs.querySelectorAll('.lvl i').length).toBe(3);
    expect(floats()).toEqual(['Observability II']);
    // Beside the third tile (lockdown, Destrier, Observability), ending just left of the column.
    const f = ui.querySelector<HTMLElement>('.float.gold')!;
    expect({ top: f.style.top, right: f.style.right }).toEqual({ top: '148px', right: '210px' });
    // The level pips go up to three, and the flash and the float leave when their animations end.
    obs.dispatchEvent(new Event('animationend'));
    f.dispatchEvent(new Event('animationend'));
    expect(flashed()).toEqual([]);
    expect(floats()).toEqual([]);
    tiles.event({ type: 'owned', owned: ['lockdown', 'destrier', 'destrier2', 'destrier3', 'obs1', 'obs2', 'obs3'] });
    expect(pips()).toEqual([3, 3]);
    expect(floats()).toEqual(['Destrier III', 'Observability III']);
  });

  it('flashes a tile the loadout gains, and never on a start or a refresh', () => {
    tiles.event({ type: 'owned', owned: ['lockdown', 'squire'] });
    expect(flashed()).toEqual(['Squire']);
    expect(floats()).toEqual(['Squire']);
    run.state.owned.push('squire', 'csp');
    tiles.start(run);
    expect(flashed()).toEqual([]);
    tiles.refresh(run);
    expect(flashed()).toEqual([]);
    expect(floats()).toEqual(['Squire']);
  });

  it('holds a flash bought under the draft screen until the wave starts and the column is in view', () => {
    tiles.screen('draft');
    tiles.event({ type: 'owned', owned: ['lockdown', 'obs1'] });
    expect(pips()).toEqual([1]);
    expect(flashed()).toEqual([]);
    expect(floats()).toEqual([]);
    tiles.screen('playing');
    expect(flashed()).toEqual(['Observability I · logs']);
    expect(floats()).toEqual(['Observability I']);
    // Once shown, a refresh or the next screen change does not flash it again.
    run.state.owned.push('obs1');
    tiles.refresh(run);
    expect(pips()).toEqual([1]);
    tiles.screen('draft');
    tiles.screen('playing');
    expect(flashed()).toEqual([]);
  });

  it('floats the level-up in Spanish', () => {
    setLang('es');
    tiles.refresh(run);
    tiles.event({ type: 'owned', owned: ['lockdown', 'destrier', 'destrier2'] });
    expect(flashed()).toEqual(['Destrero II']);
    expect(floats()).toEqual(['Destrero II']);
  });

  // Destrier III's charge is ready from the moment III is bought until C uses it, and ready again with each wave: the tile wears a gold C and
  // says so on its tooltip and in the inspector, and every one of those goes when the charge starts.
  const badge = (): string | null => ui.querySelector('.ltile .rdy')?.textContent ?? null;
  const destrier = (): HTMLElement => all()[1];
  const buy = (...ids: CardId[]): void => { run.state.owned.push(...ids); tiles.event({ type: 'owned', owned: [...run.state.owned] }); };

  it('shows CHARGE READY on the Destrier III tile from the buy until the charge is used, and again with the next wave', () => {
    buy('destrier', 'destrier2');
    expect([badge(), destrier().title, destrier().classList.contains('ready')]).toEqual([null, 'Destrier II', false]);
    // Bought mid-wave with the charge unspent: ready at once.
    buy('destrier3');
    expect([badge(), destrier().title, destrier().classList.contains('ready')]).toEqual(['C', 'Destrier III · charge · CHARGE READY · C', true]);
    // C: the core marks the charge used and says so; the tile is a plain one again.
    for (const ev of run.charge()) tiles.event(ev);
    expect(run.state.knight.charge.used).toBe(true);
    expect([badge(), destrier().title, destrier().classList.contains('ready')]).toEqual([null, 'Destrier III · charge', false]);
    // The next wave gives the charge back, and the tile says so.
    run.state.phase = 'draft';
    for (const ev of run.nextWave()) tiles.event(ev);
    expect(run.state.knight.charge.used).toBe(false);
    expect([badge(), destrier().title]).toEqual(['C', 'Destrier III · charge · CHARGE READY · C']);
  });

  it('keeps the other tiles free of the ready mark, and the Destrier below level III', () => {
    buy('destrier', 'destrier2', 'squire', 'obs1');
    expect(all().map((t) => t.querySelector('.rdy')).filter(Boolean)).toHaveLength(0);
    expect(all().map((t) => t.title)).toEqual(['Port lockdown', 'Destrier II', 'Squire', 'Observability I · logs']);
    buy('destrier3');
    expect(all().filter((t) => t.querySelector('.rdy')).map((t) => t.title)).toEqual(['Destrier III · charge · CHARGE READY · C']);
  });

  it('adds CHARGE READY to the tile\'s inspector text, and takes it off when the charge starts under a pointer that stays on the tile', () => {
    buy('destrier', 'destrier2', 'destrier3');
    destrier().dispatchEvent(new MouseEvent('mouseenter'));
    expect(ui.querySelector('.ins .cname')?.textContent).toBe('Destrier III · charge');
    expect(ui.querySelector('.ins .ptitle .rdy')?.textContent).toBe('CHARGE READY · C');
    for (const ev of run.charge()) tiles.event(ev);
    ins.frame(run);
    expect(ui.querySelector('.ins .cname')?.textContent).toBe('Destrier III · charge');
    expect(ui.querySelector('.ins .rdy')).toBeNull();
  });

  it('says CARGA LISTA · C in Spanish, on the tooltip and in the inspector', () => {
    setLang('es');
    buy('destrier', 'destrier2', 'destrier3');
    expect(destrier().title).toBe('Destrero III · carga · CARGA LISTA · C');
    destrier().dispatchEvent(new MouseEvent('mouseenter'));
    expect(ui.querySelector('.ins .ptitle .rdy')?.textContent).toBe('CARGA LISTA · C');
    for (const ev of run.charge()) tiles.event(ev);
    expect(destrier().title).toBe('Destrero III · carga');
  });

  it('tells a card\'s family and its level from the loadout', () => {
    const ids: CardId[] = ['destrier', 'destrier2', 'destrier3', 'obs1', 'obs2', 'obs3', 'squire', 'lockdown'];
    expect(ids.map(familyOf)).toEqual(['destrier', 'destrier', 'destrier', 'obs', 'obs', 'obs', null, null]);
    expect(levelOf([], 'destrier')).toBe(0);
    expect(levelOf(['destrier', 'destrier2'], 'destrier')).toBe(2);
    expect(levelOf(['obs1', 'obs2', 'obs3'], 'obs')).toBe(3);
    expect(levelOf(['obs1'], 'destrier')).toBe(0);
  });
});

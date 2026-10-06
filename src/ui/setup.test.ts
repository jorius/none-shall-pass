// @vitest-environment jsdom
// packages
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// i18n
import { setLang } from '../i18n';

// local
import { renderSetup, type SetupDeps } from './setup';

// jsdom has no canvas to paint the portraits on: the url names the grid, the scale and the palette letters asked for.
const { gridUrl } = vi.hoisted(() => ({
  gridUrl: vi.fn((g: unknown[][], scale: number, pal: Record<string, string> = {}) => `data:image/png;${g.length}x${scale}:${Object.keys(pal).join('')}`),
}));
vi.mock('../art/dataurl', () => ({ gridUrl }));

describe('renderSetup', () => {
  let box: HTMLElement, picked: string[], deps: SetupDeps;
  beforeEach(() => {
    document.body.innerHTML = '';
    box = document.createElement('div');
    document.body.append(box);
    picked = [];
    deps = { knight: 'ghost', difficulty: 'incident', root: false, pick: (k) => picked.push(k), level: (d) => picked.push(d), start: () => picked.push('start'), back: () => picked.push('back'), toggleLang: () => picked.push('lang') };
  });
  afterEach(() => setLang('en'));

  it('shows six knights and four difficulties, marks the current pair, and starts with the focused START', () => {
    renderSetup(box, deps);
    expect(box.querySelectorAll('.kn').length).toBe(6);
    expect(box.querySelectorAll('.dl').length).toBe(4);
    expect(box.querySelector('.kn.sel .nm')?.textContent).toBe('Ghost');
    expect(box.querySelector('.dl.sel .nm')?.textContent).toBe('Incident');
    expect(document.activeElement?.textContent).toContain('START');
    (box.querySelector('.kn[data-id="forge"]') as HTMLButtonElement).click();
    (box.querySelector('.dl[data-id="zeroday"]') as HTMLButtonElement).click();
    (document.activeElement as HTMLButtonElement).click();
    expect(picked).toEqual(['forge', 'zeroday', 'start']);
  });

  it('tells assistive technology which knight and which difficulty are picked', () => {
    renderSetup(box, deps);
    const pressed = (sel: string): (string | null)[][] => [...box.querySelectorAll<HTMLElement>(sel)].map((b) => [b.dataset.id ?? null, b.getAttribute('aria-pressed')]);
    expect(pressed('.kn')).toEqual([['black', 'false'], ['sentinel', 'false'], ['raider', 'false'], ['warden', 'false'], ['ghost', 'true'], ['forge', 'false']]);
    expect(pressed('.dl')).toEqual([['intern', 'false'], ['analyst', 'false'], ['incident', 'true'], ['zeroday', 'false']]);
    // It follows the pick, and the ones that look picked are the ones that are pressed.
    renderSetup(box, { ...deps, knight: 'black', difficulty: 'intern' });
    expect(pressed('.kn').filter(([, v]) => v === 'true')).toEqual([['black', 'true']]);
    expect(pressed('.dl').filter(([, v]) => v === 'true')).toEqual([['intern', 'true']]);
    expect([...box.querySelectorAll('.kn.sel, .dl.sel')].every((b) => b.getAttribute('aria-pressed') === 'true')).toBe(true);
    // Not on the foot's buttons, which are actions and not choices.
    expect(box.querySelectorAll('.foot [aria-pressed]')).toHaveLength(0);
  });

  it('switches the language from the foot, after START and BACK, and START keeps the focus', () => {
    renderSetup(box, deps);
    const foot = [...box.querySelectorAll<HTMLButtonElement>('.foot button')];
    expect(foot.map((b) => b.textContent)).toEqual(['START · SPACE', 'BACK · ESC', 'ES']);
    foot[2].click();
    expect(picked).toEqual(['lang']);
    expect(document.activeElement).toBe(foot[0]);
    setLang('es');
    renderSetup(box, deps);
    expect([...box.querySelectorAll('.foot button')].map((b) => b.textContent)).toEqual(['EMPEZAR · ESPACIO', 'VOLVER · ESC', 'EN']);
  });

  it('paints each knight on foot in their own colours, once for every render', () => {
    renderSetup(box, deps);
    // The portraits are kept: a redraw paints none again (and the file's earlier render may have painted them all).
    const painted = gridUrl.mock.calls.length;
    renderSetup(box, deps);
    expect(gridUrl.mock.calls.length).toBe(painted);
    expect(painted).toBeLessThanOrEqual(6);
    const cards = [...box.querySelectorAll<HTMLButtonElement>('.kn')];
    expect(cards.map((c) => c.dataset.id)).toEqual(['black', 'sentinel', 'raider', 'warden', 'ghost', 'forge']);
    const srcs = cards.map((c) => c.querySelector<HTMLImageElement>('img.px')?.getAttribute('src'));
    // The Black Knight on the stock palette; the others recolour their own letters.
    expect(srcs[0]).toBe('data:image/png;30x3:');
    expect(srcs[1]).toBe('data:image/png;30x3:RrBbyY');
    expect(srcs[4]).toBe('data:image/png;30x3:lwmdRrBbyY');
    // The team chip carries the team's colour; the motto and the description read beside the name.
    const sentinel = cards[1];
    expect(sentinel.querySelector('.nm')?.textContent).toBe('Sentinel');
    expect(sentinel.querySelector('.team')?.textContent).toBe('BLUE TEAM');
    expect((sentinel.querySelector('.team') as HTMLElement).style.background).toMatch(/2fb6ff|47, 182, 255/);
    expect(sentinel.querySelector('.motto')?.textContent).toBe('"Logs don\'t lie."');
    expect(sentinel.querySelector('.who')?.textContent).toBe('A defender who lives in the SOC: alerts, baselines and long night shifts.');
  });

  it('rates each difficulty with its bars and multiplier, and sums the choice up in the foot', () => {
    renderSetup(box, deps);
    const rows = [...box.querySelectorAll<HTMLButtonElement>('.dl')];
    expect(rows.map((r) => r.dataset.id)).toEqual(['intern', 'analyst', 'incident', 'zeroday']);
    expect(rows.map((r) => r.querySelectorAll('.bar i').length)).toEqual([4, 4, 4, 4]);
    expect(rows.map((r) => r.querySelectorAll('.bar i.on').length)).toEqual([1, 2, 3, 4]);
    expect(rows.map((r) => r.querySelector('.bar')?.className)).toEqual(['bar l1', 'bar l2', 'bar l3', 'bar l4']);
    expect(rows.map((r) => r.querySelector('.x')?.textContent)).toEqual(['×0.5', '×1', '×1.5', '×2']);
    expect(rows[3].querySelector('.ds')?.textContent).toBe('Packets at 150%, 5 reputation, sneaky attacks from their first wave and more of them, no hints.');
    expect(rows.every((r) => r.querySelector('.rad'))).toBe(true);
    expect(box.querySelector('.foot .note')?.textContent).toBe('Ghost · Incident · ×1.5');
    expect(box.querySelector('.badge-root')).toBeNull();
    (box.querySelector('.foot .btn.ghost') as HTMLButtonElement).click();
    expect(picked).toEqual(['back']);
  });

  it('reads in Spanish, with the root badge when root mode is on', () => {
    setLang('es');
    renderSetup(box, { ...deps, root: true });
    expect(box.querySelector('h2')?.textContent).toBe('ELIGE A TU CABALLERO');
    expect(box.querySelector('p')?.textContent).toBe('Todos sostienen la misma puerta. Solo que cada uno a su manera.');
    expect(box.querySelector('.kn.sel .nm')?.textContent).toBe('Fantasma');
    expect(box.querySelector('.kn.sel .team')?.textContent).toBe('PRIVACIDAD');
    expect(box.querySelector('.dl.sel .nm')?.textContent).toBe('Incidente');
    expect([...box.querySelectorAll('.dl .x')].map((e) => e.textContent)).toEqual(['×0,5', '×1', '×1,5', '×2']);
    expect(box.querySelector('.foot .note')?.textContent).toBe('Fantasma · Incidente · ×1,5');
    expect(document.activeElement?.textContent).toBe('EMPEZAR · ESPACIO');
    expect(box.querySelector('.foot .btn.ghost')?.textContent).toBe('VOLVER · ESC');
    expect(box.querySelector('.badge-root')?.textContent).toBe('MODO ROOT · paquetes más rápidos, sin pistas, puntaje ×1,5');
  });
});

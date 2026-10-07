// @vitest-environment jsdom
// packages
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// i18n
import { setLang } from '../i18n';

// local
import type { Bests } from '../storage';
import { renderHowto, renderTitle, type TitleDeps } from './title';

describe('renderHowto', () => {
  let box: HTMLElement, back: number;
  beforeEach(() => {
    document.body.innerHTML = '';
    box = document.createElement('div');
    document.body.append(box);
    back = 0;
  });
  afterEach(() => setLang('en'));

  // The grid is a key and its meaning, cell after cell.
  const rows = (): string[][] => {
    const cells = [...box.querySelectorAll('.howto-grid > *')];
    return Array.from({ length: cells.length / 2 }, (_, i) => [cells[2 * i].textContent ?? '', cells[2 * i + 1].textContent ?? '']);
  };

  it('lists every key on a row of its own, kbd and meaning, in the order a player meets them', () => {
    renderHowto(box, () => { back++; });
    expect(rows()).toEqual([
      ['↑ ↓', 'pick a lane'],
      ['Tab', 'next packet in that lane'],
      ['Shift+Tab', 'previous packet in that lane'],
      ['Space', 'throw a spear at the target'],
      ['Esc', 'let the target go'],
      ['click', 'click a packet to target it'],
      ['H', 'hints: underline the tells (score ×0.75)'],
      ['C', 'charge the lane (Destrier III)'],
      ['T', 'the Armory: every upgrade and what you own'],
      ['M', 'mute'],
      ['P', 'pause'],
    ]);
    // The keys are drawn as keys.
    expect([...box.querySelectorAll('.howto-grid > kbd')]).toHaveLength(11);
    expect(box.querySelector('h2')?.textContent).toBe('HOW TO PLAY');
    box.querySelector<HTMLButtonElement>('.btn')!.click();
    expect(back).toBe(1);
  });

  it('says the same in Spanish, with the keys of the Spanish layout', () => {
    setLang('es');
    renderHowto(box, () => { back++; });
    expect(rows()).toEqual([
      ['↑ ↓', 'elige un carril'],
      ['Tab', 'siguiente paquete en ese carril'],
      ['Shift+Tab', 'paquete anterior en ese carril'],
      ['Espacio', 'arroja una lanza al objetivo'],
      ['Esc', 'suelta el objetivo'],
      ['clic', 'haz clic en un paquete para apuntarle'],
      ['H', 'pistas: subraya las señales (puntaje ×0,75)'],
      ['C', 'carga por el carril (Destrero III)'],
      ['T', 'la Armería: todas las mejoras y lo que tienes'],
      ['M', 'silencio'],
      ['P', 'pausa'],
    ]);
  });
});

describe('renderTitle', () => {
  let box: HTMLElement;
  const bests: Bests = { campaign: {}, overtime: {}, won: false };
  const deps = (over: Partial<TitleDeps> = {}): TitleDeps => ({
    bests, root: false, knight: 'black', difficulty: 'analyst', soundHint: true,
    play: () => undefined, overtime: () => undefined, howto: () => undefined, armory: () => undefined, toggleLang: () => undefined, ...over,
  });
  beforeEach(() => {
    document.body.innerHTML = '';
    box = document.createElement('div');
    document.body.append(box);
  });
  afterEach(() => setLang('en'));

  it('hints at the sound with a note, until the audio has been unlocked', () => {
    renderTitle(box, deps());
    expect([...box.querySelectorAll('.sound-hint')].map((e) => [e.tagName, e.className, e.textContent])).toEqual([['DIV', 'note sound-hint', '♪ press any key for sound']]);
    renderTitle(box, deps({ soundHint: false }));
    expect(box.querySelector('.sound-hint')).toBeNull();
  });

  it('hints in Spanish too', () => {
    setLang('es');
    renderTitle(box, deps());
    expect(box.querySelector('.sound-hint')?.textContent).toBe('♪ oprime cualquier tecla para el sonido');
  });

  it('keeps the hint out of the row of buttons, so no button changes place with it', () => {
    renderTitle(box, deps());
    const row = box.querySelector('.row-btns')!;
    expect(row.querySelector('.sound-hint')).toBeNull();
    const withHint = [...row.querySelectorAll('button')].map((b) => b.textContent);
    renderTitle(box, deps({ soundHint: false }));
    expect([...box.querySelectorAll('.row-btns button')].map((b) => b.textContent)).toEqual(withHint);
    expect(withHint).toEqual(['PLAY CAMPAIGN', 'OVERTIME', 'HOW TO PLAY', 'ARMORY', 'ES']);
  });
});

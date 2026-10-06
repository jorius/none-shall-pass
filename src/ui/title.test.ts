// @vitest-environment jsdom
// packages
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// i18n
import { setLang } from '../i18n';

// local
import { renderHowto } from './title';

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

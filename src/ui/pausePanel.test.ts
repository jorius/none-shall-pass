// @vitest-environment jsdom
// packages
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from 'vitest';

// i18n
import { setLang } from '../i18n';

// local
import { renderPause } from './pausePanel';

type Deps = Parameters<typeof renderPause>[1];

describe('renderPause', () => {
  let box: HTMLElement, pressed: string[];
  const deps = (over: Partial<Deps> = {}): Deps => ({
    reduced: false, audio: { sound: true, music: true, volume: 2 },
    resume: () => pressed.push('resume'), quit: () => pressed.push('quit'), armory: () => pressed.push('armory'), toggleLang: () => pressed.push('lang'),
    toggleReduced: () => pressed.push('reduced'), toggleSound: () => pressed.push('sound'), toggleMusic: () => pressed.push('music'), cycleVolume: () => pressed.push('volume'), ...over,
  });
  const rows = (): string[][] => [...box.querySelectorAll('.row-btns')].map((r) => [...r.querySelectorAll('button')].map((b) => b.textContent ?? ''));
  beforeEach(() => {
    document.body.innerHTML = '';
    box = document.createElement('div');
    document.body.append(box);
    pressed = [];
  });
  afterEach(() => setLang('en'));

  it('lays out the menu, the sound switches on a row of their own after the five buttons', () => {
    renderPause(box, deps());
    expect(rows()).toEqual([['RESUME', 'QUIT TO TITLE', 'ARMORY · T', 'ES', 'REDUCED EFFECTS · OFF'], ['SOUND · ON', 'MUSIC · ON', 'VOLUME · 2/3']]);
    for (const b of box.querySelectorAll('button')) b.click();
    expect(pressed).toEqual(['resume', 'quit', 'armory', 'lang', 'reduced', 'sound', 'music', 'volume']);
  });

  it('says ON and OFF in English, on every switch', () => {
    renderPause(box, deps({ reduced: true, audio: { sound: false, music: true, volume: 3 } }));
    expect(rows()).toEqual([['RESUME', 'QUIT TO TITLE', 'ARMORY · T', 'ES', 'REDUCED EFFECTS · ON'], ['SOUND · OFF', 'MUSIC · ON', 'VOLUME · 3/3']]);
  });

  it('says SÍ and NO in Spanish on every switch, the reduced effects included, and never ON or OFF', () => {
    setLang('es');
    renderPause(box, deps({ reduced: true, audio: { sound: true, music: false, volume: 1 } }));
    expect(rows()).toEqual([['CONTINUAR', 'SALIR AL INICIO', 'ARMERÍA · T', 'EN', 'EFECTOS REDUCIDOS · SÍ'], ['SONIDO · SÍ', 'MÚSICA · NO', 'VOLUMEN · 1/3']]);
    renderPause(box, deps({ reduced: false }));
    expect(rows()[0].at(-1)).toBe('EFECTOS REDUCIDOS · NO');
    expect(box.textContent).not.toMatch(/\b(ON|OFF)\b/);
  });

  it('takes the volume as one of the three steps the menu cycles through, not any number', () => {
    // Checked by tsc in the build: a volume of 0 or 7 is not one the pause menu can show.
    expectTypeOf<Deps['audio']['volume']>().toEqualTypeOf<1 | 2 | 3>();
  });
});

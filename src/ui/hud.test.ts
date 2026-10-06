// @vitest-environment jsdom
// packages
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// core
import { Run } from '../core/run';
import type { RunState } from '../core/state';
import { cfg } from '../core/testkit';

// i18n
import { setLang } from '../i18n';

// local
import type { App } from '../app';
import { Hud } from './hud';

describe('Hud', () => {
  let ui: HTMLElement, hud: Hud, run: Run;
  const clock = (): string => ui.querySelectorAll('.wave b')[2]?.textContent ?? '';
  const at = (timeLeft: number, phase: RunState['phase'] = 'playing'): string => {
    run.state.timeLeft = timeLeft;
    run.state.phase = phase;
    hud.frame(run);
    return clock();
  };
  beforeEach(() => {
    ui = document.createElement('div');
    hud = new Hud(ui, { act: () => undefined, root: false } as unknown as App);
    run = new Run(cfg());
    hud.start(run);
  });
  afterEach(() => setLang('en'));

  it('counts the wave down, then says CLEARING while the last packets land', () => {
    expect(clock()).toBe('0:50');
    expect(at(61)).toBe('1:01');
    expect(at(0.3)).toBe('0:01');
    expect(at(0)).toBe('CLEARING');
    expect(at(-0.5)).toBe('CLEARING');
  });

  it('shows 0:00 once the wave is over, under the draft or at the end', () => {
    expect(at(0, 'draft')).toBe('0:00');
    expect(at(-1, 'ended')).toBe('0:00');
  });

  it('says DESPEJANDO in Spanish', () => {
    at(0);
    setLang('es');
    hud.refresh(run);
    expect(clock()).toBe('DESPEJANDO');
  });

  it('draws one pip per point of the difficulty\'s reputation', () => {
    expect(ui.querySelectorAll('.pips i').length).toBe(10);
    hud.start(new Run(cfg({ difficulty: 'zeroday' })));
    expect(ui.querySelectorAll('.pips i').length).toBe(5);
    expect(ui.querySelectorAll('.pips i.off').length).toBe(0);
  });

  const pips = (): string => ui.querySelector('.pips')!.className;

  it('colours the reputation pips by how many are left', () => {
    const at = (rep: number): string => { run.state.rep = rep; hud.event({ type: 'reputation', value: rep }, run); return pips(); };
    expect(pips()).toBe('pips good');
    expect(at(8)).toBe('pips good');
    expect(at(7)).toBe('pips good');
    expect(at(6)).toBe('pips mid');
    expect(at(5)).toBe('pips mid');
    expect(at(4)).toBe('pips mid');
    expect(at(3)).toBe('pips low');
    expect(at(2)).toBe('pips low');
    expect(ui.querySelectorAll('.pips i.off').length).toBe(8);
  });

  it('scales the pip colours with the difficulty\'s reputation: green from 70%, gold from 40%, red below', () => {
    const at = (difficulty: 'intern' | 'incident' | 'zeroday', rep: number): string => {
      const r = new Run(cfg({ difficulty }));
      r.state.rep = rep;
      hud.start(r);
      return pips();
    };
    expect([5, 4, 3, 2, 1].map((rep) => at('zeroday', rep))).toEqual(['pips good', 'pips good', 'pips mid', 'pips mid', 'pips low']);
    expect([14, 10, 9, 6, 5].map((rep) => at('intern', rep))).toEqual(['pips good', 'pips good', 'pips mid', 'pips mid', 'pips low']);
    // A cap of 8, where neither share is a whole number: 70% of 8 is 5.6, so green starts at 6; 40% is 3.2, so gold starts at 4.
    expect([8, 7, 6, 5, 4, 3, 2, 1].map((rep) => at('incident', rep))).toEqual(
      ['pips good', 'pips good', 'pips good', 'pips mid', 'pips mid', 'pips low', 'pips low', 'pips low']);
    expect(ui.querySelectorAll('.pips i').length).toBe(8);
  });

  describe('the mute badge', () => {
    let audio: { sound: boolean; music: boolean };
    const badge = (): HTMLElement => ui.querySelector<HTMLElement>('.hud .mute')!;
    const shown = (): boolean => badge().style.display !== 'none';
    beforeEach(() => {
      audio = { sound: true, music: true };
      ui = document.createElement('div');
      hud = new Hud(ui, { act: () => undefined, root: false, audioSettings: () => audio } as unknown as App);
      run = new Run(cfg());
      hud.start(run);
    });

    it('shows only while sound and music are both off, as the HUD is refreshed', () => {
      expect(shown()).toBe(false);
      audio.sound = false;
      hud.refresh(run);
      expect(shown()).toBe(false);
      audio.music = false;
      hud.refresh(run);
      expect(shown()).toBe(true);
      expect(badge().textContent).toContain('MUTED · M');
      audio.sound = true;
      hud.refresh(run);
      expect(shown()).toBe(false);
    });

    it('draws a plain note and leaves the striking through to the CSS, with no combining solidus', () => {
      audio.sound = false;
      audio.music = false;
      hud.refresh(run);
      const note = badge().querySelector('.note');
      expect(note?.textContent).toBe('\u266A');
      expect(badge().textContent).toBe('\u266A MUTED · M');
      expect(badge().textContent).not.toContain('\u0338');
      setLang('es');
      hud.refresh(run);
      expect(badge().querySelector('.note')).toBe(note);
      expect(badge().textContent).toBe('\u266A SILENCIO · M');
    });

    it('is up from the start when the last session ended muted, and behind the title as well', () => {
      audio.sound = false;
      audio.music = false;
      hud.start(new Run(cfg()));
      expect(shown()).toBe(true);
      hud.refresh(null);
      expect(shown()).toBe(true);
    });

    it('says SILENCIO · M in Spanish', () => {
      audio.sound = false;
      audio.music = false;
      hud.refresh(run);
      setLang('es');
      hud.refresh(run);
      expect(badge().textContent).toContain('SILENCIO · M');
    });

    it('stays out when no audio is wired', () => {
      const bare = document.createElement('div');
      const quiet = new Hud(bare, { act: () => undefined, root: false } as unknown as App);
      quiet.start(run);
      quiet.refresh(run);
      expect(bare.querySelector<HTMLElement>('.hud .mute')!.style.display).toBe('none');
    });
  });

  it('hides the hints toggle on Zero-day, which allows none, as it does in root mode', () => {
    const hints = (): string => ui.querySelector<HTMLElement>('.toggle')!.style.display;
    expect(hints()).toBe('');
    hud.start(new Run(cfg({ difficulty: 'zeroday' })));
    expect(hints()).toBe('none');
    hud.start(new Run(cfg({ root: true })));
    expect(hints()).toBe('none');
    hud.start(run);
    expect(hints()).toBe('');
    // Behind the title the HUD keeps showing the run it was last started with, hints toggle included.
    hud.start(new Run(cfg({ difficulty: 'zeroday' })));
    hud.refresh(null);
    expect(hints()).toBe('none');
    hud.start(run);
    hud.refresh(null);
    expect(hints()).toBe('');
  });
});

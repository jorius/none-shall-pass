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
});

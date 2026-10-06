// @vitest-environment jsdom
// packages
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// core
import { place } from '../core/testkit';

// game
import type { FieldScene } from '../game/FieldScene';
import type { EffectsView } from '../game/views/effects';

// i18n
import { onLang, setLang } from '../i18n';

// local
import { App } from '../app';
import { createStore, type Store } from '../storage';
import { Overlays } from './overlays';

// jsdom has no canvas to paint the card icons on.
vi.mock('../art/dataurl', () => ({ iconUrl: (icon: string) => `data:image/png;${icon}` }));

describe('Overlays', () => {
  let ui: HTMLElement, hud: HTMLElement, app: App, store: Store, effects: { reduced: boolean }, unLang = (): void => {};
  const box = (): HTMLElement => ui.querySelector('.ov')!;
  const buttons = (): HTMLButtonElement[] => [...box().querySelectorAll('button')];
  const named = (text: RegExp): HTMLButtonElement => buttons().find((b) => text.test(b.textContent ?? ''))!;
  const boot = (): void => {
    app = new App({ onFrame: null } as unknown as FieldScene, store);
    app.add(new Overlays(ui, app, { effects: effects as EffectsView }));
    // As main.ts wires it: a language switch refreshes every view.
    unLang = onLang(() => app.refresh());
    app.quit();
  };
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    ui = document.createElement('div');
    document.body.appendChild(ui);
    hud = document.createElement('div');
    hud.appendChild(document.createElement('button'));
    ui.appendChild(hud);
    store = createStore(null);
    effects = { reduced: false };
  });
  afterEach(() => { unLang(); vi.useRealTimers(); setLang('en'); });

  it('opens on the title, Overtime locked until a campaign is won', () => {
    boot();
    expect(box().className).toBe('ov show ov-title');
    expect(named(/^OVERTIME$/).disabled).toBe(true);
    expect(box().textContent).toContain('win the campaign to unlock');
    named(/PLAY CAMPAIGN/).click();
    expect(app.screen).toBe('playing');
    expect(app.run?.state.cfg.mode).toBe('campaign');
    expect(box().className).toBe('ov');
  });

  it('unlocks Overtime and shows the bests after a win', () => {
    store.recordResult({ mode: 'campaign', root: false, tampered: false, won: true, reason: 'won', score: 18420, wave: 6, wavesCleared: 6, uptime: 80, rep: 9,
      stats: { hits: { 1: 0, 2: 0, 3: 0 }, squireHits: 0, ruleBlocks: 0, served: 0, decoysKept: 0, neutralized: 0, falsePositives: 1, breaches: { sqli: 0, xss: 0, brute: 0, scan: 0, flood: 0 }, wavesCleared: 6 } });
    boot();
    expect(named(/^OVERTIME$/).disabled).toBe(false);
    expect(box().querySelector('.best')?.textContent).toContain('Campaign · grade A · 18,420 pts');
    named(/^OVERTIME$/).click();
    expect(app.run?.state.cfg.mode).toBe('overtime');
  });

  it('keeps the rest of the layer inert while a screen is up', () => {
    boot();
    expect(hud.hasAttribute('inert')).toBe(true);
    expect(box().hasAttribute('inert')).toBe(false);
    named(/PLAY CAMPAIGN/).click();
    expect(hud.hasAttribute('inert')).toBe(false);
  });

  it('switches the language in place and remembers it', () => {
    boot();
    named(/^ES$/).click();
    expect(named(/JUGAR CAMPAÑA/)).toBeTruthy();
    expect(store.prefs().lang).toBe('es');
  });

  it('drafts: a free pick, then only what the credits buy', () => {
    boot();
    app.startRun('campaign');
    app.dispatch(app.run!.cheat('skip'));
    expect(box().className).toBe('ov show ov-draft');
    expect(buttons().filter((b) => b.textContent === 'TAKE · FREE')).toHaveLength(3);
    box().querySelector<HTMLButtonElement>('.ucard .btn')!.click();
    expect(app.run!.state.owned).toEqual(['lockdown', 'destrier']);
    const [first, ...rest] = [...box().querySelectorAll<HTMLButtonElement>('.ucard .btn')];
    expect([first.textContent, first.disabled]).toEqual(['TAKEN ✓', true]);
    expect(rest.every((b) => b.textContent?.startsWith('BUY · ') && b.disabled)).toBe(true);
    expect(named(/REROLL/).disabled).toBe(true);
    named(/NEXT WAVE/).click();
    expect(app.screen).toBe('playing');
    expect(app.run!.state.wave).toBe(2);
  });

  it('keeps a keyboard player on the panel when a pick redraws it', () => {
    boot();
    app.startRun('campaign');
    app.run!.state.credits = 5000;
    app.dispatch(app.run!.cheat('skip'));
    const take = box().querySelector<HTMLButtonElement>('.ucard .btn')!;
    take.focus();
    take.click();
    const now = document.activeElement as HTMLButtonElement;
    expect(box().contains(now)).toBe(true);
    expect(now.disabled).toBe(false);
    expect(now.textContent).toMatch(/^BUY · /);
  });

  it('never lets a mouse click put the focus on a button, where Space would click it again', () => {
    boot();
    const play = named(/PLAY CAMPAIGN/);
    const down = new MouseEvent('mousedown', { cancelable: true });
    play.dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
  });

  it('pauses with language and reduced effects, the effects switching live', () => {
    boot();
    app.startRun('campaign');
    app.act('pause');
    expect(box().className).toBe('ov show ov-pause');
    named(/REDUCED EFFECTS · OFF/).click();
    expect(effects.reduced).toBe(true);
    expect(ui.classList.contains('reduced')).toBe(true);
    expect(store.prefs().reducedFx).toBe(true);
    expect(named(/REDUCED EFFECTS · ON/)).toBeTruthy();
    named(/RESUME/).click();
    expect(app.screen).toBe('playing');
    app.act('pause');
    named(/QUIT TO TITLE/).click();
    expect([app.screen, app.run]).toEqual(['title', null]);
    expect(box().className).toBe('ov show ov-title');
  });

  it('debriefs with the mistakes as text, then plays again in the same mode or goes to the title', () => {
    boot();
    app.startRun('overtime');
    const s = app.run!.state;
    const p = place(s, 'legit-socks', 300);
    p.t = { ...p.t, card: '<img src=x onerror="window.__pwned=1">' };
    s.log.push({ seq: 1, wave: 1, outcome: 'fp', packet: p, points: 0, fpBy: 'knight' });
    app.dispatch([{ type: 'runEnded', reason: 'serverDown' }]);
    vi.advanceTimersByTime(1200);
    expect(box().className).toBe('ov show ov-debrief');
    expect(box().querySelector('h2')?.textContent).toBe('OVERTIME OVER');
    expect(box().querySelector('.mistake code')?.textContent).toBe('W1 · FALSE POSITIVE · <img src=x onerror="window.__pwned=1">');
    expect(box().querySelector('img')).toBeNull();
    expect(box().querySelector<HTMLTextAreaElement>('.share')?.value).toContain('OVERTIME');
    expect(store.bests().overtime.normal).toEqual({ wave: 1, score: 0 });
    named(/PLAY AGAIN/).click();
    expect([app.screen, app.run?.state.cfg.mode, app.run?.state.log.length]).toEqual(['playing', 'overtime', 0]);
    app.dispatch([{ type: 'runEnded', reason: 'serverDown' }]);
    vi.advanceTimersByTime(1200);
    named(/^TITLE$/).click();
    expect([app.screen, app.run]).toEqual(['title', null]);
  });
});

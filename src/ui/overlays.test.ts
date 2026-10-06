// @vitest-environment jsdom
// packages
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// core
import { KONAMI } from '../core/keys';
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
  afterEach(() => { unLang(); vi.restoreAllMocks(); vi.useRealTimers(); setLang('en'); });

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

  it('shows the won best on the title, even after a higher-scoring loss', () => {
    const stats = { hits: { 1: 0, 2: 0, 3: 0 }, squireHits: 0, ruleBlocks: 0, served: 0, decoysKept: 0, neutralized: 0, falsePositives: 0, breaches: { sqli: 0, xss: 0, brute: 0, scan: 0, flood: 0 }, wavesCleared: 6 };
    store.recordResult({ mode: 'campaign', root: false, tampered: false, won: false, reason: 'serverDown', score: 16000, wave: 5, wavesCleared: 4, uptime: 0, rep: 9, stats });
    store.recordResult({ mode: 'campaign', root: false, tampered: false, won: true, reason: 'won', score: 9000, wave: 6, wavesCleared: 6, uptime: 30, rep: 9, stats });
    store.recordResult({ mode: 'campaign', root: false, tampered: false, won: false, reason: 'serverDown', score: 20000, wave: 5, wavesCleared: 4, uptime: 0, rep: 9, stats });
    boot();
    expect(box().querySelector('.best')?.textContent).toBe('BEST Campaign · grade C · 9,000 pts');
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
    named(/^ES$/).click();
    expect(box().querySelector('h2')?.textContent).toBe('EN PAUSA');
    expect([store.prefs().lang, app.screen]).toEqual(['es', 'paused']);
    named(/^EN$/).click();
    named(/RESUME/).click();
    expect(app.screen).toBe('playing');
    app.act('pause');
    named(/QUIT TO TITLE/).click();
    expect([app.screen, app.run]).toEqual(['title', null]);
    expect(box().className).toBe('ov show ov-title');
  });

  it('keeps a win that is quit before its debrief opens: recorded once, Overtime unlocked', () => {
    boot();
    const record = vi.spyOn(store, 'recordResult');
    app.startRun('campaign');
    app.run!.state.endReason = 'won';
    app.dispatch([{ type: 'runEnded', reason: 'won' }]);
    vi.advanceTimersByTime(500);
    app.quit();
    expect(store.bests().won).toBe(true);
    expect(named(/^OVERTIME$/).disabled).toBe(false);
    app.startRun('campaign');
    vi.advanceTimersByTime(5000);
    expect(record).toHaveBeenCalledTimes(1);
    expect([app.screen, box().className]).toEqual(['playing', 'ov']);
  });

  it('shows the best it had to beat and how far a lost campaign got', () => {
    const stats = { hits: { 1: 0, 2: 0, 3: 0 }, squireHits: 0, ruleBlocks: 0, served: 0, decoysKept: 0, neutralized: 0, falsePositives: 0, breaches: { sqli: 0, xss: 0, brute: 0, scan: 0, flood: 0 }, wavesCleared: 2 };
    store.recordResult({ mode: 'campaign', root: false, tampered: false, won: false, reason: 'serverDown', score: 4210, wave: 2, wavesCleared: 1, uptime: 0, rep: 9, stats });
    boot();
    app.startRun('campaign');
    Object.assign(app.run!.state, { wave: 3, score: 5030 });
    app.run!.state.stats.breaches.brute = 2;
    app.dispatch([{ type: 'runEnded', reason: 'serverDown' }]);
    vi.advanceTimersByTime(1200);
    const notes = [...box().querySelectorAll('.note')].map((e) => e.textContent);
    expect(notes).toEqual(['GRADE', 'Previous best 4,210 pts · grade F']);
    expect(box().querySelector('.newbest')?.textContent).toBe('NEW BEST');
    const rows = [...box().querySelectorAll('.statlist > div:not(.fams)')].map((e) => [e.firstChild?.textContent, e.querySelector('b')?.textContent]);
    expect(rows[0]).toEqual(['Wave reached', '3 / 6']);
    expect(box().querySelector('.fams')?.textContent).toBe('SQLi 0XSS 0brute force 2scan 0flood 0');
  });

  it('keeps a keyboard pick among the affordable cards, wrapping back before NEXT WAVE', () => {
    boot();
    app.startRun('campaign');
    app.run!.state.credits = 5000;
    app.dispatch(app.run!.cheat('skip'));
    const cards = (): HTMLButtonElement[] => [...box().querySelectorAll<HTMLButtonElement>('.ucard .btn')];
    cards()[0].click();
    const last = cards()[2];
    last.focus();
    last.click();
    expect(document.activeElement).toBe(cards()[1]);
  });

  it('lets one Enter or Space be one click: a held key repeats nothing', () => {
    boot();
    const play = named(/PLAY CAMPAIGN/);
    for (const [key, repeat, blocked] of [['Enter', true, true], [' ', true, true], ['Enter', false, false], ['Tab', true, false]] as const) {
      const ev = new KeyboardEvent('keydown', { key, repeat, cancelable: true });
      play.dispatchEvent(ev);
      expect(ev.defaultPrevented, `${key} ${repeat}`).toBe(blocked);
    }
  });

  it('selects the share line without a clipboard, and says which keys copy it', () => {
    const sent: unknown[] = [];
    (window as unknown as { umami?: unknown }).umami = { track: (n: string) => sent.push(n) };
    boot();
    app.startRun('campaign');
    app.dispatch([{ type: 'runEnded', reason: 'serverDown' }]);
    vi.advanceTimersByTime(1200);
    expect(navigator.clipboard).toBeUndefined();
    named(/COPY RESULT/).click();
    expect(named(/SELECTED/).textContent).toBe('SELECTED · CTRL+C');
    expect(document.activeElement).toBe(box().querySelector('.share'));
    vi.spyOn(navigator, 'platform', 'get').mockReturnValue('MacIntel');
    app.refresh();
    named(/COPY RESULT/).click();
    expect(named(/SELECTED/).textContent).toBe('SELECTED · ⌘C');
    // Nothing was copied, so nothing is counted as shared.
    expect(sent).toEqual([]);
    delete (window as unknown as { umami?: unknown }).umami;
  });

  it('counts a share only once the clipboard took it', async () => {
    const sent: unknown[] = [];
    (window as unknown as { umami?: unknown }).umami = { track: (n: string, d: unknown) => sent.push([n, d]) };
    let take: () => void = () => {};
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: () => new Promise<void>((r) => { take = r; }) } });
    try {
      boot();
      app.startRun('campaign');
      app.dispatch([{ type: 'runEnded', reason: 'serverDown' }]);
      vi.advanceTimersByTime(1200);
      named(/COPY RESULT/).click();
      expect(sent).toEqual([]);
      take();
      await Promise.resolve();
      expect([named(/COPIED/).textContent, sent]).toEqual(['COPIED ✓', [['share-copied', { mode: 'campaign' }]]]);
    } finally {
      delete (navigator as unknown as { clipboard?: unknown }).clipboard;
      delete (window as unknown as { umami?: unknown }).umami;
    }
  });

  it('goes back from the how-to with BACK or Esc', () => {
    boot();
    named(/HOW TO PLAY/).click();
    expect(box().className).toBe('ov show ov-howto');
    named(/BACK/).click();
    expect(box().className).toBe('ov show ov-title');
    named(/HOW TO PLAY/).click();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(box().className).toBe('ov show ov-title');
  });

  it('switches root mode on the screen it was typed on, the how-to included', () => {
    const konami = (): void => { for (const key of KONAMI) window.dispatchEvent(new KeyboardEvent('keydown', { key })); };
    boot();
    konami();
    expect(box().className).toBe('ov show ov-title');
    expect(box().querySelector('.badge-root')?.textContent).toBe('ROOT MODE · faster packets, no hints, ×1.5 score');
    named(/HOW TO PLAY/).click();
    konami();
    expect([app.root, box().className]).toEqual([false, 'ov show ov-howto']);
    named(/BACK/).click();
    expect(box().querySelector('.badge-root')).toBeNull();
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
    expect([box().querySelector('.note')?.textContent, box().querySelector('.grade')?.textContent]).toEqual(['WAVE REACHED', '1']);
    expect([...box().querySelectorAll('.fams span')].map((e) => e.textContent)).toEqual(['SQLi 0', 'XSS 0', 'brute force 0', 'scan 0', 'flood 0']);
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

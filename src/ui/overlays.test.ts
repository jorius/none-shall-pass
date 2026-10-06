// @vitest-environment jsdom
// packages
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// core
import { cardById } from '../core/content/cards';
import type { LogEntry } from '../core/events';
import { KONAMI } from '../core/keys';
import { freshState, place } from '../core/testkit';

// game
import type { FieldScene } from '../game/FieldScene';
import type { EffectsView } from '../game/views/effects';

// i18n
import { onLang, setLang } from '../i18n';

// local
import { App } from '../app';
import { createStore, type Store } from '../storage';
import { Overlays } from './overlays';

// jsdom has no canvas to paint the card icons or the knights' portraits on.
vi.mock('../art/dataurl', () => ({ iconUrl: (icon: string) => `data:image/png;${icon}`, gridUrl: (g: unknown[][], scale: number) => `data:image/png;${g.length}x${scale}` }));

// A breach or a false positive as the log records it, on a real template.
const fakeEntry = (outcome: 'breach' | 'fp'): LogEntry => ({ seq: 1, wave: 1, outcome, packet: place(freshState(), outcome === 'fp' ? 'legit-socks' : 'scan-telnet', 300), points: 0 });

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

  it('opens on the title, Overtime locked until a campaign is won, and PLAY goes to the setup before the run', () => {
    boot();
    expect(box().className).toBe('ov show ov-title');
    expect(named(/^OVERTIME$/).disabled).toBe(true);
    expect(box().textContent).toContain('win the campaign to unlock');
    expect(box().textContent).toContain('Playing as The Black Knight · Analyst');
    named(/PLAY CAMPAIGN/).click();
    expect([app.screen, app.run, box().className]).toEqual(['setup', null, 'ov show ov-setup']);
    expect(box().querySelectorAll('.kn img.px')).toHaveLength(6);
    expect(document.activeElement).toBe(named(/^START/));
    named(/^START/).click();
    expect(app.screen).toBe('playing');
    expect(app.run?.state.cfg).toMatchObject({ mode: 'campaign', knight: 'black', difficulty: 'analyst' });
    expect(box().className).toBe('ov');
    expect(document.activeElement).toBe(document.body);
  });

  it('unlocks Overtime and shows the bests after a win', () => {
    store.recordResult({ mode: 'campaign', difficulty: 'analyst', knight: 'black', root: false, tampered: false, won: true, reason: 'won', score: 18420, wave: 6, wavesCleared: 6, uptime: 80, rep: 9,
      stats: { hits: { 1: 0, 2: 0, 3: 0 }, squireHits: 0, chargeHits: 0, ruleBlocks: 0, served: 0, decoysKept: 0, neutralized: 0, falsePositives: 1, breaches: { sqli: 0, xss: 0, brute: 0, scan: 0, flood: 0 }, wavesCleared: 6 } });
    boot();
    expect(named(/^OVERTIME$/).disabled).toBe(false);
    expect(box().querySelector('.best')?.textContent).toContain('Campaign · grade A · 18,420 pts');
    named(/^OVERTIME$/).click();
    expect([app.screen, app.pendingMode]).toEqual(['setup', 'overtime']);
    named(/^START/).click();
    expect(app.run?.state.cfg.mode).toBe('overtime');
  });

  it('starts the run on the pair picked on the setup, remembers it, and the title follows it', () => {
    const stats = { hits: { 1: 0, 2: 0, 3: 0 }, squireHits: 0, chargeHits: 0, ruleBlocks: 0, served: 0, decoysKept: 0, neutralized: 0, falsePositives: 0, breaches: { sqli: 0, xss: 0, brute: 0, scan: 0, flood: 0 }, wavesCleared: 6 };
    store.recordResult({ mode: 'campaign', difficulty: 'intern', knight: 'warden', root: false, tampered: false, won: true, reason: 'won', score: 7000, wave: 6, wavesCleared: 6, uptime: 95, rep: 14, stats });
    boot();
    // The Analyst's bests are shown until a difficulty is chosen: the Intern's win stays out of sight.
    expect(box().querySelector('.best')).toBeNull();
    named(/PLAY CAMPAIGN/).click();
    box().querySelector<HTMLButtonElement>('.kn[data-id="warden"]')!.click();
    box().querySelector<HTMLButtonElement>('.dl[data-id="intern"]')!.click();
    expect([box().querySelector('.kn.sel')?.getAttribute('data-id'), box().querySelector('.dl.sel')?.getAttribute('data-id')]).toEqual(['warden', 'intern']);
    expect(box().querySelector('.foot .note')?.textContent).toBe('Warden · Intern · ×0.5');
    expect(store.prefs()).toMatchObject({ knight: 'warden', difficulty: 'intern' });
    named(/^START/).click();
    expect(app.run?.state.cfg).toMatchObject({ mode: 'campaign', knight: 'warden', difficulty: 'intern' });
    app.quit();
    expect(box().textContent).toContain('Playing as Warden · Intern');
    expect(box().querySelector('.best')?.textContent).toBe('BEST Campaign · grade S · 7,000 pts');
    expect(app.run).toBeNull();
    named(/PLAY CAMPAIGN/).click();
    expect(box().querySelector('.kn.sel')?.getAttribute('data-id')).toBe('warden');
  });

  it('goes back from the setup to the title with BACK or Esc, keeping a pick made before leaving', () => {
    boot();
    named(/PLAY CAMPAIGN/).click();
    box().querySelector<HTMLButtonElement>('.kn[data-id="raider"]')!.click();
    named(/^BACK/).click();
    expect([app.screen, app.run, box().className]).toEqual(['title', null, 'ov show ov-title']);
    expect(box().textContent).toContain('Playing as Raider · Analyst');
    named(/PLAY CAMPAIGN/).click();
    expect(box().querySelector('.kn.sel')?.getAttribute('data-id')).toBe('raider');
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect([app.screen, box().className]).toEqual(['title', 'ov show ov-title']);
  });

  it('keeps a keyboard player on the card they picked, and START under Space for everyone else', () => {
    boot();
    named(/PLAY CAMPAIGN/).click();
    // A mouse pick: the focus never left START, so Space still starts.
    box().querySelector<HTMLButtonElement>('.dl[data-id="zeroday"]')!.click();
    expect(document.activeElement).toBe(named(/^START/));
    // A keyboard pick: the same card, now selected, keeps the focus.
    const forge = box().querySelector<HTMLButtonElement>('.kn[data-id="forge"]')!;
    forge.focus();
    forge.click();
    const now = document.activeElement as HTMLButtonElement;
    expect([now.className, now.dataset.id]).toEqual(['kn sel', 'forge']);
    named(/^START/).click();
    expect(app.run?.state.cfg).toMatchObject({ knight: 'forge', difficulty: 'zeroday', hints: false });
  });

  it('shows the won best on the title, even after a higher-scoring loss', () => {
    const stats = { hits: { 1: 0, 2: 0, 3: 0 }, squireHits: 0, chargeHits: 0, ruleBlocks: 0, served: 0, decoysKept: 0, neutralized: 0, falsePositives: 0, breaches: { sqli: 0, xss: 0, brute: 0, scan: 0, flood: 0 }, wavesCleared: 6 };
    store.recordResult({ mode: 'campaign', difficulty: 'analyst', knight: 'black', root: false, tampered: false, won: false, reason: 'serverDown', score: 16000, wave: 5, wavesCleared: 4, uptime: 0, rep: 9, stats });
    store.recordResult({ mode: 'campaign', difficulty: 'analyst', knight: 'black', root: false, tampered: false, won: true, reason: 'won', score: 9000, wave: 6, wavesCleared: 6, uptime: 30, rep: 9, stats });
    store.recordResult({ mode: 'campaign', difficulty: 'analyst', knight: 'black', root: false, tampered: false, won: false, reason: 'serverDown', score: 20000, wave: 5, wavesCleared: 4, uptime: 0, rep: 9, stats });
    boot();
    expect(box().querySelector('.best')?.textContent).toBe('BEST Campaign · grade C · 9,000 pts');
  });

  it('keeps the rest of the layer inert while a screen is up', () => {
    boot();
    expect(hud.hasAttribute('inert')).toBe(true);
    expect(box().hasAttribute('inert')).toBe(false);
    named(/PLAY CAMPAIGN/).click();
    expect(hud.hasAttribute('inert')).toBe(true);
    named(/^START/).click();
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

  it('shows the reputation against its difficulty\'s cap on the draft', () => {
    boot();
    app.startRun('campaign');
    const s = app.run!.state;
    s.cfg = { ...s.cfg, difficulty: 'intern' };
    Object.assign(s, { rep: 12, uptime: 90, credits: 1234 });
    app.dispatch(app.run!.cheat('skip'));
    expect(box().querySelector('.ov-draft p')?.textContent).toBe('Uptime 90% · reputation 12/14 · 1,234 credits');
    setLang('es');
    app.refresh();
    expect(box().querySelector('.ov-draft p')?.textContent).toBe('Disponibilidad 90% · reputación 12/14 · 1.234 créditos');
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
    const stats = { hits: { 1: 0, 2: 0, 3: 0 }, squireHits: 0, chargeHits: 0, ruleBlocks: 0, served: 0, decoysKept: 0, neutralized: 0, falsePositives: 0, breaches: { sqli: 0, xss: 0, brute: 0, scan: 0, flood: 0 }, wavesCleared: 2 };
    store.recordResult({ mode: 'campaign', difficulty: 'analyst', knight: 'black', root: false, tampered: false, won: false, reason: 'serverDown', score: 4210, wave: 2, wavesCleared: 1, uptime: 0, rep: 9, stats });
    boot();
    app.startRun('campaign');
    Object.assign(app.run!.state, { wave: 3, score: 5030 });
    Object.assign(app.run!.state.stats, { chargeHits: 3, squireHits: 1 });
    app.run!.state.stats.breaches.brute = 2;
    app.dispatch([{ type: 'runEnded', reason: 'serverDown' }]);
    vi.advanceTimersByTime(1200);
    const notes = [...box().querySelectorAll('.note')].map((e) => e.textContent);
    expect(notes).toEqual(['The Black Knight · "None shall pass." · Analyst', 'GRADE', 'Previous best 4,210 pts · grade F']);
    expect(box().querySelector('.newbest')?.textContent).toBe('NEW BEST');
    const rows = [...box().querySelectorAll('.statlist > div:not(.fams)')].map((e) => [e.firstChild?.textContent, e.querySelector('b')?.textContent]);
    expect(rows[0]).toEqual(['Wave reached', '3 / 6']);
    // The charge's kills sit next to the squire's.
    expect(rows.slice(3, 5)).toEqual([['Squire hits', '1'], ['Charge kills', '3']]);
    expect(box().querySelector('.fams')?.textContent).toBe('SQLi 0XSS 0brute force 2scan 0flood 0');
    expect(box().querySelector('.mistakes p')?.textContent).toBe('No mistakes. None shall pass, indeed.');
  });

  it('continues from the recap with Space without taking a card', () => {
    boot();
    app.startRun('campaign');
    const run = app.run!;
    run.state.owned = ['lockdown'];
    run.state.waveMistakes = [fakeEntry('breach')];
    run.state.phase = 'draft';
    run.state.draft = { picks: [cardById('squire'), cardById('lens'), cardById('quote')], free: true, taken: [] };
    app.dispatch([{ type: 'draftOpened', draft: run.state.draft }]);
    expect(ui.querySelector('.ov-recap')).not.toBeNull();
    expect(document.activeElement).toBe(ui.querySelector('.ov-recap .btn'));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(app.screen).toBe('draft');
    expect(document.activeElement).toBe(document.body);
    expect(run.state.draft.taken).toEqual([]);
  });

  it('recaps the wave: the counts, each mistake with its tells underlined as text, and why', () => {
    boot();
    app.startRun('campaign');
    const run = app.run!;
    const breach = fakeEntry('breach'), again = fakeEntry('breach'), fp = fakeEntry('fp');
    // The tells are authored against the full request, which is what the row shows.
    breach.packet.t = { ...breach.packet.t, raw: 'GET /x?q=<img src=x onerror=alert(1)>\nHost: shop.example', hints: ['onerror=', '<img src=x', ''] };
    run.state.waveMistakes = [breach, again, fp];
    run.state.phase = 'draft';
    run.state.draft = { picks: [], free: true, taken: [] };
    app.dispatch([{ type: 'draftOpened', draft: run.state.draft }]);
    expect(box().className).toBe('ov show ov-recap');
    expect(box().querySelector('h2')?.textContent).toBe('WAVE 1 CLEARED');
    expect(box().querySelector('p.note')?.textContent).toBe('2 breaches · 1 false alarm');
    const rows = [...box().querySelectorAll('.mistake')];
    expect(rows.map((r) => r.className)).toEqual(['mistake breach', 'mistake breach', 'mistake fp']);
    expect([...rows[0].querySelectorAll('.mhead span')].map((e) => e.textContent)).toEqual(['BREACH', 'PORT SCAN', 'W1']);
    // The tells come underlined in the order they appear, and the request stays text: no image, no handler.
    expect(rows[0].querySelector('pre')?.textContent).toBe('GET /x?q=<img src=x onerror=alert(1)>\nHost: shop.example');
    expect([...rows[0].querySelectorAll('mark')].map((m) => m.textContent)).toEqual(['<img src=x', 'onerror=']);
    expect(box().querySelector('img')).toBeNull();
    expect([...rows[2].querySelectorAll('.mhead span')].map((e) => e.textContent)).toEqual(['FALSE POSITIVE', 'REAL USER', 'W1']);
    expect(rows[2].querySelector('mark')).toBeNull();
    expect(rows[2].querySelector('.why')?.textContent).toBe('A shopper looking for socks. Let it through.');
    expect(box().querySelector('.more')).toBeNull();
    // In Spanish, in place; one of a kind reads in the singular.
    setLang('es');
    app.refresh();
    expect(box().querySelector('h2')?.textContent).toBe('OLEADA 1 SUPERADA');
    expect(box().querySelector('p.note')?.textContent).toBe('2 brechas · 1 falsa alarma');
    expect(named(/CONTINUAR/)).toBeTruthy();
    run.state.waveMistakes = [breach];
    app.refresh();
    expect(box().querySelector('p.note')?.textContent).toBe('1 brecha · 0 falsas alarmas');
    setLang('en');
    app.refresh();
    expect(box().querySelector('p.note')?.textContent).toBe('1 breach · 0 false alarms');
  });

  it('underlines the tells of the full request, not only the card line', () => {
    boot();
    app.startRun('campaign');
    const run = app.run!;
    // flood-login's one tell is the User-Agent header, which the card line never shows.
    const flood: LogEntry = { seq: 1, wave: 2, outcome: 'breach', packet: place(freshState(), 'flood-login', 300), points: 0 };
    run.state.waveMistakes = [flood];
    run.state.phase = 'draft';
    run.state.draft = { picks: [], free: true, taken: [] };
    app.dispatch([{ type: 'draftOpened', draft: run.state.draft }]);
    const row = box().querySelector('.mistake.breach')!;
    expect(row.querySelector('pre')?.textContent?.split('\n')).toEqual(['GET /login HTTP/1.1', 'Host: shop.example', 'User-Agent: curl/8.9.1']);
    expect([...row.querySelectorAll('mark')].map((m) => m.textContent)).toEqual(['curl/8.9.1']);
    expect([...row.querySelectorAll('.mhead span')].map((e) => e.textContent)).toEqual(['BREACH', 'BOTNET FLOOD', 'W2']);
  });

  it('caps the debrief list at thirty of the run\'s mistakes and counts the rest from the stats', () => {
    boot();
    app.startRun('campaign');
    const s = app.run!.state;
    // The kept list is itself capped (200), so the rest is counted from the run's totals, not from the list.
    for (let i = 0; i < 33; i++) s.mistakes.push(fakeEntry(i % 2 ? 'fp' : 'breach'));
    s.stats.falsePositives = 100;
    s.stats.breaches.scan = 150;
    app.dispatch([{ type: 'runEnded', reason: 'serverDown' }]);
    vi.advanceTimersByTime(1200);
    expect(box().className).toBe('ov show ov-debrief');
    expect(box().querySelectorAll('.mistake')).toHaveLength(30);
    expect(box().querySelector('.mistakes .more')?.textContent).toBe('+220 more');
    // Thirty mistakes in all: every one shown, nothing more to count.
    s.mistakes.length = 30;
    s.stats.falsePositives = 15;
    s.stats.breaches.scan = 15;
    app.refresh();
    expect(box().querySelectorAll('.mistake')).toHaveLength(30);
    expect(box().querySelector('.mistakes .more')).toBeNull();
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

  it('debriefs with the mistakes as text, then plays again on the same pair, skipping the setup, or goes to the title', () => {
    boot();
    app.startRun('overtime', { knight: 'raider', difficulty: 'zeroday' });
    const s = app.run!.state;
    const p = place(s, 'legit-socks', 300);
    p.t = { ...p.t, raw: '<img src=x onerror="window.__pwned=1">' };
    s.mistakes.unshift({ seq: 1, wave: 1, outcome: 'fp', packet: p, points: 0, fpBy: 'knight' });
    s.stats.falsePositives = 1;
    app.dispatch([{ type: 'runEnded', reason: 'serverDown' }]);
    vi.advanceTimersByTime(1200);
    expect(box().className).toBe('ov show ov-debrief');
    expect(box().querySelector('h2')?.textContent).toBe('OVERTIME OVER');
    // The knight and the difficulty under the head, in the share line too.
    expect(box().querySelector('p.note')?.textContent).toBe('Raider · "Think like the attacker." · Zero-day');
    expect([box().querySelector('.debrief .note')?.textContent, box().querySelector('.grade')?.textContent]).toEqual(['WAVE REACHED', '1']);
    expect([...box().querySelectorAll('.fams span')].map((e) => e.textContent)).toEqual(['SQLi 0', 'XSS 0', 'brute force 0', 'scan 0', 'flood 0']);
    expect([...box().querySelectorAll('.mistake .mhead span')].map((e) => e.textContent)).toEqual(['FALSE POSITIVE', 'REAL USER', 'W1']);
    expect(box().querySelector('.mistake pre')?.textContent).toBe('<img src=x onerror="window.__pwned=1">');
    expect(box().querySelector('img')).toBeNull();
    expect(box().querySelector<HTMLTextAreaElement>('.share')?.value).toContain('OVERTIME — wave 1 · 0 pts · Raider · Zero-day');
    expect(store.bests().overtime['zeroday-normal']).toEqual({ wave: 1, score: 0 });
    setLang('es');
    app.refresh();
    expect(box().querySelector('p.note')?.textContent).toBe('Asaltante · "Piensa como el atacante." · Día cero');
    expect(box().querySelector<HTMLTextAreaElement>('.share')?.value).toContain('oleada 1 · 0 pts · Asaltante · Día cero');
    setLang('en');
    app.refresh();
    named(/PLAY AGAIN/).click();
    expect([app.screen, app.run?.state.log.length]).toEqual(['playing', 0]);
    expect(app.run?.state.cfg).toMatchObject({ mode: 'overtime', knight: 'raider', difficulty: 'zeroday' });
    app.dispatch([{ type: 'runEnded', reason: 'serverDown' }]);
    vi.advanceTimersByTime(1200);
    named(/^TITLE$/).click();
    expect([app.screen, app.run]).toEqual(['title', null]);
    expect(box().textContent).toContain('Playing as Raider · Zero-day');
  });
});

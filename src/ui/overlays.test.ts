// @vitest-environment jsdom
// packages
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// audio
import { AudioView } from '../audio';

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
  let ui: HTMLElement, hud: HTMLElement, app: App, store: Store, audio: AudioView, effects: { reduced: boolean }, unLang = (): void => {};
  const box = (): HTMLElement => ui.querySelector('.ov')!;
  const buttons = (): HTMLButtonElement[] => [...box().querySelectorAll('button')];
  const named = (text: RegExp): HTMLButtonElement => buttons().find((b) => text.test(b.textContent ?? ''))!;
  const press = (key: string): void => { window.dispatchEvent(new KeyboardEvent('keydown', { key })); };
  const boot = (): void => {
    app = new App({ onFrame: null } as unknown as FieldScene, store);
    // As main.ts wires it, but with no context to play on: the switches and the saved prefs are the real ones. The apps of the
    // earlier tests still listen on the window, so each mutes its own view and not whichever the variable holds by then.
    const mine = new AudioView(() => null, store.prefs(), (p) => store.setPrefs(p));
    audio = mine;
    app.onMute = () => mine.toggleMute();
    app.add(new Overlays(ui, app, { effects: effects as EffectsView, audio: mine }));
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

  it('switches the language on the setup in place, keeping the pair picked, and START still starts it', () => {
    boot();
    named(/PLAY CAMPAIGN/).click();
    box().querySelector<HTMLButtonElement>('.kn[data-id="ghost"]')!.click();
    box().querySelector<HTMLButtonElement>('.dl[data-id="zeroday"]')!.click();
    const pair = (): (string | undefined)[] => [box().querySelector<HTMLElement>('.kn.sel')?.dataset.id, box().querySelector<HTMLElement>('.dl.sel')?.dataset.id];
    expect(buttons().slice(-3).map((b) => b.textContent)).toEqual(['START · SPACE', 'BACK · ESC', 'ES']);
    named(/^ES$/).click();
    expect([app.screen, box().className, store.prefs().lang, document.documentElement.lang]).toEqual(['setup', 'ov show ov-setup', 'es', 'es']);
    expect(box().querySelector('h2')?.textContent).toBe('ELIGE A TU CABALLERO');
    expect(pair()).toEqual(['ghost', 'zeroday']);
    expect(box().querySelector('.foot .note')?.textContent).toBe('Fantasma · Día cero · ×2');
    // A mouse player's START keeps the focus, so Space still starts the run.
    expect(document.activeElement).toBe(named(/^EMPEZAR/));
    named(/^EN$/).click();
    expect([box().querySelector('h2')?.textContent, store.prefs().lang, ...pair()]).toEqual(['CHOOSE YOUR KNIGHT', 'en', 'ghost', 'zeroday']);
    named(/^START/).click();
    expect(app.run?.state.cfg).toMatchObject({ mode: 'campaign', knight: 'ghost', difficulty: 'zeroday' });
  });

  it('keeps a keyboard player on the language button when it switches the setup, and the title\'s pair after Esc', () => {
    boot();
    named(/PLAY CAMPAIGN/).click();
    box().querySelector<HTMLButtonElement>('.kn[data-id="raider"]')!.click();
    named(/^ES$/).focus();
    named(/^ES$/).click();
    expect(document.activeElement).toBe(named(/^EN$/));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(box().textContent).toContain('Jugando como Asaltante · Analista');
  });

  describe('Enter on the setup', () => {
    // What a browser does with an Enter keydown nobody cancelled: it clicks the button that has the focus (jsdom does not).
    const enter = (target: HTMLElement): KeyboardEvent => {
      const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      target.dispatchEvent(ev);
      if (!ev.defaultPrevented) target.click();
      return ev;
    };
    const open = () => {
      boot();
      const start = vi.spyOn(app, 'startRun');
      named(/PLAY CAMPAIGN/).click();
      box().querySelector<HTMLButtonElement>('.kn[data-id="forge"]')!.click();
      box().querySelector<HTMLButtonElement>('.dl[data-id="incident"]')!.click();
      return start;
    };

    it('starts one run on the pair marked when START has the focus: the press is taken, so the button\'s own click starts no second', () => {
      const start = open();
      expect(document.activeElement).toBe(named(/^START/));
      expect(enter(named(/^START/)).defaultPrevented).toBe(true);
      expect(start).toHaveBeenCalledTimes(1);
      expect(app.run?.state.cfg).toMatchObject({ mode: 'campaign', knight: 'forge', difficulty: 'incident' });
      expect(store.prefs()).toMatchObject({ knight: 'forge', difficulty: 'incident' });
      expect([app.screen, box().className]).toEqual(['playing', 'ov']);
    });

    it('starts one run on the pair marked, not on the card focused, when a knight card has the focus, and does not pick that card', () => {
      const start = open();
      const raider = box().querySelector<HTMLButtonElement>('.kn[data-id="raider"]')!;
      raider.focus();
      expect(enter(raider).defaultPrevented).toBe(true);
      expect(start).toHaveBeenCalledTimes(1);
      expect(app.run?.state.cfg).toMatchObject({ knight: 'forge', difficulty: 'incident' });
      expect(store.prefs().knight).toBe('forge');
    });

    // Enter is the key to go on wherever the focus is, and Space is the focused button's own: the setup's other buttons are pressed with Space.
    for (const [name, find] of [
      ['a difficulty row', (): HTMLElement => box().querySelector<HTMLElement>('.dl[data-id="intern"]')!],
      ['BACK', (): HTMLElement => named(/^BACK/)],
      ['the language button', (): HTMLElement => named(/^ES$/)],
    ] as const) {
      it(`starts one run on the pair marked when ${name} has the focus, and does not press it`, () => {
        const start = open();
        const target = find();
        target.focus();
        expect(enter(target).defaultPrevented).toBe(true);
        expect(start).toHaveBeenCalledTimes(1);
        expect([app.screen, app.run?.state.cfg.knight, app.run?.state.cfg.difficulty, store.prefs().lang]).toEqual(['playing', 'forge', 'incident', undefined]);
      });
    }

    it('does nothing for the Enter that opens the setup from the title, and for a held Enter', () => {
      boot();
      const start = vi.spyOn(app, 'startRun');
      const play = named(/PLAY CAMPAIGN/);
      play.focus();
      // The title's own Enter is no start: it clicks PLAY, which opens the setup (a keydown reaching the new screen does not start it).
      expect(enter(play).defaultPrevented).toBe(false);
      expect([app.screen, start.mock.calls.length]).toEqual(['setup', 0]);
      // Its auto-repeat arrives on the setup now, with START under the focus: held, not pressed.
      const held = new KeyboardEvent('keydown', { key: 'Enter', repeat: true, bubbles: true, cancelable: true });
      named(/^START/).dispatchEvent(held);
      expect([held.defaultPrevented, app.screen, start.mock.calls.length]).toEqual([true, 'setup', 0]);
    });
  });

  it('falls back to the Black Knight when the saved knight is not one of the six: the title says so and the setup marks him', () => {
    // A hand-edited or corrupted save: the knight it names does not exist.
    const prefs = { knight: 'bogus' };
    store = createStore({ getItem: () => JSON.stringify({ version: 2, bests: { campaign: {}, overtime: {}, won: false }, prefs }), setItem: () => undefined } as unknown as Storage);
    boot();
    expect(box().textContent).toContain('Playing as The Black Knight · Analyst');
    named(/PLAY CAMPAIGN/).click();
    expect(box().querySelector<HTMLElement>('.kn.sel')?.dataset.id).toBe('black');
    expect(box().querySelectorAll('.kn.sel')).toHaveLength(1);
    expect(box().querySelector('.foot .note')?.textContent).toBe('The Black Knight · Analyst · ×1');
    named(/^START/).click();
    expect(app.run?.state.cfg).toMatchObject({ knight: 'black', difficulty: 'analyst' });
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

  it('switches sound and music and steps the volume from the pause menu, saving each, and a keyboard player keeps the button', () => {
    boot();
    app.startRun('campaign');
    app.act('pause');
    // Their own row, after the five that were there before.
    expect([...box().querySelectorAll('.row-btns')].map((r) => [...r.querySelectorAll('button')].map((b) => b.textContent))).toEqual([
      ['RESUME', 'QUIT TO TITLE', 'ARMORY · T', 'ES', 'REDUCED EFFECTS · OFF'], ['SOUND · ON', 'MUSIC · ON', 'VOLUME · 2/3'],
    ]);
    named(/^SOUND/).focus();
    named(/^SOUND/).click();
    expect([audio.settings.sound, store.prefs().sound, named(/^SOUND/).textContent]).toEqual([false, false, 'SOUND · OFF']);
    expect(document.activeElement).toBe(named(/^SOUND/));
    named(/^MUSIC/).focus();
    named(/^MUSIC/).click();
    expect([audio.settings.music, store.prefs().music, named(/^MUSIC/).textContent]).toEqual([false, false, 'MUSIC · OFF']);
    expect(document.activeElement).toBe(named(/^MUSIC/));
    named(/^SOUND/).click();
    expect([audio.settings.sound, store.prefs().sound]).toEqual([true, true]);
    // Three steps, 1 to 3 and round again, never 0.
    const volumes: string[] = [];
    for (let i = 0; i < 6; i++) { named(/^VOLUME/).click(); volumes.push(named(/^VOLUME/).textContent!); }
    expect(volumes).toEqual(['VOLUME · 3/3', 'VOLUME · 1/3', 'VOLUME · 2/3', 'VOLUME · 3/3', 'VOLUME · 1/3', 'VOLUME · 2/3']);
    expect([audio.settings.volume, store.prefs().volume]).toEqual([2, 2]);
    // The pause is still the pause.
    expect(app.screen).toBe('paused');
  });

  it('refreshes the other views when a sound switch moves, so the HUD badge follows', () => {
    boot();
    const refreshed = vi.fn();
    app.add({ refresh: refreshed });
    app.startRun('campaign');
    app.act('pause');
    for (const label of [/^SOUND/, /^MUSIC/, /^VOLUME/]) {
      refreshed.mockClear();
      named(label).click();
      expect(refreshed, String(label)).toHaveBeenCalled();
    }
  });

  it('says the sound switches in Spanish, SÍ and NO', () => {
    boot();
    app.startRun('campaign');
    app.act('pause');
    named(/^ES$/).click();
    expect(buttons().map((b) => b.textContent).slice(-3)).toEqual(['SONIDO · SÍ', 'MÚSICA · SÍ', 'VOLUMEN · 2/3']);
    named(/^SONIDO/).click();
    named(/^MÚSICA/).click();
    expect(buttons().map((b) => b.textContent).slice(-3)).toEqual(['SONIDO · NO', 'MÚSICA · NO', 'VOLUMEN · 2/3']);
  });

  it('follows M while the pause menu is open', () => {
    boot();
    app.startRun('campaign');
    app.act('pause');
    press('m');
    expect(buttons().map((b) => b.textContent).slice(-3)).toEqual(['SOUND · OFF', 'MUSIC · OFF', 'VOLUME · 2/3']);
    expect([store.prefs().sound, store.prefs().music]).toEqual([false, false]);
    press('M');
    expect(buttons().map((b) => b.textContent).slice(-3)).toEqual(['SOUND · ON', 'MUSIC · ON', 'VOLUME · 2/3']);
    expect(app.screen).toBe('paused');
  });

  it('starts the pause menu on what the last session saved', () => {
    store.setPrefs({ sound: false, music: true, volume: 3 });
    boot();
    app.startRun('campaign');
    app.act('pause');
    expect(buttons().map((b) => b.textContent).slice(-3)).toEqual(['SOUND · OFF', 'MUSIC · ON', 'VOLUME · 3/3']);
  });

  it('starts the pause menu on VOLUME 2 when the save has a volume of 0, which cannot be chosen', () => {
    const prefs = { sound: false, music: true, volume: 0 };
    store = createStore({ getItem: () => JSON.stringify({ version: 2, bests: { campaign: {}, overtime: {}, won: false }, prefs }), setItem: () => undefined } as unknown as Storage);
    boot();
    app.startRun('campaign');
    app.act('pause');
    expect(buttons().map((b) => b.textContent).slice(-3)).toEqual(['SOUND · OFF', 'MUSIC · ON', 'VOLUME · 2/3']);
    // From there the first step is 3.
    named(/^VOLUME/).click();
    expect(named(/^VOLUME/).textContent).toBe('VOLUME · 3/3');
  });

  it('opens the Armory from the title and closes it back onto the title, with CLOSE, T or Esc', () => {
    boot();
    expect([...box().querySelectorAll('.row-btns .btn')].map((b) => b.textContent)).toEqual(['PLAY CAMPAIGN', 'OVERTIME', 'HOW TO PLAY', 'ARMORY', 'ES']);
    named(/^ARMORY$/).click();
    expect([app.screen, box().className]).toEqual(['armory', 'ov show ov-armory']);
    // No run yet: the loadout a run starts with, and no credits.
    expect([box().querySelector('.ar-head .n')?.textContent, box().querySelector('.ar-head .cr')?.textContent]).toEqual(['1 of 14 owned', 'CREDITS 0']);
    expect(box().querySelector('.cx[data-id="lockdown"] .st')?.textContent).toBe('OWNED · START');
    expect(document.activeElement).toBe(named(/^CLOSE · T$/));
    expect(hud.hasAttribute('inert')).toBe(true);
    named(/^CLOSE/).click();
    expect([app.screen, box().className]).toEqual(['title', 'ov show ov-title']);
    press('t');
    expect(box().className).toBe('ov show ov-armory');
    press('t');
    expect(box().className).toBe('ov show ov-title');
    press('T');
    press('Escape');
    expect([app.screen, box().className]).toEqual(['title', 'ov show ov-title']);
  });

  it('mutes from the Armory with M and leaves it as the player had it, the card under the mouse still in the detail', () => {
    boot();
    app.act('armory');
    const cards = (): HTMLElement[] => [...box().querySelectorAll<HTMLElement>('.cx')];
    const detail = (): string | null | undefined => box().querySelector('.ar-detail h6')?.textContent;
    cards()[3].dispatchEvent(new MouseEvent('mouseenter'));
    const hovered = detail();
    expect(hovered).not.toBe(cards()[0].querySelector('.nm')?.textContent);
    press('m');
    expect([audio.settings.sound, audio.settings.music, app.screen, detail(), cards()[3].classList.contains('sel')]).toEqual([false, false, 'armory', hovered, true]);
  });

  it('walks the Armory with the arrow keys, the detail following, and T, M and Esc go on working from wherever the focus is', () => {
    boot();
    app.startRun('campaign');
    press('t');
    const arrow = (key: string): void => { document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); };
    const now = (): [string | undefined, string | null | undefined] => [(document.activeElement as HTMLElement).dataset.id, box().querySelector('.ar-detail h6')?.textContent];
    // CLOSE has the focus on opening; an arrow goes in at the first card, then on across and down.
    arrow('ArrowDown');
    expect(now()).toEqual(['destrier', 'Destrier I']);
    arrow('ArrowRight');
    arrow('ArrowDown');
    expect(now()).toEqual(['quote', 'Quote filter']);
    expect(app.screen).toBe('armory');
    // The App's keys are the same from a card as from CLOSE.
    press('m');
    expect([audio.settings.sound, audio.settings.music, app.screen]).toEqual([false, false, 'armory']);
    press('Escape');
    expect([app.screen, box().className]).toEqual(['playing', 'ov']);
    // And the arrows are the field's again: the knight changes lane (and does so once).
    const lane = app.run!.state.knight.lane;
    press('ArrowUp');
    expect(app.run!.state.knight.lane).toBe(lane - 1);
  });

  it('opens the Armory from the pause menu on the run in hand, and closes it back onto the pause', () => {
    boot();
    app.startRun('campaign');
    Object.assign(app.run!.state, { credits: 820, owned: ['lockdown', 'destrier', 'obs1', 'obs2'] });
    app.act('pause');
    expect([...box().querySelectorAll('.row-btns .btn')].map((b) => b.textContent)).toEqual(['RESUME', 'QUIT TO TITLE', 'ARMORY · T', 'ES', 'REDUCED EFFECTS · OFF', 'SOUND · ON', 'MUSIC · ON', 'VOLUME · 2/3']);
    named(/^ARMORY · T$/).click();
    expect([app.screen, box().className]).toEqual(['armory', 'ov show ov-armory']);
    expect([box().querySelector('.ar-head .n')?.textContent, box().querySelector('.ar-head .cr')?.textContent]).toEqual(['3 of 14 owned', 'CREDITS 820']);
    expect([box().querySelector('.cx[data-id="obs1"] .st')?.textContent, box().querySelector('.cx[data-id="destrier"] .st')?.textContent]).toEqual(['OWNED · LEVEL 2 OF 3', 'OWNED · LEVEL 1 OF 3']);
    named(/^CLOSE/).click();
    expect([app.screen, box().className]).toEqual(['paused', 'ov show ov-pause']);
    // The pause is still the pause: RESUME goes on with the run.
    named(/RESUME/).click();
    expect(app.screen).toBe('playing');
  });

  it('opens the Armory over the field with T during play, and T or Esc goes back to play with nothing left focused', () => {
    boot();
    app.startRun('campaign');
    app.run!.state.credits = 820;
    press('t');
    expect([app.screen, box().className]).toEqual(['armory', 'ov show ov-armory']);
    expect(box().querySelector('.ar-head .cr')?.textContent).toBe('CREDITS 820');
    press('T');
    expect([app.screen, box().className]).toEqual(['playing', 'ov']);
    expect(document.activeElement).toBe(document.body);
    expect(hud.hasAttribute('inert')).toBe(false);
    press('t');
    press('Escape');
    expect([app.screen, box().className]).toEqual(['playing', 'ov']);
  });

  it('hints at the Armory on the draft, opens it over the draft and lands back on it with no card under Space', () => {
    boot();
    app.startRun('campaign');
    app.dispatch(app.run!.cheat('skip'));
    expect(box().className).toBe('ov show ov-draft');
    expect([...box().querySelectorAll('p.note')].map((p) => p.textContent)).toEqual(['Clean wave', 'T · see every upgrade in the Armory']);
    press('t');
    expect([app.screen, box().className]).toEqual(['armory', 'ov show ov-armory']);
    // The Armory shows and does not sell: nothing on the draft moved.
    expect(app.run!.state.draft!.taken).toEqual([]);
    press('t');
    expect([app.screen, box().className]).toEqual(['draft', 'ov show ov-draft']);
    expect(document.activeElement).toBe(document.body);
    expect(app.run!.state.draft!.taken).toEqual([]);
    expect(app.run!.state.draft!.free).toBe(true);
  });

  it('puts a keyboard player back on the button they left when the Armory closes, not on the first one', () => {
    boot();
    // Tabbed onto ARMORY, then Enter: CLOSE takes the focus, and closing hands it back to ARMORY.
    named(/^ARMORY$/).focus();
    named(/^ARMORY$/).click();
    expect(document.activeElement).toBe(named(/^CLOSE/));
    named(/^CLOSE/).click();
    expect(box().className).toBe('ov show ov-title');
    expect(document.activeElement).toBe(named(/^ARMORY$/));
  });

  it('lands the pause\'s keyboard player on the button they were on, so REDUCED EFFECTS does not turn into RESUME', () => {
    boot();
    app.startRun('campaign');
    app.act('pause');
    named(/REDUCED EFFECTS/).focus();
    press('t');
    expect(app.screen).toBe('armory');
    press('t');
    expect([app.screen, box().className]).toEqual(['paused', 'ov show ov-pause']);
    expect(document.activeElement).toBe(named(/REDUCED EFFECTS/));
    // Esc closes it onto the same button.
    named(/^ES$/).focus();
    press('t');
    press('Escape');
    expect([app.screen, document.activeElement]).toEqual(['paused', named(/^ES$/)]);
  });

  it('lands the draft\'s keyboard player on the card they were on, so the next Space does not spend the free pick on another', () => {
    boot();
    app.startRun('campaign');
    app.dispatch(app.run!.cheat('skip'));
    const cards = (): HTMLButtonElement[] => [...box().querySelectorAll<HTMLButtonElement>('.ucard .btn')];
    cards()[2].focus();
    press('t');
    expect(app.screen).toBe('armory');
    press('t');
    expect([app.screen, box().className]).toEqual(['draft', 'ov show ov-draft']);
    expect(document.activeElement).toBe(cards()[2]);
    expect(app.run!.state.draft!.taken).toEqual([]);
    // What Space or Enter does next is the card the player chose.
    const [, , third] = app.run!.state.draft!.picks;
    (document.activeElement as HTMLButtonElement).click();
    expect(app.run!.state.draft!.taken).toEqual([third.id]);
  });

  it('puts the how-to back when the Armory opened over it closes, on T, Esc or CLOSE, and the how-to goes on to the title as before', () => {
    boot();
    named(/HOW TO PLAY/).click();
    // The how-to is a view of the title: the App's screen stays 'title', so T opens the Armory there.
    expect([app.screen, box().className]).toEqual(['title', 'ov show ov-howto']);
    press('t');
    expect([app.screen, box().className]).toEqual(['armory', 'ov show ov-armory']);
    press('t');
    expect([app.screen, box().className]).toEqual(['title', 'ov show ov-howto']);
    // One Esc closes the Armory and no more: it must not also be read as the how-to's own Esc once the how-to is back.
    press('T');
    press('Escape');
    expect([app.screen, box().className]).toEqual(['title', 'ov show ov-howto']);
    press('t');
    named(/^CLOSE/).click();
    expect([app.screen, box().className]).toEqual(['title', 'ov show ov-howto']);
    // A keyboard player keeps BACK.
    named(/BACK/).focus();
    press('t');
    press('t');
    expect(document.activeElement).toBe(named(/BACK/));
    // The how-to is itself again: its Esc and BACK go back to the title.
    press('Escape');
    expect(box().className).toBe('ov show ov-title');
    named(/HOW TO PLAY/).click();
    press('t');
    press('t');
    named(/BACK/).click();
    expect(box().className).toBe('ov show ov-title');
    // And an Armory opened from the title itself closes onto the title, not onto a how-to seen earlier.
    press('t');
    press('t');
    expect(box().className).toBe('ov show ov-title');
  });

  it('leaves a player who never focused a button with none when the Armory closes: CLOSE is not a keyboard tell', () => {
    boot();
    // A click never focuses a button (dom.ts), so nothing here was a keyboard press; the draft in particular must not
    // come back with a card under Space.
    named(/^ARMORY$/).click();
    expect(document.activeElement).toBe(named(/^CLOSE/));
    named(/^CLOSE/).click();
    expect(document.activeElement).toBe(document.body);
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
    expect(box().classList.contains('ov-debrief')).toBe(true);
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
    expect(box().classList.contains('ov-debrief')).toBe(true);
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

  describe('the draft\'s entrance', () => {
    const draft = (): void => {
      boot();
      app.startRun('campaign');
      app.run!.state.credits = 5000;
      app.dispatch(app.run!.cheat('skip'));
    };
    const row = (): HTMLElement => box().querySelector<HTMLElement>('.cards')!;
    const place = (): string[] => [...box().querySelectorAll<HTMLElement>('.ucard')].map((c) => c.style.getPropertyValue('--i'));

    it('flips a hand in when it is dealt, one card after another, and not again on the redraws a pick, a refresh or the Armory cause', () => {
      draft();
      // Each card carries its place in the hand for the stagger.
      expect([row().className, place()]).toEqual(['cards deal', ['0', '1', '2']]);
      // A pick redraws the same hand in place: the cards stay still (the taken one dimmed), they do not flip in again.
      box().querySelector<HTMLButtonElement>('.ucard .btn')!.click();
      expect([row().className, place()]).toEqual(['cards', ['0', '1', '2']]);
      app.refresh();
      expect(row().className).toBe('cards');
      setLang('es');
      expect(row().className).toBe('cards');
      setLang('en');
      press('t');
      press('t');
      expect([app.screen, row().className]).toEqual(['draft', 'cards']);
      // A reroll deals a new hand, and so does the next wave's draft.
      named(/REROLL/).click();
      expect([row().className, place()]).toEqual(['cards deal', ['0', '1', '2']]);
      named(/NEXT WAVE/).click();
      app.dispatch(app.run!.cheat('skip'));
      expect(row().className).toBe('cards deal');
    });

    describe('and the bought card\'s flight to its tile', () => {
      type Flight = { keyframes: { transform: string }[]; options: { duration: number; easing: string }; onfinish: (() => void) | null };
      let flights: Flight[];
      // jsdom has no layout and no Web Animations: the layer at half size (so its pixels are twice the screen's), every card's icon in
      // the same spot, and a column of tiles whose last one is where the new tile lands.
      const stage = (): void => {
        const rect = (left: number, top: number, width: number, height: number): DOMRect => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top }) as DOMRect;
        vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
          if (this === ui) return rect(0, 0, 640, 360);
          if (this.matches('.ucard img.px')) return rect(200, 300, 80, 60);
          if (this.matches('.loadout .ltile:last-child')) return rect(538, 160, 22, 19);
          return rect(0, 0, 0, 0);
        });
      };
      const column = (tiles: number): void => {
        const col = document.createElement('div');
        col.className = 'loadout';
        for (let i = 0; i < tiles; i++) {
          const tile = Object.assign(document.createElement('div'), { className: 'ltile KNIGHT', title: `Tile ${i}` });
          tile.innerHTML = '<img class="px" src="data:image/png;tile" alt="Tile">';
          col.appendChild(tile);
        }
        ui.appendChild(col);
      };
      const take = (card: number): void => { box().querySelectorAll<HTMLButtonElement>('.ucard .btn')[card].click(); };
      // The first card on the panel still to be taken that is not the backup (which has no tile to fly to): a hand is dealt at random, and
      // only the first draft's first two cards are fixed.
      const tiled = (): number => { const d = app.run!.state.draft!; return d.picks.findIndex((c) => c.id !== 'backup' && !d.taken.includes(c.id)); };
      beforeEach(() => {
        flights = [];
        Object.defineProperty(HTMLElement.prototype, 'animate', {
          configurable: true, writable: true,
          value(keyframes: Flight['keyframes'], options: Flight['options']) { const f = { keyframes, options, onfinish: null }; flights.push(f); return f; },
        });
      });
      afterEach(() => { delete (HTMLElement.prototype as unknown as { animate?: unknown }).animate; });

      it('copies the icon to the column\'s new tile in the layer\'s own pixels, and drops the copy when it lands', () => {
        draft();
        stage();
        column(2);
        const first = tiled(), original = box().querySelectorAll<HTMLImageElement>('.ucard img.px')[first], src = original.src;
        take(first);
        expect(flights).toHaveLength(1);
        // Centre to centre: (549 - 240) / .5 across, (169.5 - 330) / .5 up; 300 ms, shrinking to 60%.
        expect(flights[0].keyframes).toEqual([{ transform: 'translate(0,0)' }, { transform: 'translate(618px, -321px) scale(.6)' }]);
        expect(flights[0].options).toEqual({ duration: 300, easing: 'ease-in' });
        const copy = ui.querySelector<HTMLImageElement>(':scope > img.fly')!;
        expect([copy.src, copy.className, copy.style.left, copy.style.top, copy.style.width, copy.style.height]).toEqual([src, 'px fly', '400px', '600px', '160px', '120px']);
        // A copy: the redraw took the card's own icon out of the page, and the copy is the only thing flying.
        expect([copy === original, original.isConnected, ui.querySelectorAll('.fly').length]).toEqual([false, false, 1]);
        flights[0].onfinish!();
        expect(ui.querySelector('.fly')).toBeNull();
        // It lands as the tile's twin at the tile's own place (the real column is under the backdrop), pulsing once; the real tile is as it was.
        const twin = ui.querySelector<HTMLElement>(':scope > .ltile-ghost')!;
        expect([twin.className, twin.title, twin.getAttribute('aria-hidden'), twin.style.left, twin.style.top, twin.style.width, twin.style.height])
          .toEqual(['ltile KNIGHT ltile-ghost flash', '', 'true', '1076px', '320px', '44px', '38px']);
        expect([twin.querySelector('img.px')?.getAttribute('src'), ui.querySelectorAll('.loadout .flash').length, ui.querySelectorAll('.ltile-ghost').length]).toEqual(['data:image/png;tile', 0, 1]);
        // Gone when its pulse ends.
        twin.dispatchEvent(new Event('animationend'));
        expect(ui.querySelector('.ltile-ghost')).toBeNull();
        // A bought card flies too, and a reroll's new hand has its own cards to fly.
        named(/REROLL/).click();
        take(tiled());
        expect(flights).toHaveLength(2);
        expect(ui.querySelectorAll('.fly')).toHaveLength(1);
      });

      it('flies nothing under reduced effects, with no column to land in, for the backup, or for a pick the core refuses', () => {
        draft();
        stage();
        // No column on the screen yet: the free pick has nowhere to land.
        take(tiled());
        expect([flights.length, ui.querySelector('.fly')]).toEqual([0, null]);
        column(1);
        effects.reduced = true;
        take(tiled());
        expect([flights.length, ui.querySelector('.fly'), ui.querySelector('.ltile-ghost')]).toEqual([0, null, null]);
        effects.reduced = false;
        // The backup heals the rack and has no tile: the card still on the panel is swapped for it.
        const spare = app.run!.state.draft!.picks.findIndex((c) => !app.run!.state.draft!.taken.includes(c.id));
        app.run!.state.draft!.picks[spare] = cardById('backup');
        app.refresh();
        take(spare);
        expect([app.run!.state.draft!.taken.length, flights.length]).toEqual([3, 0]);
        // A card still on the panel whose price the credits no longer cover: the core refuses it, so no flight.
        named(/REROLL/).click();
        app.run!.state.credits = 0;
        take(0);
        expect([app.run!.state.draft!.taken.length, flights.length]).toEqual([3, 0]);
        // With the credits back the same click is a pick, and it flies.
        app.run!.state.credits = 5000;
        take(tiled());
        expect([app.run!.state.draft!.taken.length, flights.length]).toEqual([4, 1]);
      });

      it('takes the flight with the screen: a copy still flying is dropped and lands nothing, and a twin goes when the draft is covered', () => {
        draft();
        stage();
        column(1);
        take(tiled());
        expect(ui.querySelectorAll('.fly')).toHaveLength(1);
        // The wave starts under the copy: it goes, and a landing reported late leaves nothing behind.
        named(/NEXT WAVE/).click();
        expect([app.screen, ui.querySelectorAll('.fly').length]).toEqual(['playing', 0]);
        flights[0].onfinish!();
        expect(ui.querySelector('.ltile-ghost')).toBeNull();
        // And a twin already on the screen goes with it when the Armory opens over the draft.
        app.dispatch(app.run!.cheat('skip'));
        take(tiled());
        flights[1].onfinish!();
        expect(ui.querySelectorAll('.ltile-ghost')).toHaveLength(1);
        press('t');
        expect([app.screen, ui.querySelectorAll('.ltile-ghost').length, ui.querySelectorAll('.fly').length]).toEqual(['armory', 0, 0]);
      });
    });
  });

  describe('the debrief\'s entrance', () => {
    const finish = (score: number): void => {
      app.startRun('campaign');
      app.run!.state.score = score;
      app.dispatch([{ type: 'runEnded', reason: 'serverDown' }]);
      vi.advanceTimersByTime(1200);
    };
    const grade = (): HTMLElement => box().querySelector<HTMLElement>('.grade')!;
    const score = (): string | null | undefined => box().querySelector('.best b')?.textContent;
    const thud = (): boolean => box().classList.contains('shake');

    it('stamps the grade and counts the score up from 0, once: a refresh draws the finished screen', () => {
      boot();
      finish(5030);
      expect(thud()).toBe(true);
      expect([grade().className, grade().dataset.g, score()]).toEqual(['grade stamp', 'F', 'SCORE 0']);
      vi.advanceTimersByTime(400);
      const mid = Number(box().querySelector('.best .num')!.textContent!.replace(/,/g, ''));
      expect(mid).toBeGreaterThan(0);
      expect(mid).toBeLessThan(5030);
      vi.advanceTimersByTime(500);
      expect(score()).toBe('SCORE 5,030');
      // The thud ends with the box's own animation, not with the stamp's, which bubbles up to it.
      grade().dispatchEvent(new Event('animationend', { bubbles: true }));
      expect(thud()).toBe(true);
      box().dispatchEvent(new Event('animationend'));
      expect(thud()).toBe(false);
      // The same run drawn again (a refresh, M, a language switch): final numbers, no stamp, no thud.
      app.refresh();
      expect([grade().className, score(), thud()]).toEqual(['grade', 'SCORE 5,030', false]);
      press('m');
      setLang('es');
      expect([grade().className, score(), thud()]).toEqual(['grade', 'PUNTAJE 5.030', false]);
    });

    it('is not replayed by a refresh while it is still running, and the count carries on to the final figure', () => {
      boot();
      finish(8800);
      vi.advanceTimersByTime(200);
      app.refresh();
      // The redraw shows the finished screen at once; the count that was running is left behind and does not touch it.
      expect([grade().className, score()]).toEqual(['grade', 'SCORE 8,800']);
      vi.advanceTimersByTime(1000);
      expect(score()).toBe('SCORE 8,800');
    });

    it('shows the finished screen at once under reduced effects', () => {
      boot();
      effects.reduced = true;
      finish(5030);
      expect([grade().className, score(), thud()]).toEqual(['grade', 'SCORE 5,030', false]);
      vi.advanceTimersByTime(1000);
      expect(score()).toBe('SCORE 5,030');
    });

    it('plays again for the next run, and an Overtime wave number carries no grade', () => {
      boot();
      finish(100);
      named(/PLAY AGAIN/).click();
      app.dispatch([{ type: 'runEnded', reason: 'serverDown' }]);
      vi.advanceTimersByTime(1200);
      expect(grade().className).toBe('grade stamp');
      app.quit();
      app.startRun('overtime');
      app.dispatch([{ type: 'runEnded', reason: 'serverDown' }]);
      vi.advanceTimersByTime(1200);
      expect([grade().className, grade().dataset.g, grade().textContent]).toEqual(['grade stamp', undefined, '1']);
    });

    it('colours the grade by its letter and the stats like the HUD and the log, and keeps the score\'s box as wide as its final figure', () => {
      boot();
      app.startRun('campaign');
      const s = app.run!.state;
      s.endReason = 'won';
      s.score = 5030;
      Object.assign(s.stats, { served: 12, neutralized: 3 });
      app.dispatch([{ type: 'runEnded', reason: 'won' }]);
      vi.advanceTimersByTime(1200);
      expect([grade().textContent, grade().dataset.g]).toEqual(['S', 'S']);
      const tone = (label: string): string | undefined =>
        [...box().querySelectorAll('.statlist > div:not(.fams)')].find((d) => d.firstChild?.textContent === label)?.querySelector('b')?.className;
      expect(['Users served', 'Neutralized at the server', 'Breaches', 'False positives'].map(tone)).toEqual(['ok', 'ok', 'bad', '']);
      expect(box().querySelector<HTMLElement>('.best .num')!.style.minWidth).toBe('5ch');
    });
  });
});

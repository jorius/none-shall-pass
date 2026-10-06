// @vitest-environment jsdom
// packages
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// game
import type { FieldScene } from '../game/FieldScene';

// i18n
import { setLang } from '../i18n';

// local
import { App } from '../app';
import { createStore } from '../storage';
import { ConsoleView } from './consoleView';

describe('ConsoleView', () => {
  let ui: HTMLElement, app: App;
  const term = (): HTMLElement => ui.querySelector('.term')!;
  const input = (): HTMLInputElement => ui.querySelector('.term input')!;
  const out = (): string => ui.querySelector('.term pre')!.textContent ?? '';
  const key = (target: EventTarget, k: string, code?: string): KeyboardEvent => {
    const ev = new KeyboardEvent('keydown', { key: k, code, bubbles: true, cancelable: true });
    target.dispatchEvent(ev);
    return ev;
  };
  const open = (): void => { key(document.body, '`'); vi.advanceTimersByTime(0); };
  const type = (cmd: string): void => { input().value = cmd; key(input(), 'Enter'); };

  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
    ui = document.createElement('div');
    document.body.appendChild(ui);
    app = new App({ onFrame: null } as unknown as FieldScene, createStore(null));
    app.add(new ConsoleView(ui, app));
    app.startRun('campaign');
  });
  afterEach(() => { vi.useRealTimers(); setLang('en'); });

  it('opens on the backtick with the prompt focused, and typing there never steers the knight', () => {
    const lane = app.run!.state.knight.lane;
    open();
    expect([app.screen, term().classList.contains('show'), document.activeElement]).toEqual(['console', true, input()]);
    expect(out()).toBe('Type help.\n');
    for (const k of ['h', 'p', 'ArrowUp', ' ', 'Tab']) key(input(), k);
    expect([app.run!.state.hints, app.run!.state.knight.lane, app.screen]).toEqual([false, lane, 'console']);
  });

  it('keeps Tab in the prompt, off the HUD buttons', () => {
    open();
    expect(key(input(), 'Tab').defaultPrevented).toBe(true);
  });

  it('prints what was typed and every reply as text, never as markup', () => {
    open();
    type('<img src=x onerror="window.__pwned=1">');
    expect(ui.querySelector('img')).toBeNull();
    expect(out()).toContain('$ <img src=x onerror="window.__pwned=1">\n<img: command not found. Try help.');
    type('nmap shop.example');
    expect(out()).toMatch(/23\/tcp\s+filtered\s+telnet/);
  });

  it('closes on Esc, the backtick or its dead key, and lets the focus go', () => {
    for (const [k, code] of [['Escape'], ['`'], ['Dead', 'Backquote']]) {
      open();
      key(input(), k, code);
      expect([app.screen, term().classList.contains('show'), document.activeElement === input()], k).toEqual(['playing', false, false]);
    }
    expect(out()).toBe('Type help.\n');
  });

  it('clears, exits and glitches', () => {
    open();
    type('help');
    type('clear');
    expect(out()).toBe('');
    type('sudo rm -rf /');
    expect([out(), ui.classList.contains('glitch-hard')]).toEqual(['$ sudo rm -rf /\nNo.\n', true]);
    vi.advanceTimersByTime(900);
    expect(ui.classList.contains('glitch-hard')).toBe(false);
    type('exit');
    expect(app.screen).toBe('playing');
  });

  it('answers in the language on screen', () => {
    setLang('es');
    open();
    type('help');
    expect(out()).toContain('comandos:');
  });

  it('marks the run on a cheat, closes and moves on: skip opens the draft', () => {
    open();
    type('credits 500');
    expect([app.run!.state.credits, app.run!.state.tampered, app.screen]).toEqual([500, true, 'playing']);
    open();
    type('skip');
    expect(app.screen).toBe('draft');
  });

  it('refuses a cheat once the run is over: its result is already saved', () => {
    app.run!.state.phase = 'ended';
    open();
    type('god');
    expect([app.run!.state.tampered, app.run!.state.god, app.screen]).toEqual([false, false, 'console']);
    expect(out()).toContain('The run is over: nothing left to cheat.');
    expect(out()).not.toContain('TAMPERED');
  });
});

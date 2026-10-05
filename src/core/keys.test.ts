// packages
import { describe, expect, it } from 'vitest';

// core
import { konamiMatcher, KONAMI, routeKey } from './keys';

const k = (key: string, over: { shiftKey?: boolean; inField?: boolean } = {}) => ({ key, shiftKey: false, inField: false, ...over });

describe('routeKey', () => {
  it('maps play keys', () => {
    expect(routeKey(k('ArrowUp'), 'playing')).toBe('laneUp');
    expect(routeKey(k('ArrowDown'), 'playing')).toBe('laneDown');
    expect(routeKey(k('Tab'), 'playing')).toBe('next');
    expect(routeKey(k('Tab', { shiftKey: true }), 'playing')).toBe('prev');
    expect(routeKey(k(' '), 'playing')).toBe('throw');
    expect(routeKey(k('Escape'), 'playing')).toBe('release');
    expect(routeKey(k('H'), 'playing')).toBe('hints');
    expect(routeKey(k('p'), 'playing')).toBe('pause');
    expect(routeKey(k('`'), 'playing')).toBe('console');
  });

  it('keeps the game deaf while the console is open or an input has focus', () => {
    for (const key of ['h', 'p', ' ', 'ArrowUp', 'Tab', 'a']) expect(routeKey(k(key), 'console')).toBeNull();
    expect(routeKey(k('Escape'), 'console')).toBe('closeConsole');
    expect(routeKey(k('`'), 'console')).toBe('closeConsole');
    expect(routeKey(k('h', { inField: true }), 'playing')).toBeNull();
    // The console's own input has focus while it is open; Esc and backtick must still close it.
    expect(routeKey(k('Escape', { inField: true }), 'console')).toBe('closeConsole');
    expect(routeKey(k('`', { inField: true }), 'console')).toBe('closeConsole');
    for (const screen of ['playing', 'paused'] as const) {
      for (const key of ['`', ' ', 'Escape', 'Tab', 'p']) expect(routeKey(k(key, { inField: true }), screen), `${screen} ${key}`).toBeNull();
    }
  });

  it('only unpauses while paused and ignores play keys elsewhere', () => {
    expect(routeKey(k('p'), 'paused')).toBe('pause');
    expect(routeKey(k('Escape'), 'paused')).toBe('pause');
    expect(routeKey(k(' '), 'paused')).toBeNull();
    expect(routeKey(k('`'), 'paused')).toBe('console');
    expect(routeKey(k(' '), 'draft')).toBeNull();
    expect(routeKey(k('`'), 'title')).toBeNull();
  });
});

describe('konamiMatcher', () => {
  it('fires on the full code, tolerating extra ups and capital letters', () => {
    const m = konamiMatcher();
    const seq = ['ArrowUp', ...KONAMI.slice(0, 8), 'B', 'A'];
    const fired = seq.map((key) => m(key));
    expect(fired.at(-1)).toBe(true);
    expect(fired.slice(0, -1).every((f) => !f)).toBe(true);
  });
  it('does not fire on a broken code', () => {
    const m = konamiMatcher();
    expect(['ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'].some((key) => m(key))).toBe(false);
  });
});

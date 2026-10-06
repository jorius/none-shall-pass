// packages
import { describe, expect, expectTypeOf, it } from 'vitest';

// core
import { konamiMatcher, KONAMI, routeKey, type Screen } from './keys';

type KeyOver = Partial<{ code: string; shiftKey: boolean; ctrlKey: boolean; metaKey: boolean; repeat: boolean; inField: boolean }>;
const k = (key: string, over: KeyOver = {}) => ({ key, shiftKey: false, inField: false, ...over });

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
    expect(routeKey(k('c'), 'playing')).toBe('charge');
    expect(routeKey(k('C'), 'playing')).toBe('charge');
    expect(routeKey(k('`'), 'playing')).toBe('console');
  });

  it('keeps the game deaf while the console is open or an input has focus', () => {
    for (const key of ['h', 'p', 'c', ' ', 'ArrowUp', 'Tab', 'a']) expect(routeKey(k(key), 'console')).toBeNull();
    expect(routeKey(k('Escape'), 'console')).toBe('closeConsole');
    expect(routeKey(k('`'), 'console')).toBe('closeConsole');
    expect(routeKey(k('h', { inField: true }), 'playing')).toBeNull();
    // The console's own input has focus while it is open; Esc and backtick must still close it.
    expect(routeKey(k('Escape', { inField: true }), 'console')).toBe('closeConsole');
    expect(routeKey(k('`', { inField: true }), 'console')).toBe('closeConsole');
    for (const screen of ['playing', 'paused'] as const) {
      for (const key of ['`', ' ', 'Escape', 'Tab', 'p', 'c']) expect(routeKey(k(key, { inField: true }), screen), `${screen} ${key}`).toBeNull();
    }
  });

  it('only unpauses while paused and ignores play keys elsewhere', () => {
    expect(routeKey(k('p'), 'paused')).toBe('pause');
    expect(routeKey(k('Escape'), 'paused')).toBe('pause');
    expect(routeKey(k(' '), 'paused')).toBeNull();
    expect(routeKey(k('`'), 'paused')).toBe('console');
    expect(routeKey(k(' '), 'draft')).toBeNull();
    expect(routeKey(k('`'), 'title')).toBeNull();
    for (const screen of ['paused', 'draft', 'title', 'debrief'] as const) expect(routeKey(k('c'), screen), screen).toBeNull();
  });

  it('goes on from the recap with Space or Enter, once per press, and nowhere else', () => {
    expect(routeKey(k(' '), 'recap')).toBe('continue');
    expect(routeKey(k('Enter'), 'recap')).toBe('continue');
    for (const key of ['Tab', 'Escape', 'p', 'c', 'h', '`', 'ArrowUp']) expect(routeKey(k(key), 'recap'), key).toBeNull();
    expect(routeKey(k(' ', { repeat: true }), 'recap')).toBeNull();
    expect(routeKey(k('Enter', { inField: true }), 'recap')).toBeNull();
    for (const screen of ['playing', 'paused', 'draft', 'title', 'debrief', 'console'] as const) expect(routeKey(k('Enter'), screen), screen).not.toBe('continue');
  });

  it('leaves the setup with Esc and starts it with Enter, once per press, and takes no other key there', () => {
    expect(routeKey(k('Escape'), 'setup')).toBe('back');
    // Enter starts the run whichever button has the focus; Space is left to the focused button (START starts, a card is picked).
    expect(routeKey(k('Enter'), 'setup')).toBe('continue');
    for (const key of [' ', 'Tab', 'p', 'c', 'h', '`', 'ArrowUp']) expect(routeKey(k(key), 'setup'), key).toBeNull();
    for (const key of ['Escape', 'Enter']) {
      expect(routeKey(k(key, { repeat: true }), 'setup'), `${key} held`).toBeNull();
      expect(routeKey(k(key, { inField: true }), 'setup'), `${key} in a field`).toBeNull();
      expect(routeKey(k(key, { ctrlKey: true }), 'setup'), `${key} with Ctrl`).toBeNull();
    }
    for (const screen of ['playing', 'paused', 'recap', 'draft', 'title', 'debrief', 'console'] as const) expect(routeKey(k('Escape'), screen), screen).not.toBe('back');
  });

  it('has no screen for the how-to: it is a view of the title, where its keys are the title\'s', () => {
    // Type-level, checked by tsc in the build: a 'howto' screen would let a test cover a case the App never reaches.
    expectTypeOf<'howto'>().not.toExtend<Screen>();
    expect(routeKey(k('t'), 'title')).toBe('armory');
    expect(routeKey(k('m'), 'title')).toBe('mute');
  });

  it('opens the Armory with T from the title, the pause, the draft and play, and closes it with T or Esc', () => {
    for (const screen of ['title', 'paused', 'draft', 'playing'] as const) {
      expect(routeKey(k('t'), screen), screen).toBe('armory');
      expect(routeKey(k('T'), screen), screen).toBe('armory');
    }
    for (const key of ['t', 'T', 'Escape']) expect(routeKey(k(key), 'armory'), key).toBe('armory');
    // The rest of the keyboard stays with the focus: Tab walks the cards, Space and Enter click the button that has it.
    for (const key of [' ', 'Enter', 'Tab', 'p', 'c', 'h', '`', 'ArrowUp', 'ArrowDown']) expect(routeKey(k(key), 'armory'), key).toBeNull();
    // Anywhere else T is just a letter: the setup, the recap, the debrief and the console. (The how-to is no screen of the App's:
    // it is a view of the title, where T opens the Armory over it.)
    for (const screen of ['setup', 'recap', 'debrief', 'console'] as const) expect(routeKey(k('t'), screen), screen).toBeNull();
    // Esc keeps its other meanings: it releases the target in play and resumes the pause.
    expect(routeKey(k('Escape'), 'playing')).toBe('release');
    expect(routeKey(k('Escape'), 'paused')).toBe('pause');
  });

  it('takes the Armory keys once per press, never from a field and never with a shortcut held', () => {
    for (const screen of ['title', 'paused', 'draft', 'playing', 'armory'] as const) expect(routeKey(k('t', { repeat: true }), screen), screen).toBeNull();
    expect(routeKey(k('Escape', { repeat: true }), 'armory')).toBeNull();
    expect(routeKey(k('t', { inField: true }), 'playing')).toBeNull();
    expect(routeKey(k('Escape', { inField: true }), 'armory')).toBeNull();
    // Ctrl+T and Cmd+T open a browser tab.
    expect(routeKey(k('t', { ctrlKey: true }), 'playing')).toBeNull();
    expect(routeKey(k('t', { metaKey: true }), 'armory')).toBeNull();
  });

  it('mutes with M on every screen but the console, once per press, never from a field and never with a shortcut held', () => {
    for (const screen of ['title', 'setup', 'playing', 'paused', 'recap', 'draft', 'armory', 'debrief'] as const) {
      expect(routeKey(k('m'), screen), screen).toBe('mute');
      expect(routeKey(k('M'), screen), screen).toBe('mute');
      expect(routeKey(k('m', { repeat: true }), screen), screen).toBeNull();
      expect(routeKey(k('m', { inField: true }), screen), screen).toBeNull();
      expect(routeKey(k('m', { ctrlKey: true }), screen), screen).toBeNull();
      expect(routeKey(k('m', { metaKey: true }), screen), screen).toBeNull();
    }
    // The console's prompt is a text field: an M typed there is a letter.
    expect(routeKey(k('m'), 'console')).toBeNull();
    expect(routeKey(k('m', { inField: true }), 'console')).toBeNull();
  });

  it('finds the backtick by its physical key on layouts where it is a dead key', () => {
    const dead = (over: KeyOver = {}) => k('Dead', { code: 'Backquote', ...over });
    expect(routeKey(dead(), 'playing')).toBe('console');
    expect(routeKey(dead(), 'paused')).toBe('console');
    expect(routeKey(dead(), 'console')).toBe('closeConsole');
    expect(routeKey(dead({ inField: true }), 'console')).toBe('closeConsole');
    expect(routeKey(dead(), 'title')).toBeNull();
    expect(routeKey(dead({ inField: true }), 'playing')).toBeNull();
    expect(routeKey(k('Dead'), 'playing')).toBeNull();
  });

  it('ignores other characters typed on the backtick key', () => {
    for (const key of ['|', '~', '°', 'º', 'ª']) {
      expect(routeKey(k(key, { code: 'Backquote' }), 'console'), key).toBeNull();
      expect(routeKey(k(key, { code: 'Backquote', inField: true }), 'console'), key).toBeNull();
      expect(routeKey(k(key, { code: 'Backquote' }), 'playing'), key).toBeNull();
      expect(routeKey(k(key, { code: 'Backquote' }), 'paused'), key).toBeNull();
    }
  });

  it('ignores shortcuts held with Ctrl or Meta', () => {
    for (const mod of [{ ctrlKey: true }, { metaKey: true }]) {
      expect(routeKey(k('p', mod), 'playing')).toBeNull();
      expect(routeKey(k('p', mod), 'paused')).toBeNull();
      expect(routeKey(k('`', mod), 'playing')).toBeNull();
      expect(routeKey(k('ArrowUp', mod), 'playing')).toBeNull();
    }
    expect(routeKey(k('p', { ctrlKey: false, metaKey: false }), 'playing')).toBe('pause');
  });

  it('lets held keys move and cycle but never toggle or fire twice', () => {
    const held = (key: string, over: KeyOver = {}) => k(key, { repeat: true, ...over });
    expect(routeKey(held('ArrowUp'), 'playing')).toBe('laneUp');
    expect(routeKey(held('ArrowDown'), 'playing')).toBe('laneDown');
    expect(routeKey(held('Tab'), 'playing')).toBe('next');
    expect(routeKey(held('Tab', { shiftKey: true }), 'playing')).toBe('prev');
    for (const key of [' ', 'h', 'p', 'c', '`']) expect(routeKey(held(key), 'playing'), key).toBeNull();
    for (const key of ['p', 'Escape', '`']) expect(routeKey(held(key), 'paused'), key).toBeNull();
    for (const key of ['Escape', '`']) expect(routeKey(held(key), 'console'), key).toBeNull();
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
  it('does not fire when the letters come in the wrong order', () => {
    const m = konamiMatcher();
    expect([...KONAMI.slice(0, 8), 'a', 'b'].some((key) => m(key))).toBe(false);
  });
});

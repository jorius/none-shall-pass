export type Screen = 'title' | 'howto' | 'setup' | 'playing' | 'paused' | 'recap' | 'draft' | 'console' | 'debrief';
export type Action = 'laneUp' | 'laneDown' | 'next' | 'prev' | 'throw' | 'release' | 'charge' | 'hints' | 'pause' | 'console' | 'closeConsole' | 'continue' | 'back' | null;
export type KeyInput = { key: string; code?: string; shiftKey: boolean; ctrlKey?: boolean; metaKey?: boolean; repeat?: boolean; inField: boolean };

// A held key may keep moving lanes or cycling targets, but must not toggle a screen, throw, charge, go on or go back again.
const NO_REPEAT: ReadonlySet<Action> = new Set<Action>(['console', 'closeConsole', 'pause', 'hints', 'throw', 'charge', 'continue', 'back']);

// Spanish and Latin American layouts report the backtick as a 'Dead' key, so the physical key counts then,
// but not for the other characters on it (~, |, °, º), which must stay typeable in the console.
const isBacktick = (k: KeyInput): boolean => k.key === '`' || (k.key === 'Dead' && k.code === 'Backquote');

const route = (k: KeyInput, screen: Screen): Action => {
  if (screen === 'console') return k.key === 'Escape' || isBacktick(k) ? 'closeConsole' : null;
  if (k.inField) return null;
  if (isBacktick(k)) return screen === 'playing' || screen === 'paused' ? 'console' : null;
  // The recap has one key: Space or Enter goes on to the draft. The setup has one: Esc goes back to the title
  // (Space starts it through its focused START button, like any button).
  if (screen === 'recap') return k.key === ' ' || k.key === 'Enter' ? 'continue' : null;
  if (screen === 'setup') return k.key === 'Escape' ? 'back' : null;
  if (screen === 'paused') return k.key === 'p' || k.key === 'P' || k.key === 'Escape' ? 'pause' : null;
  if (screen !== 'playing') return null;
  switch (k.key) {
    case 'ArrowUp': return 'laneUp';
    case 'ArrowDown': return 'laneDown';
    case 'Tab': return k.shiftKey ? 'prev' : 'next';
    case ' ': return 'throw';
    case 'Escape': return 'release';
    case 'c': case 'C': return 'charge';
    case 'h': case 'H': return 'hints';
    case 'p': case 'P': return 'pause';
    default: return null;
  }
};

export const routeKey = (k: KeyInput, screen: Screen): Action => {
  // Browser and OS shortcuts (Ctrl+P prints, Cmd+H hides) are never game input.
  if (k.ctrlKey || k.metaKey) return null;
  const action = route(k, screen);
  return k.repeat && NO_REPEAT.has(action) ? null : action;
};

export const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'] as const;

// A sliding window of the last ten keys, so extra presses before the code still match.
export const konamiMatcher = (): ((key: string) => boolean) => {
  const buf: string[] = [];
  return (key: string) => {
    buf.push(key.length === 1 ? key.toLowerCase() : key);
    if (buf.length > KONAMI.length) buf.shift();
    const hit = buf.length === KONAMI.length && buf.every((k, i) => k === KONAMI[i]);
    if (hit) buf.length = 0;
    return hit;
  };
};

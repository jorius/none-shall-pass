export type Screen = 'title' | 'howto' | 'playing' | 'paused' | 'draft' | 'console' | 'debrief';
export type Action = 'laneUp' | 'laneDown' | 'next' | 'prev' | 'throw' | 'release' | 'hints' | 'pause' | 'console' | 'closeConsole' | null;
export type KeyInput = { key: string; code?: string; shiftKey: boolean; ctrlKey?: boolean; metaKey?: boolean; repeat?: boolean; inField: boolean };

// A held key may keep moving lanes or cycling targets, but must not toggle a screen or throw again.
const NO_REPEAT: ReadonlySet<Action> = new Set<Action>(['console', 'closeConsole', 'pause', 'hints', 'throw']);

// Spanish and Latin American layouts report the backtick as a 'Dead' key, so the physical key counts too.
const isBacktick = (k: KeyInput): boolean => k.key === '`' || k.code === 'Backquote';

const route = (k: KeyInput, screen: Screen): Action => {
  if (screen === 'console') return k.key === 'Escape' || isBacktick(k) ? 'closeConsole' : null;
  if (k.inField) return null;
  if (isBacktick(k)) return screen === 'playing' || screen === 'paused' ? 'console' : null;
  if (screen === 'paused') return k.key === 'p' || k.key === 'P' || k.key === 'Escape' ? 'pause' : null;
  if (screen !== 'playing') return null;
  switch (k.key) {
    case 'ArrowUp': return 'laneUp';
    case 'ArrowDown': return 'laneDown';
    case 'Tab': return k.shiftKey ? 'prev' : 'next';
    case ' ': return 'throw';
    case 'Escape': return 'release';
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

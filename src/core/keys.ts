export type Screen = 'title' | 'howto' | 'playing' | 'paused' | 'draft' | 'console' | 'debrief';
export type Action = 'laneUp' | 'laneDown' | 'next' | 'prev' | 'throw' | 'release' | 'hints' | 'pause' | 'console' | 'closeConsole' | null;

export const routeKey = (k: { key: string; shiftKey: boolean; inField: boolean }, screen: Screen): Action => {
  if (screen === 'console') return k.key === 'Escape' || k.key === '`' ? 'closeConsole' : null;
  if (k.inField) return null;
  if (k.key === '`') return screen === 'playing' || screen === 'paused' ? 'console' : null;
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

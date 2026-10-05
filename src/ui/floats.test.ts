// @vitest-environment jsdom
// packages
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// local
import { Floats } from './floats';

describe('Floats', () => {
  let ui: HTMLElement, floats: Floats;
  const all = (): HTMLElement[] => [...ui.querySelectorAll<HTMLElement>('.float')];
  beforeEach(() => {
    vi.useFakeTimers();
    ui = document.createElement('div');
    floats = new Floats(ui);
  });
  afterEach(() => vi.useRealTimers());

  it('stays up until its rise animation ends, however long that takes', () => {
    floats.event({ type: 'float', at: 'packet', x: 1250, y: 100, kind: 'sneaky', value: 150 });
    const [f] = all();
    expect(f.className).toBe('float big');
    expect(f.textContent).toBe('+150 · SNEAKY');
    expect(f.style.left).toBe('1100px');
    vi.advanceTimersByTime(10_000);
    expect(all()).toHaveLength(1);
    f.dispatchEvent(new Event('animationend'));
    expect(all()).toHaveLength(0);
  });

  it('pins rack floats to the right and clears leftovers when a run starts', () => {
    floats.event({ type: 'float', at: 'rack', x: 1124, y: 40, kind: 'damage', value: 12 });
    floats.event({ type: 'float', at: 'packet', x: 50, y: 100, kind: 'falsePositive', value: 0 });
    const [rack, fp] = all();
    expect(rack.style.right).toBe('14px');
    expect(rack.textContent).toBe('−12% UPTIME');
    expect(fp.style.left).toBe('116px');
    floats.start();
    expect(all()).toHaveLength(0);
  });
});

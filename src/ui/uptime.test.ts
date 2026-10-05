// @vitest-environment jsdom
// packages
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// local
import { UptimeStrip } from './uptime';

describe('UptimeStrip', () => {
  let ui: HTMLElement, strip: UptimeStrip;
  const box = (): HTMLElement => ui.querySelector('.hpstrip') as HTMLElement;
  const num = (): string => ui.querySelector('.hpstrip b')?.textContent ?? '';
  const count = (sel: string): number => ui.querySelectorAll(`.segs i${sel}`).length;
  beforeEach(() => {
    vi.useFakeTimers();
    ui = document.createElement('div');
    strip = new UptimeStrip(ui);
  });
  afterEach(() => vi.useRealTimers());

  it('tears on a breach, scrambles the number, then settles', () => {
    strip.event({ type: 'uptime', before: 100, after: 64 });
    expect(box().classList.contains('hit')).toBe(true);
    expect(count('.fresh')).toBe(18);
    vi.advanceTimersByTime(100);
    expect(num()).not.toBe('64%');
    vi.advanceTimersByTime(600);
    expect(num()).toBe('64%');
    expect(count('.fresh')).toBe(0);
    expect(count('.lost')).toBe(18);
    expect(box().classList.contains('low')).toBe(false);
  });

  it('keeps the newer breach flashing when two land close together', () => {
    strip.event({ type: 'uptime', before: 100, after: 90 });
    vi.advanceTimersByTime(500);
    strip.event({ type: 'uptime', before: 90, after: 80 });
    vi.advanceTimersByTime(200);
    expect(count('.fresh')).toBe(5);
    vi.advanceTimersByTime(500);
    expect(count('.fresh')).toBe(0);
  });

  it('heals in blue without tearing, and glitches when low', () => {
    strip.event({ type: 'uptime', before: 20, after: 30 });
    expect(count('.healed')).toBe(5);
    expect(box().classList.contains('hit')).toBe(false);
    expect(box().classList.contains('low')).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(count('.healed')).toBe(0);
  });

  it('starts a new run clean even mid-breach', () => {
    strip.event({ type: 'uptime', before: 50, after: 10 });
    strip.start();
    vi.advanceTimersByTime(100);
    expect(num()).toBe('100%');
    expect(box().classList.contains('hit')).toBe(false);
    expect(box().classList.contains('low')).toBe(false);
    expect(count('.lost')).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });
});

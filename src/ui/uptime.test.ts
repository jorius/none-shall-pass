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
  // The view clock: App passes the same time on every frame while the game is paused.
  const at = (time: number): void => strip.frame(null, 0, time);
  beforeEach(() => {
    vi.useFakeTimers();
    ui = document.createElement('div');
    strip = new UptimeStrip(ui);
    at(1);
  });
  afterEach(() => vi.useRealTimers());

  it('tears on a breach, scrambles the number, then settles', () => {
    strip.event({ type: 'uptime', before: 100, after: 64 });
    expect(box().classList.contains('tear')).toBe(true);
    expect(count('.fresh')).toBe(18);
    at(1.1);
    expect(num()).not.toBe('64%');
    at(1.7);
    expect(num()).toBe('64%');
    expect(count('.fresh')).toBe(0);
    expect(count('.lost')).toBe(18);
    expect(box().classList.contains('low')).toBe(false);
  });

  it('keeps the newer breach flashing when two land close together', () => {
    strip.event({ type: 'uptime', before: 100, after: 90 });
    at(1.5);
    strip.event({ type: 'uptime', before: 90, after: 80 });
    at(1.7);
    expect(count('.fresh')).toBe(5);
    at(2.2);
    expect(count('.fresh')).toBe(0);
  });

  it('heals in blue without tearing, and glitches when low', () => {
    strip.event({ type: 'uptime', before: 20, after: 30 });
    expect(count('.healed')).toBe(5);
    expect(box().classList.contains('tear')).toBe(false);
    expect(box().classList.contains('low')).toBe(true);
    at(2);
    expect(count('.healed')).toBe(0);
  });

  it('holds the tear while the game is paused, however long the wall clock runs', () => {
    strip.event({ type: 'uptime', before: 100, after: 64 });
    at(1.2);
    const frozen = num();
    vi.advanceTimersByTime(5000);
    for (let i = 0; i < 10; i++) at(1.2);
    expect(num()).toBe(frozen);
    expect(count('.fresh')).toBe(18);
    at(1.9);
    expect(num()).toBe('64%');
    expect(count('.fresh')).toBe(0);
  });

  it('runs on no wall-clock timers and starts a new run clean even mid-breach', () => {
    strip.event({ type: 'uptime', before: 50, after: 10 });
    strip.event({ type: 'uptime', before: 10, after: 40 });
    expect(vi.getTimerCount()).toBe(0);
    strip.event({ type: 'uptime', before: 40, after: 10 });
    strip.start();
    at(1.1);
    expect(num()).toBe('100%');
    expect(box().classList.contains('tear')).toBe(false);
    expect(box().classList.contains('low')).toBe(false);
    expect(count('.lost')).toBe(0);
  });
});

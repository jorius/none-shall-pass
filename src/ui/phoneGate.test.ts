// packages
import { describe, expect, it } from 'vitest';

// local
import { shouldGate } from './phoneGate';

// The gate looks at the device, not the window: a desktop browser snapped to half the screen still has a keyboard.
describe('shouldGate', () => {
  it('gates phones, either way up', () => {
    expect(shouldGate(390, true)).toBe(true);
    expect(shouldGate(Math.min(844, 390), true)).toBe(true);
  });
  it('gates a touch-only device whatever its size', () => {
    expect(shouldGate(1366, true)).toBe(true);
  });
  it('gates a phone-sized screen that claims a fine pointer', () => {
    expect(shouldGate(500, false)).toBe(true);
  });
  it('lets a desktop play, however narrow its window', () => {
    expect(shouldGate(1080, false)).toBe(false);
    expect(shouldGate(600, false)).toBe(false);
  });
});

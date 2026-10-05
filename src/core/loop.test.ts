// packages
import { describe, expect, it } from 'vitest';

// core
import { MAX_STEPS_PER_FRAME, STEP } from './constants';
import { frameSteps } from './loop';

describe('frameSteps', () => {
  it('runs one fixed step per 60 Hz frame', () => {
    const r = frameSteps(0, 1000 / 60);
    expect(r.steps).toBe(1);
    expect(r.acc).toBeCloseTo(0, 6);
  });
  it('accumulates short frames', () => {
    const a = frameSteps(0, 8);
    expect(a.steps).toBe(0);
    const b = frameSteps(a.acc, 9);
    expect(b.steps).toBe(1);
    expect(b.acc).toBeCloseTo(0.017 - STEP, 6);
  });
  it('drops the backlog after a long pause instead of fast-forwarding', () => {
    const r = frameSteps(0, 10_000);
    expect(r.steps).toBe(MAX_STEPS_PER_FRAME);
    expect(r.acc).toBe(0);
  });
  it('ignores negative deltas', () => {
    expect(frameSteps(0.005, -40)).toEqual({ steps: 0, acc: 0.005 });
  });
});

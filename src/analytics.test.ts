// packages
import { afterEach, describe, expect, it, vi } from 'vitest';

// local
import { scoreBucket, track } from './analytics';

afterEach(() => { vi.unstubAllGlobals(); });

describe('analytics', () => {
  it('forwards events to umami when present and stays silent otherwise', () => {
    const calls: unknown[] = [];
    vi.stubGlobal('window', { umami: { track: (n: string, d: unknown) => calls.push([n, d]) } });
    track('game-start', { mode: 'campaign' });
    expect(calls).toEqual([['game-start', { mode: 'campaign' }]]);
    vi.stubGlobal('window', {});
    expect(() => track('x')).not.toThrow();
    vi.stubGlobal('window', { umami: { track: () => { throw new Error('blocked'); } } });
    expect(() => track('x')).not.toThrow();
  });

  it('swallows a tracker request that fails later', async () => {
    const failed = Promise.reject(new Error('offline'));
    const caught = vi.spyOn(failed, 'catch');
    vi.stubGlobal('window', { umami: { track: () => failed } });
    track('x');
    expect(caught).toHaveBeenCalledOnce();
    await expect(failed).rejects.toThrow('offline');
  });

  it('buckets scores coarsely', () => {
    expect(scoreBucket(0)).toBe('0-999');
    expect(scoreBucket(4210)).toBe('1k-4.9k');
    expect(scoreBucket(18420)).toBe('10k-24.9k');
    expect(scoreBucket(90000)).toBe('50k+');
  });
});

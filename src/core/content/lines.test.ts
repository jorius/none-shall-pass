// packages
import { describe, expect, it } from 'vitest';

// core
import { LINES } from './lines';

describe("the knight's lines", () => {
  it('has the twelve v1 lines', () => {
    expect(Object.keys(LINES).sort()).toEqual(['angry', 'draw', 'emptyLane', 'firstBreach', 'fleshWound', 'haveAtYou', 'invincible', 'noTarget', 'oops', 'usersGone', 'waveStart', 'won']);
  });

  it('writes every line and subline in both languages', () => {
    for (const line of Object.values(LINES)) {
      expect(line.text.en).not.toBe('');
      expect(line.text.es).not.toBe('');
      if (line.sub) {
        expect(line.sub.en).not.toBe('');
        expect(line.sub.es).not.toBe('');
      }
    }
  });
});

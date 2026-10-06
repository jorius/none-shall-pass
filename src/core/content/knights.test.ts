// packages
import { describe, expect, it } from 'vitest';

// local
import { KNIGHT_IDS, KNIGHTS } from './knights';

describe('knights', () => {
  it('has six knights, three of them women, each with a name, team, motto and description in both languages', () => {
    expect(KNIGHT_IDS).toEqual(['black', 'sentinel', 'raider', 'warden', 'ghost', 'forge']);
    expect(KNIGHT_IDS.filter((id) => KNIGHTS[id].she).length).toBe(3);
    for (const id of KNIGHT_IDS) {
      const k = KNIGHTS[id];
      expect(k.id).toBe(id);
      for (const f of [k.name, k.team, k.motto, k.who]) { expect(f.en.length).toBeGreaterThan(2); expect(f.es.length).toBeGreaterThan(2); }
      expect(k.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(['open', 'closed']).toContain(k.look.face);
    }
  });

  it('keeps the Black Knight on the stock palette so the v1 sprite does not change', () => {
    expect(KNIGHTS.black.pal).toEqual({});
    expect(KNIGHTS.black.look).toEqual({ plume: true, face: 'closed', chest: 'cross', shield: 'cross' });
  });
});

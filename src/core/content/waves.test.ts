// packages
import { describe, expect, it } from 'vitest';

// core
import { CAMPAIGN, overtimeWave, waveFor } from './waves';

describe('waves', () => {
  it('has the six campaign waves in order', () => {
    expect(CAMPAIGN.map((w) => w.id)).toEqual(['recon', 'brute', 'sqli', 'xss', 'flood', 'finale']);
    expect(CAMPAIGN[0].only).toEqual(['legit', 'scan']);
    for (const w of CAMPAIGN) { expect(w.speedMult).toBe(1); expect(w.name.es).not.toBe(''); expect(w.intro.es).not.toBe(''); }
  });

  it('ramps overtime and respects the floors', () => {
    const w1 = overtimeWave(1), w5 = overtimeWave(5), w60 = overtimeWave(60);
    expect(w1.secs).toBe(45);
    expect(w5.spawn).toBeLessThan(w1.spawn);
    expect(w5.speedMult).toBeGreaterThan(w1.speedMult);
    expect(w60.spawn).toBe(0.45);
    expect(72 * w60.speedMult).toBeCloseTo(150, 5);
    expect(w5.tier3Mult).toBeGreaterThan(w1.tier3Mult);
    expect(w5.name.en).toBe('OVERTIME 5');
  });

  it('routes by mode', () => {
    expect(waveFor('campaign', 3).id).toBe('sqli');
    expect(waveFor('campaign', 99).id).toBe('finale');
    expect(waveFor('overtime', 2).id).toBe('overtime');
  });
});

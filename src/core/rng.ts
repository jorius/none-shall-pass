export type Rng = () => number;

// Small, fast, seedable PRNG; the same seed and inputs replay the same run.
export const mulberry32 = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

// RFC 5737 documentation ranges only: no real address is ever shown as an attacker.
export const docIp = (rng: Rng): string =>
  `${pick(rng, ['192.0.2', '198.51.100', '203.0.113'])}.${2 + Math.floor(rng() * 250)}`;

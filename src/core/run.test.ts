// packages
import { describe, expect, it } from 'vitest';

// core
import { STEP } from './constants';
import type { RunEvent } from './events';
import { Run } from './run';
import { cfg, place } from './testkit';

const playWave = (run: Run, onStep?: (run: Run, ev: RunEvent[]) => void): RunEvent[] => {
  const all: RunEvent[] = [];
  for (let i = 0; i < 60 * 120 && run.state.phase === 'playing'; i++) {
    const ev = run.step(STEP);
    all.push(...ev);
    onStep?.(run, ev);
  }
  return all;
};

describe('Run', () => {
  it('starts wave one with the knight\'s line', () => {
    const run = new Run(cfg());
    expect(run.start()).toEqual([{ type: 'waveStarted', wave: 1 }, { type: 'say', line: 'waveStart', wave: 1 }]);
  });

  it('plays recon to a draft without damage: lockdown stops every scan', () => {
    const run = new Run(cfg({ seed: 42 }));
    run.start();
    const ev = playWave(run);
    expect(run.state.phase).toBe('draft');
    expect(run.state.uptime).toBe(100);
    expect(run.state.stats.ruleBlocks).toBeGreaterThan(0);
    expect(run.state.stats.served).toBeGreaterThan(0);
    expect(ev).toContainEqual({ type: 'waveCleared', wave: 1 });
    const draft = run.state.draft!;
    expect(draft.picks.map((c) => c.id).slice(0, 2)).toEqual(['destrier', 'obs1']);
    expect(draft.free).toBe(true);
  });

  it('is deterministic for a seed and inputs', () => {
    const a = new Run(cfg({ seed: 7 })), b = new Run(cfg({ seed: 7 }));
    a.start(); b.start();
    playWave(a); playWave(b);
    expect(a.state.score).toBe(b.state.score);
    expect(a.state.log.map((e) => e.packet.t.id)).toEqual(b.state.log.map((e) => e.packet.t.id));
  });

  it('takes the first pick free, then charges, never twice, never into debt', () => {
    const run = new Run(cfg({ seed: 42 }));
    run.start(); playWave(run);
    const s = run.state;
    s.credits = 700;
    run.pick(0);
    expect(s.owned).toContain('destrier');
    expect(s.credits).toBe(700);
    run.pick(0);
    expect(s.owned.filter((c) => c === 'destrier').length).toBe(1);
    run.pick(1);
    expect(s.owned).toContain('obs1');
    expect(s.credits).toBe(450);
    const third = s.draft!.picks[2];
    s.credits = 10;
    run.pick(2);
    expect(s.owned).not.toContain(third.id === 'backup' ? 'nothing' : third.id);
    expect(s.credits).toBe(10);
  });

  it('rerolls for credits only when affordable, keeping taken cards out', () => {
    const run = new Run(cfg({ seed: 42 }));
    run.start(); playWave(run);
    const s = run.state;
    run.pick(0);
    s.credits = 100;
    expect(run.reroll()).toEqual([]);
    s.credits = 400;
    run.reroll();
    expect(s.credits).toBe(250);
    expect(s.draft!.picks.map((c) => c.id)).not.toContain('destrier');
  });

  it('restores uptime with a backup without adding it to the loadout', () => {
    const run = new Run(cfg({ seed: 42 }));
    run.start(); playWave(run);
    const s = run.state;
    s.uptime = 50;
    s.draft!.picks[0] = { ...s.draft!.picks[0], id: 'backup', rarity: 'COMMON' };
    run.pick(0);
    expect(s.uptime).toBe(80);
    expect(s.owned).not.toContain('backup');
  });

  it('moves to the next wave and wins after the sixth', () => {
    const run = new Run(cfg({ seed: 3 }));
    run.start();
    run.cheat('god');
    for (let w = 1; w <= 6; w++) {
      playWave(run);
      if (w < 6) {
        expect(run.state.phase).toBe('draft');
        const ev = run.nextWave();
        expect(ev[0]).toEqual({ type: 'waveStarted', wave: w + 1 });
      }
    }
    expect(run.state.phase).toBe('ended');
    expect(run.state.endReason).toBe('won');
    expect(run.state.stats.wavesCleared).toBe(6);
  });

  it('pays overtime a bonus per cleared wave', () => {
    const run = new Run(cfg({ mode: 'overtime', seed: 5 }));
    run.start(); run.cheat('god');
    const before = run.state.score;
    playWave(run);
    expect(run.state.phase).toBe('draft');
    expect(run.state.score).toBeGreaterThanOrEqual(before + 500);
  });

  it('ignores intents in the wrong phase', () => {
    const run = new Run(cfg({ seed: 42 }));
    run.start(); playWave(run);
    expect(run.throwSpear()).toEqual([]);
    expect(run.moveLane(1)).toEqual([]);
    const fresh = new Run(cfg());
    expect(fresh.pick(0)).toEqual([]);
    expect(fresh.nextWave()).toEqual([]);
  });

  it('marks cheats as tampering and skip ends the wave', () => {
    const run = new Run(cfg({ seed: 42 }));
    run.start();
    for (let i = 0; i < 300; i++) run.step(STEP);
    const ev = run.cheat('skip');
    expect(run.state.tampered).toBe(true);
    expect(ev).toContainEqual({ type: 'waveCleared', wave: 1 });
    run.cheat('credits', 900);
    expect(run.state.credits).toBeGreaterThanOrEqual(900);
  });

  it('applies the hints multiplier from the moment it is switched on', () => {
    const run = new Run(cfg({ seed: 1 }));
    run.start();
    run.setHints(true);
    const s = run.state;
    const p = place(s, 'sqli-tautology', 400);
    run.target(p.id);
    run.throwSpear();
    for (let i = 0; i < 60; i++) run.step(STEP);
    expect(s.score).toBe(Math.round(50 * 0.75));
  });
});

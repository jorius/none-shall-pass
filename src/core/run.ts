// core
import { POINTS } from './constants';
import { CAMPAIGN, waveFor, type WaveDef } from './content/waves';
import { deal, PRICE, REROLL_COST } from './draft';
import type { RunEvent } from './events';
import { spawn, stepPackets, stepPending } from './field';
import { cycleTarget, setLane, startCharge, stepKnight, stepSpears, stepSquire, target, throwSpear } from './knight';
import { endRun, untarget } from './outcomes';
import { mulberry32, type Rng } from './rng';
import { createState, multiplier, type RunConfig, type RunState } from './state';

export class Run {
  readonly state: RunState;
  private readonly rng: Rng;

  constructor(cfg: RunConfig) {
    this.rng = mulberry32(cfg.seed);
    this.state = createState(cfg);
  }

  get waveDef(): WaveDef {
    return waveFor(this.state.cfg.mode, this.state.wave);
  }

  start(): RunEvent[] {
    return [{ type: 'waveStarted', wave: this.state.wave }, { type: 'say', line: 'waveStart', wave: this.state.wave }];
  }

  step(dt: number): RunEvent[] {
    const s = this.state, ev: RunEvent[] = [];
    if (s.phase !== 'playing') return ev;
    s.timeLeft -= dt;
    s.spawnT -= dt;
    if (s.spawnT <= 0 && s.timeLeft > 4) { spawn(s, this.rng, ev); s.spawnT = this.waveDef.spawn; }
    stepKnight(s, dt, ev);
    stepPackets(s, dt, ev);
    stepSpears(s, dt, ev);
    stepPending(s, dt, ev);
    stepSquire(s, dt, ev);
    s.packets = s.packets.filter((p) => !p.dead);
    if (s.phase === 'playing' && s.timeLeft <= 0 && !s.packets.length && !s.pending.length && !s.spears.length) this.clearWave(ev);
    return ev;
  }

  private act(fn: (ev: RunEvent[]) => void): RunEvent[] {
    const ev: RunEvent[] = [];
    if (this.state.phase === 'playing') fn(ev);
    return ev;
  }

  moveLane(d: 1 | -1): RunEvent[] { return this.act((ev) => setLane(this.state, this.state.knight.lane + d, ev)); }
  setLane(l: number): RunEvent[] { return this.act((ev) => setLane(this.state, l, ev)); }
  cycleTarget(dir: 1 | -1): RunEvent[] { return this.act((ev) => cycleTarget(this.state, dir, ev)); }
  target(id: number | null): RunEvent[] { return this.act((ev) => target(this.state, id, ev)); }
  throwSpear(): RunEvent[] { return this.act((ev) => throwSpear(this.state, ev)); }
  charge(): RunEvent[] { return this.act((ev) => startCharge(this.state, ev)); }

  setHints(on: boolean): void {
    this.state.hints = on;
  }

  private clearWave(ev: RunEvent[]): void {
    const s = this.state;
    untarget(s, ev);
    s.stats.wavesCleared++;
    ev.push({ type: 'waveCleared', wave: s.wave });
    if (s.cfg.mode === 'campaign' && s.wave >= CAMPAIGN.length) { endRun(s, 'won', ev); return; }
    if (s.cfg.mode === 'overtime') s.score += Math.round(POINTS.overtimeWave * multiplier(s));
    s.phase = 'draft';
    s.draft = { picks: deal(this.rng, s.owned, [], s.drafts === 0 ? ['destrier', 'obs1'] : []), free: true, taken: [] };
    s.drafts++;
    ev.push({ type: 'draftOpened', draft: s.draft });
  }

  pick(index: number): RunEvent[] {
    const s = this.state, d = s.draft, ev: RunEvent[] = [];
    if (s.phase !== 'draft' || !d) return ev;
    const c = d.picks[index];
    if (!c || d.taken.includes(c.id)) return ev;
    if (d.free) d.free = false;
    else {
      const price = PRICE[c.rarity];
      if (s.credits < price) return ev;
      s.credits -= price;
    }
    d.taken.push(c.id);
    if (c.id === 'backup') {
      const before = s.uptime;
      s.uptime = Math.min(100, s.uptime + 30);
      ev.push({ type: 'uptime', before, after: s.uptime });
    } else {
      s.owned.push(c.id);
      ev.push({ type: 'owned', owned: [...s.owned] });
    }
    ev.push({ type: 'draftChanged', draft: d });
    return ev;
  }

  reroll(): RunEvent[] {
    const s = this.state, d = s.draft;
    if (s.phase !== 'draft' || !d || s.credits < REROLL_COST) return [];
    s.credits -= REROLL_COST;
    d.picks = deal(this.rng, s.owned, d.taken);
    return [{ type: 'draftChanged', draft: d }];
  }

  nextWave(): RunEvent[] {
    const s = this.state;
    if (s.phase !== 'draft') return [];
    s.wave++;
    s.timeLeft = this.waveDef.secs;
    s.spawnT = 0.4;
    s.draft = null;
    s.knight.charge = { t: 0, used: false };
    s.phase = 'playing';
    return this.start();
  }

  cheat(kind: 'god' | 'credits' | 'skip', amount = 1000): RunEvent[] {
    const s = this.state, ev: RunEvent[] = [];
    s.tampered = true;
    if (kind === 'god') s.god = true;
    if (kind === 'credits') s.credits += Math.max(0, Math.floor(amount));
    if (kind === 'skip' && s.phase === 'playing') {
      untarget(s, ev);
      s.packets = []; s.pending = []; s.spears = [];
      s.knight.charge = { t: 0, used: false };
      s.timeLeft = 0;
      this.clearWave(ev);
    }
    return ev;
  }
}

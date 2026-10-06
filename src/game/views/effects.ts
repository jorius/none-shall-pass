// packages
import Phaser from 'phaser';

// core
import { FIELD_H, FIELD_W, FW_X, LANE_X0, PKT_H, PKT_W, RACK_TARGET } from '../../core/constants';
import type { RunEvent } from '../../core/events';
import { CSS, HEX } from '../../core/palette';
import type { Run } from '../../core/run';
import { packetY } from '../../core/state';

// game
import type { FieldScene } from '../FieldScene';
import type { View } from '../view';

const GLYPHS = "01<>/'=;%(){}";
const COLORS: Record<string, string> = { ink: CSS.ink, red: CSS.red, blue: CSS.blue, gold: CSS.gold, brick: '#a8432a', cyan: '#8fdcff' };
const PALETTES = {
  knight: ['ink', 'ink', 'red', 'blue'], rule: ['blue', 'blue', 'ink'], squire: ['gold', 'ink', 'ink'], lockdown: ['red', 'brick', 'ink'], charge: ['gold', 'ink', 'red'],
  stream: ['ink', 'ink', 'cyan'],
} satisfies Record<string, string[]>;
// Whoever shattered a packet picks its burst: every palette but the stream's is one. A thrower with no palette fails to compile.
type PaletteName = keyof typeof PALETTES;
type BurstName = Exclude<PaletteName, 'stream'>;
const ORANGE = '#ff8a2f';

// Extra 0s and 1s weight the pick so about three glyphs in four are binary, as in the mock.
const BITS = '01'.repeat(16);
const frames = (palette: string[]): string[] => palette.flatMap((c) => [...GLYPHS, ...BITS].map((g) => `${c}:${g}`));

// Spears in flight, packets shattering into binary with a snap and a white flash when the knight lands one, the glyphs a burning packet
// streams into the rack, the sparks a breach throws off it, the crumbs a bite knocks off a card, and the binary rain a won campaign ends on.
export class EffectsView implements View {
  private readonly shatter: Record<BurstName, Phaser.GameObjects.Particles.ParticleEmitter>;
  private readonly stream: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly crumb: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly spark: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly rainfall: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly emitted = new Map<number, number>();
  // The snap's white flashes that are still on the field (each lives 60 ms); the smoke counts them.
  private readonly flashes = new Set<Phaser.GameObjects.Rectangle>();

  constructor(private readonly scene: FieldScene) {
    this.buildGlyphs();
    this.buildCrumb();
    this.buildSparks();
    const fx = scene.layers.fx;
    this.shatter = { knight: this.burst('knight'), rule: this.burst('rule'), squire: this.burst('squire'), lockdown: this.burst('lockdown'), charge: this.burst('charge') };
    this.stream = scene.add.particles(0, 0, 'glyphs', {
      frame: frames(PALETTES.stream), emitting: false, lifespan: { min: 380, max: 640 },
      moveToX: { min: RACK_TARGET.x0, max: RACK_TARGET.x1 }, moveToY: { min: RACK_TARGET.y0, max: RACK_TARGET.y1 },
      alpha: { start: 1, end: 0.15 }, scale: { start: 0.55, end: 0.25 },
    });
    fx.add(this.stream);
    // What a bite knocks off the frame: a short hop, then it falls and fades.
    this.crumb = scene.add.particles(0, 0, 'crumb', { emitting: false, lifespan: { min: 300, max: 500 }, speed: { min: 20, max: 60 }, gravityY: 200, alpha: { start: 1, end: 0 } });
    fx.add(this.crumb);
    // What a breach throws off the rack: orange and gold squares that fly out, fall and fade.
    this.spark = scene.add.particles(0, 0, 'sparks', {
      frame: ['orange', 'gold'], emitting: false, lifespan: 500, speed: { min: 80, max: 220 }, gravityY: 300, alpha: { start: 1, end: 0 },
    });
    fx.add(this.spark);
    // Ink 0s and 1s let go just above the lanes, falling faster as they go and fading out before the strip.
    this.rainfall = scene.add.particles(0, 0, 'glyphs', {
      frame: ['ink:0', 'ink:1'], emitting: false, lifespan: 2000, x: { min: LANE_X0, max: FW_X }, y: -20,
      speedY: { min: 20, max: 90 }, gravityY: 180, alpha: { start: 1, end: 0 }, scale: { min: 0.4, max: 0.6 },
    });
    fx.add(this.rainfall);
  }

  // One burst of binary, in the palette of whoever shattered the packet, from a random point on its card.
  private burst(name: BurstName): Phaser.GameObjects.Particles.ParticleEmitter {
    const em = this.scene.add.particles(0, 0, 'glyphs', {
      frame: frames(PALETTES[name]), emitting: false, lifespan: { min: 520, max: 1000 }, speed: { min: 40, max: 230 }, angle: { min: 0, max: 360 },
      accelerationX: -90, rotate: { min: -180, max: 180 }, alpha: { start: 1, end: 0 }, scale: { min: 0.42, max: 0.62 },
    });
    // A random point on the card (a Geom.Rectangle does the same, but its typing doesn't fit the zone's).
    em.addEmitZone({ type: 'random', source: { getRandomPoint: (pt) => { pt.x = Math.random() * PKT_W; pt.y = Math.random() * PKT_H; } } });
    this.scene.layers.fx.add(em);
    return em;
  }

  // The switch itself lives on the scene, where the rack reads it too; the pause menu and main.ts set it here.
  get reduced(): boolean { return this.scene.reduced; }
  set reduced(on: boolean) { this.scene.reduced = on; }

  // `n` crumbs from a bite at (x, y) on the field; none asked for (reduced effects) is none emitted.
  crumbs(x: number, y: number, n: number): void {
    if (n > 0) this.crumb.emitParticleAt(x, y, n);
  }

  // The win: one burst of binary over the lanes; reduced effects get none.
  rain(): void {
    this.rainfall.explode(this.reduced ? 0 : 160);
  }

  // A breach: 24 sparks from (x, y) on the field; reduced effects get none.
  sparks(x: number, y: number): void {
    this.spark.explode(this.reduced ? 0 : 24, x, y);
  }

  // A knight's hit lands with a thud: the camera jolts about 3 px and the field flashes white for 60 ms. Reduced effects get neither.
  snap(): void {
    if (this.reduced) return;
    this.scene.cameras.main.shake(60, 0.0015);
    const f = this.scene.add.rectangle(0, 0, FIELD_W, FIELD_H, 0xffffff, 0.35).setOrigin(0, 0);
    this.scene.layers.fx.add(f);
    this.flashes.add(f);
    this.scene.tweens.add({ targets: f, alpha: 0, duration: 60, onComplete: () => { this.flashes.delete(f); f.destroy(); } });
  }

  // For the smoke: how many of the snap's flashes are on the field right now.
  debugFlashes(): number {
    return this.flashes.size;
  }

  // A 3×3 speck in the dim colour.
  private buildCrumb(): void {
    if (this.scene.textures.exists('crumb')) return;
    const tex = this.scene.textures.createCanvas('crumb', 3, 3)!;
    const ctx = tex.getContext();
    ctx.fillStyle = CSS.dim;
    ctx.fillRect(0, 0, 3, 3);
    tex.refresh();
  }

  // Two 2×2 squares side by side, the sparks' orange and gold; nearest-neighbour so they stay hard-edged.
  private buildSparks(): void {
    if (this.scene.textures.exists('sparks')) return;
    const tex = this.scene.textures.createCanvas('sparks', 4, 2)!;
    const ctx = tex.getContext();
    ctx.fillStyle = ORANGE;
    ctx.fillRect(0, 0, 2, 2);
    ctx.fillStyle = CSS.gold;
    ctx.fillRect(2, 0, 2, 2);
    tex.add('orange', 0, 0, 0, 2, 2);
    tex.add('gold', 0, 2, 0, 2, 2);
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    tex.refresh();
  }

  // One 2x canvas with every glyph in every colour, sliced into named frames.
  private buildGlyphs(): void {
    if (this.scene.textures.exists('glyphs')) return;
    const cell = 32, cols = GLYPHS.length, names = Object.keys(COLORS);
    const tex = this.scene.textures.createCanvas('glyphs', cell * cols, cell * names.length)!;
    const ctx = tex.getContext();
    ctx.font = '600 28px "IBM Plex Mono"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    names.forEach((c, row) => [...GLYPHS].forEach((g, col) => {
      ctx.fillStyle = COLORS[c];
      ctx.fillText(g, col * cell + cell / 2, row * cell + cell / 2);
      tex.add(`${c}:${g}`, 0, col * cell, row * cell, cell, cell);
    }));
    tex.refresh();
  }

  // The single owner of the scene clock: pausing here also freezes the other views' tweens and timers.
  // A zero time scale stops tweens where they are; pauseAll would replay the paused gap on resume.
  pause(p: boolean): void {
    this.scene.tweens.timeScale = p ? 0 : 1;
    this.scene.time.paused = p;
    for (const em of [...Object.values(this.shatter), this.stream, this.crumb, this.spark, this.rainfall]) { if (p) em.pause(); else em.resume(); }
  }

  start(): void {
    this.emitted.clear();
  }

  event(ev: RunEvent): void {
    if (ev.type === 'shattered') {
      const p = ev.packet, y = packetY(p);
      // Every thrower has a palette: the knight's, the squire's, the charge's gold, or the rule's (the lockdown its own).
      const pal: BurstName = ev.by === 'rule' ? (ev.ruleId === 'lockdown' ? 'lockdown' : 'rule') : ev.by;
      this.shatter[pal].explode(this.reduced ? 18 : 56, p.x, y);
      const box = this.scene.add.rectangle(p.x, y, PKT_W, PKT_H, HEX.ink, 0.75).setOrigin(0, 0);
      this.scene.layers.fx.add(box);
      this.scene.tweens.add({ targets: box, alpha: 0, duration: 140, onComplete: () => box.destroy() });
      // The knight's own hits, and the charge's, land with a thud; a rule's or the squire's shatter does not.
      if (ev.by === 'knight' || ev.by === 'charge') this.snap();
    }
    if (ev.type === 'thrown') this.spear(ev.from, ev.to, ev.duration, ev.by === 'squire');
    if (ev.type === 'consumed') this.emitted.delete(ev.packetId);
    if (ev.type === 'runEnded' && ev.reason === 'won') this.rain();
  }

  // Flies the arc the core already timed; whether it hits was decided there, so nothing waits on it here.
  private spear(from: { x: number; y: number }, to: { x: number; y: number }, duration: number, small: boolean): void {
    const key = small ? 'spear-small' : 'spear';
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const cx = (from.x + to.x) / 2, cy = Math.min(from.y, to.y) - Math.min(70, dist * 0.14);
    const pose = (t: number) => {
      const u = 1 - t;
      const x = u * u * from.x + 2 * u * t * cx + t * t * to.x, y = u * u * from.y + 2 * u * t * cy + t * t * to.y;
      const dx = 2 * u * (cx - from.x) + 2 * t * (to.x - cx), dy = 2 * u * (cy - from.y) + 2 * t * (to.y - cy);
      return { x, y, rot: Math.atan2(dy, dx) - Math.PI };
    };
    const ghosts = this.reduced ? [] : [HEX.red, HEX.blue].map((c) => this.scene.add.image(from.x, from.y, key).setTint(c).setAlpha(0.45));
    const main = this.scene.add.image(from.x, from.y, key);
    const place = (t: number): void => {
      const p = pose(t);
      main.setPosition(p.x, p.y).setRotation(p.rot);
      ghosts.forEach((g, i) => { const q = pose(Math.max(0, t - 0.04 * (i + 1))); g.setPosition(q.x, q.y + (i ? 3 : -3)).setRotation(q.rot); });
    };
    // Start on the arc, already pointing along it, before the first tween step.
    place(0);
    this.scene.layers.fx.add([...ghosts, main]);
    this.scene.tweens.addCounter({
      from: 0, to: 1, duration: duration * 1000,
      onUpdate: (tw) => place(tw.getValue() ?? 0),
      onComplete: () => {
        ghosts.forEach((g) => g.destroy());
        this.scene.tweens.add({ targets: main, alpha: 0, duration: 120, onComplete: () => main.destroy() });
      },
    });
  }

  frame(run: Run | null): void {
    if (!run) return;
    for (const p of run.state.packets) {
      if (!p.entering) continue;
      const eaten = Math.max(0, p.x + PKT_W - FW_X);
      const target = Math.floor(eaten / (this.reduced ? 12 : 5));
      const done = this.emitted.get(p.id) ?? 0;
      for (let i = done; i < target; i++) this.stream.emitParticleAt(FW_X + 16, packetY(p) + Math.random() * PKT_H, 1);
      this.emitted.set(p.id, target);
    }
  }
}

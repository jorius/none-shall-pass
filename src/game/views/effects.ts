// packages
import Phaser from 'phaser';

// core
import { FW_X, PKT_H, PKT_W, RACK_TARGET } from '../../core/constants';
import type { RunEvent } from '../../core/events';
import { CSS, HEX } from '../../core/palette';
import type { Run } from '../../core/run';
import { packetY } from '../../core/state';

// game
import type { FieldScene } from '../FieldScene';
import type { View } from '../view';

const GLYPHS = "01<>/'=;%(){}";
const COLORS: Record<string, string> = { ink: CSS.ink, red: CSS.red, blue: CSS.blue, gold: CSS.gold, brick: '#a8432a', cyan: '#8fdcff' };
const PALETTES: Record<string, string[]> = {
  knight: ['ink', 'ink', 'red', 'blue'], rule: ['blue', 'blue', 'ink'], squire: ['gold', 'ink', 'ink'], lockdown: ['red', 'brick', 'ink'], stream: ['ink', 'ink', 'cyan'],
};

// Extra 0s and 1s weight the pick so about three glyphs in four are binary, as in the mock.
const BITS = '01'.repeat(16);
const frames = (palette: string[]): string[] => palette.flatMap((c) => [...GLYPHS, ...BITS].map((g) => `${c}:${g}`));

// Spears in flight, packets shattering into binary, and the glyphs a burning packet streams into the rack.
export class EffectsView implements View {
  private readonly shatter: Record<string, Phaser.GameObjects.Particles.ParticleEmitter> = {};
  private readonly stream: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly emitted = new Map<number, number>();

  constructor(private readonly scene: FieldScene) {
    this.buildGlyphs();
    const fx = scene.layers.fx;
    for (const [name, pal] of Object.entries(PALETTES)) {
      if (name === 'stream') continue;
      const em = scene.add.particles(0, 0, 'glyphs', {
        frame: frames(pal), emitting: false, lifespan: { min: 520, max: 1000 }, speed: { min: 40, max: 230 }, angle: { min: 0, max: 360 },
        accelerationX: -90, rotate: { min: -180, max: 180 }, alpha: { start: 1, end: 0 }, scale: { min: 0.42, max: 0.62 },
      });
      // A random point on the card (a Geom.Rectangle does the same, but its typing doesn't fit the zone's).
      em.addEmitZone({ type: 'random', source: { getRandomPoint: (pt) => { pt.x = Math.random() * PKT_W; pt.y = Math.random() * PKT_H; } } });
      fx.add(em);
      this.shatter[name] = em;
    }
    this.stream = scene.add.particles(0, 0, 'glyphs', {
      frame: frames(PALETTES.stream), emitting: false, lifespan: { min: 380, max: 640 },
      moveToX: { min: RACK_TARGET.x0, max: RACK_TARGET.x1 }, moveToY: { min: RACK_TARGET.y0, max: RACK_TARGET.y1 },
      alpha: { start: 1, end: 0.15 }, scale: { start: 0.55, end: 0.25 },
    });
    fx.add(this.stream);
  }

  // The switch itself lives on the scene, where the rack reads it too; the pause menu and main.ts set it here.
  get reduced(): boolean { return this.scene.reduced; }
  set reduced(on: boolean) { this.scene.reduced = on; }

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
    for (const em of [...Object.values(this.shatter), this.stream]) { if (p) em.pause(); else em.resume(); }
  }

  start(): void {
    this.emitted.clear();
  }

  event(ev: RunEvent): void {
    if (ev.type === 'shattered') {
      const p = ev.packet, y = packetY(p);
      const pal = ev.by === 'rule' ? (ev.ruleId === 'lockdown' ? 'lockdown' : 'rule') : ev.by;
      // The charge has no palette of its own yet, so its kills burst in the knight's colours.
      (this.shatter[pal] ?? this.shatter.knight).explode(this.reduced ? 18 : 56, p.x, y);
      const box = this.scene.add.rectangle(p.x, y, PKT_W, PKT_H, HEX.ink, 0.75).setOrigin(0, 0);
      this.scene.layers.fx.add(box);
      this.scene.tweens.add({ targets: box, alpha: 0, duration: 140, onComplete: () => box.destroy() });
    }
    if (ev.type === 'thrown') this.spear(ev.from, ev.to, ev.duration, ev.by === 'squire');
    if (ev.type === 'consumed') this.emitted.delete(ev.packetId);
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

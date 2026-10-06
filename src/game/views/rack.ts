// packages
import Phaser from 'phaser';

// core
import { RACK } from '../../core/constants';
import type { RunEvent } from '../../core/events';
import type { Run } from '../../core/run';
import type { MaliciousKind } from '../../core/types';

// art
import { BUG_OF, rackSprite } from '../../art/sprites';

// game
import type { FieldScene } from '../FieldScene';
import type { View } from '../view';

const FW = 40, FH = RACK.rows + 2, MAX = 13;
const FIRE: (number[] | null)[] = [null, [40, 10, 6, 70], [60, 16, 7, 110], [80, 22, 7, 150], [100, 30, 7, 180], [120, 38, 7, 200], [143, 47, 7, 220],
  [170, 60, 7, 235], [199, 76, 7, 245], [223, 90, 7, 250], [235, 115, 15, 255], [228, 160, 31, 255], [242, 196, 75, 255], [255, 236, 170, 255]];

// The server: a full-height pixel rack that burns floor by floor as uptime drops.
export class RackView implements View {
  private readonly box: Phaser.GameObjects.Container;
  private readonly rack: Phaser.GameObjects.Image;
  private readonly leds: { r: Phaser.GameObjects.Rectangle; color: number; phase: number }[] = [];
  private readonly fireTex: Phaser.Textures.CanvasTexture;
  private readonly fireData: ImageData;
  private readonly cells = new Uint8Array(FW * FH);
  private readonly floors: number[];
  private readonly bugs: { s: Phaser.GameObjects.Sprite; kind: string; x: number; y: number; phase: number }[] = [];
  private lastFire = -Infinity;
  private uptime = 100;
  private flashing = false;
  private paused = false;

  constructor(private readonly scene: FieldScene) {
    this.box = scene.add.container(RACK.x, RACK.y);
    scene.layers.actors.add(this.box);
    this.rack = scene.add.image(0, 0, 'rack').setOrigin(0, 0);
    this.box.add(this.rack);
    const sprite = rackSprite(RACK.rows);
    sprite.leds.forEach(([x, y, c], i) => {
      const color = c === 'green' ? 0x3ddc84 : 0x2fb6ff;
      const r = scene.add.rectangle(x * 3, y * 3, 3, 3, color).setOrigin(0, 0);
      this.box.add(r);
      this.leds.push({ r, color, phase: (i * 0.37) % 1.3 });
    });
    this.floors = [RACK.rows - 4, ...sprite.units.map((y) => y + 6).reverse()];
    this.fireTex = scene.textures.createCanvas('rackfire', FW, FH)!;
    this.fireTex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.fireData = this.fireTex.getContext().createImageData(FW, FH);
    this.box.add(scene.add.image(0, 0, 'rackfire').setOrigin(0, 0).setScale(3));
  }

  pause(p: boolean): void {
    this.paused = p;
  }

  start(): void {
    this.cells.fill(0);
    this.uptime = 100;
    this.clearBugs();
  }

  private clearBugs(): void {
    for (const b of this.bugs) b.s.destroy();
    this.bugs.length = 0;
  }

  event(ev: RunEvent): void {
    if (ev.type === 'uptime') this.uptime = ev.after;
    if (ev.type === 'waveStarted') this.clearBugs();
    if (ev.type === 'resolved' && ev.outcome === 'breach') {
      this.tint(0xff7070);
      // The bounce is the shake reduced effects do without; the flash and the bugs stay.
      if (!this.scene.reduced) this.scene.tweens.add({ targets: this.box, x: { from: RACK.x - 5, to: RACK.x }, duration: 300, ease: 'Bounce.easeOut' });
      this.infest(ev.packet.t.kind as MaliciousKind);
    }
    if (ev.type === 'resolved' && ev.outcome === 'neutralized') this.tint(0x9fdcff);
  }

  // A breach or a neutralization flashes the rack; the char tint resumes afterwards.
  private tint(color: number): void {
    this.flashing = true;
    this.rack.setTint(color);
    this.scene.time.delayedCall(320, () => { this.flashing = false; });
  }

  private infest(kind: MaliciousKind): void {
    if (this.bugs.length >= 6) this.bugs.shift()!.s.destroy();
    const bug = BUG_OF[kind];
    const s = this.scene.add.sprite(0, 0, `bug-${bug}-0`);
    this.box.add(s);
    this.bugs.push({ s, kind: bug, x: 20 + Math.random() * 80, y: 40 + Math.random() * 360, phase: Math.random() * Math.PI * 2 });
  }

  frame(_run: Run | null, _dt: number, time: number): void {
    if (this.paused) return;
    const low = this.uptime < 35;
    for (const l of this.leds) {
      const on = Math.floor((time + l.phase) / (low ? 0.2 : 0.55)) % 2 === 0;
      l.r.setFillStyle(low ? 0xff2f2f : l.color, on ? 1 : 0.2);
    }
    for (const b of this.bugs) {
      const a = time * 1.6 + b.phase;
      b.s.setPosition(b.x + Math.cos(a) * 14, b.y + Math.sin(a * 1.3) * 22).setRotation(a);
      b.s.setTexture(`bug-${b.kind}-${Math.floor(time / 0.12) % 2}`);
    }
    // The fire steps at 30 Hz on the view clock, which keeps running outside play (drafts, debrief)
    // and stops while paused, so it burns at the same speed on any screen and any refresh rate.
    if (time - this.lastFire >= 1 / 30 - 1e-6) { this.lastFire = Math.max(this.lastFire + 1 / 30, time - 1 / 30); this.stepFire(); }
  }

  private stepFire(): void {
    const c = this.cells, dmg = 1 - this.uptime / 100;
    const decayMax = dmg < 0.25 ? 3 : dmg < 0.6 ? 2 : 1;
    for (let x = 0; x < FW; x++) for (let y = 1; y < FH; y++) {
      const src = y * FW + x, v = c[src];
      if (!v) { c[src - FW] = 0; continue; }
      const r = Math.floor(Math.random() * 3);
      const dst = Math.max(FW, Math.min(FW * FH - 1, src - r + 1));
      c[dst - FW] = Math.max(0, v - Math.floor(Math.random() * (decayMax + 1)));
    }
    for (let x = 0; x < FW; x++) c[(FH - 1) * FW + x] = 0;
    if (dmg >= 0.08) {
      const floors = Math.min(this.floors.length, 1 + Math.floor(((dmg - 0.08) / 0.92) * this.floors.length));
      const w = Math.round(10 + dmg * 28), x0 = Math.round((FW - w) / 2);
      for (let i = 0; i < floors; i++) {
        const row = this.floors[i];
        for (let x = x0 + ((i * 7) % 9) - 4; x < x0 + w + ((i * 5) % 7) - 3; x++) if (x >= 0 && x < FW && Math.random() < 0.75) c[row * FW + x] = MAX - (i % 2);
      }
    }
    const d = this.fireData.data;
    for (let i = 0; i < c.length; i++) {
      const col = FIRE[c[i]], o = i * 4;
      if (col) { d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = col[3]; } else d[o + 3] = 0;
    }
    this.fireTex.getContext().putImageData(this.fireData, 0, 0);
    this.fireTex.refresh();
    if (!this.flashing) {
      const v = Math.round(255 * (1 - dmg * 0.5));
      this.rack.setTint(Phaser.Display.Color.GetColor(v, Math.round(v * 0.95), Math.round(v * 0.9)));
    }
  }
}

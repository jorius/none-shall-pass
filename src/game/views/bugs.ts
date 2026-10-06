// packages
import type Phaser from 'phaser';

// core
import { HEX } from '../../core/palette';
import { mulberry32, type Rng } from '../../core/rng';

// art
import type { BugKind } from '../../art/sprites';

// game
import type { FieldScene } from '../FieldScene';

// Seconds a crawler takes around the card; the flyers never lap.
export const LAP_SECS: Record<BugKind, number> = { spider: 7, beetle: 9, worm: 16, fly: 0, gnat: 0 };
const MAX_BITES = 6, SEGMENTS = 9, BITE_W = 7, BITE_H = 5;
// A fly's dart between two spots, and the share of a stay a gnat sits out.
const DART = 0.3, GNAT_STAY = 0.4;

export interface Spot { x: number; y: number; stay: number }

// One lap of the card's edge, clockwise from the top-left corner: `u` is the progress in laps, and it wraps.
// The rotation points the sprite's top away from the card, so a crawler straddles the rim as it goes.
export const bugPath = (_kind: BugKind, u: number, w: number, h: number): { x: number; y: number; rot: number } => {
  const per = 2 * (w + h), d = ((u % 1) + 1) % 1 * per;
  if (d < w) return { x: d, y: 0, rot: 0 };
  if (d < w + h) return { x: w, y: d - w, rot: Math.PI / 2 };
  if (d < 2 * w + h) return { x: w - (d - w - h), y: h, rot: Math.PI };
  return { x: 0, y: h - (d - 2 * w - h), rot: -Math.PI / 2 };
};

// Five spots a fly lands on: around the frame and across the payload, with a stay of 1–2 s each.
export const flyPlan = (seed: number, w: number, h: number): Spot[] => {
  const rng = mulberry32(seed);
  const spots = [{ x: rng() * w, y: -10 }, { x: w + 8, y: rng() * h }, { x: rng() * w, y: h + 6 }, { x: -10, y: rng() * h }, { x: 40 + rng() * (w - 80), y: 14 + rng() * (h - 28) }];
  return spots.map((s) => ({ ...s, stay: 1 + rng() }));
};

// One bug on one card: its sprite (or the worm's segments), the bites it has taken, and a fly's itinerary.
// It lives inside the card's box, so it rides with the card; the view frames it on the view clock and destroys it with the card.
export class BugRig {
  bites = 0;
  private readonly parts: Phaser.GameObjects.Image[] = [];
  private readonly marks: Phaser.GameObjects.Rectangle[] = [];
  private readonly plan: Spot[];
  private readonly phase: number;
  private readonly rng: Rng;
  // The view clock at the rig's first frame (it is far from zero by then), the lap whose bite is pending, and when in laps it falls.
  private born: number | null = null;
  private lap = 0;
  private nextBite: number;
  private flyFrom = { x: 0, y: 0 }; private flyT = 0; private flyIdx = 0;

  constructor(private readonly scene: FieldScene, private readonly box: Phaser.GameObjects.Container, readonly kind: BugKind,
    private readonly w: number, private readonly h: number, seed: number, private readonly onBite: (x: number, y: number) => void) {
    this.phase = (seed % 1000) / 1000;
    // One seed serves both itineraries: the flyers never bite and the crawlers never land.
    this.plan = flyPlan(seed, w, h);
    this.rng = mulberry32(seed);
    // The first bite waits out the first quarter lap, so a fresh card stays clean for a moment.
    this.nextBite = 0.25 + this.rng() * 0.75;
    const n = kind === 'worm' ? SEGMENTS : 1;
    for (let i = 0; i < n; i++) {
      const key = kind === 'worm' ? (i === 0 ? 'worm-head' : i === n - 1 ? 'worm-tail' : 'worm-body') : `bug-${kind}-0`;
      const img = scene.add.image(0, 0, key);
      box.add(img);
      this.parts.push(img);
    }
  }

  // A bite stays on the frame: a paper-coloured notch across the edge that reads as missing card.
  // It goes right above the card (the box's first child) and under the bug, which crawls over its own bites.
  private bite(x: number, y: number): void {
    if (this.bites >= MAX_BITES) return;
    const vertical = x <= 0 || x >= this.w;
    const m = this.scene.add.rectangle(x, y, vertical ? BITE_H : BITE_W, vertical ? BITE_W : BITE_H, HEX.paper).setOrigin(0.5, 0.5);
    this.box.addAt(m, 1);
    this.marks.push(m);
    this.bites++;
    this.onBite(x, y);
  }

  // `time` is the view clock, which stops with a pause; the rig keeps its own age from its first frame.
  frame(time: number, dt: number, reduced: boolean): void {
    this.born ??= time;
    const age = time - this.born;
    if (this.kind === 'fly' || this.kind === 'gnat') { this.flyFrame(age, dt, reduced); return; }
    const laps = age / LAP_SECS[this.kind], u = laps + this.phase;
    const lead = bugPath(this.kind, u, this.w, this.h);
    // The worm's head sprite faces left, so it turns half round to lead; the segments trail it along the path and slither sideways.
    const turn = this.kind === 'worm' ? Math.PI : 0;
    this.parts.forEach((img, i) => {
      const p = i === 0 ? lead : bugPath(this.kind, u - i * 0.012, this.w, this.h);
      const sway = this.kind === 'worm' ? Math.sin(age * 7 - i * 0.9) * 2.5 : 0;
      const nx = Math.cos(p.rot + Math.PI / 2), ny = Math.sin(p.rot + Math.PI / 2);
      img.setPosition(p.x + nx * sway, p.y + ny * sway).setRotation(p.rot + turn);
      if (this.kind !== 'worm') img.setTexture(`bug-${this.kind}-${Math.floor(age / 0.12) % 2}`);
    });
    // One bite a lap, where the head is when the lap's moment comes; the dice pick the moment, so the spots spread around the frame.
    // Laps spent at the limit are skipped, not caught up on, if the limit ever rises.
    const limit = reduced ? 2 : MAX_BITES;
    if (laps >= this.nextBite && this.bites < limit) {
      this.bite(lead.x, lead.y);
      this.lap = Math.max(this.lap, Math.floor(laps)) + 1;
      this.nextBite = this.lap + this.rng();
    }
  }

  // The darts run on the simulation's dt, so a fly holds still whenever the packets do; the twitch and the wings on the rig's age.
  private flyFrame(age: number, dt: number, reduced: boolean): void {
    const img = this.parts[0];
    const spot = this.plan[this.flyIdx % this.plan.length];
    // Reduced effects: it sits on its spot, wings still.
    if (reduced) { img.setPosition(spot.x, spot.y).setTexture(`bug-${this.kind}-0`); return; }
    this.flyT += dt;
    const total = DART + spot.stay * (this.kind === 'gnat' ? GNAT_STAY : 1);
    if (this.flyT >= total) { this.flyT = 0; this.flyFrom = { x: spot.x, y: spot.y }; this.flyIdx++; return; }
    const k = Math.min(1, this.flyT / DART), ease = 1 - (1 - k) * (1 - k);
    const x = this.flyFrom.x + (spot.x - this.flyFrom.x) * ease, y = this.flyFrom.y + (spot.y - this.flyFrom.y) * ease;
    // Landed, it twitches and flicks its wings; in the air the housefly's wings blur (the gnat, with no blur frame, flies on its up-stroke).
    const twitch = k >= 1 ? Math.sin(age * 40) * 0.6 : 0;
    const key = k < 1 ? (this.kind === 'fly' ? 'bug-fly-wing' : `bug-${this.kind}-1`) : `bug-${this.kind}-${Math.floor(age / 0.08) % 2}`;
    img.setPosition(x + twitch, y).setTexture(key);
  }

  // Nothing of the rig shows past the fire: parts and bites at a local x of `limit` or more hide.
  clip(limit: number): void {
    for (const o of this.parts) o.setVisible(o.x < limit);
    for (const o of this.marks) o.setVisible(o.x < limit);
  }

  destroy(): void {
    for (const o of this.parts) o.destroy();
    for (const o of this.marks) o.destroy();
  }
}

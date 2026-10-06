// packages
import Phaser from 'phaser';

// core
import { FIELD_TOP, FW_X, PKT_H, PKT_W } from '../../core/constants';
import type { RunEvent } from '../../core/events';
import { CSS } from '../../core/palette';
import { isBugged } from '../../core/rules';
import type { Run } from '../../core/run';
import { packetY, type Packet } from '../../core/state';

// art
import { BUG_OF, type BugKind } from '../../art/sprites';

// i18n
import { t } from '../../i18n';

// stage
import { RENDER_SCALE } from '../../stage';

// game
import { CARD_TEX_H, CARD_TEX_W, drawCard, targetColor, type CardState } from '../cards';
import type { FieldScene } from '../FieldScene';
import type { View } from '../view';

const PORT_LABEL = [':22', '/login', '/search', '/comments', ':*'];
const POOL = 48;

// Cards sit on whole device pixels, so the 2x canvas is drawn 1:1 and never resampled.
const snap = (v: number): number => Math.round(v * RENDER_SCALE) / RENDER_SCALE;

interface Visual { slot: number; box: Phaser.GameObjects.Container; img: Phaser.GameObjects.Image; bugs: { s: Phaser.GameObjects.Sprite; kind: BugKind; path: number; phase: number }[]; key: string }

// Bug paths around a card (local coords): along the top, along the bottom, a worm's wiggle, a fly's buzz.
const bugPose = (kind: BugKind, path: number, time: number, phase: number): { x: number; y: number; rot: number; flip: boolean } => {
  if (kind === 'fly' || kind === 'gnat') {
    const a = time * (path ? 6.1 : 7.3) + phase;
    return { x: (path ? 40 : 250) + Math.sin(a) * 14, y: -10 + Math.cos(a * 1.3) * 20, rot: Math.sin(a * 0.7) * 0.4, flip: false };
  }
  const u = ((time / (path ? 6.5 : 5)) + phase) % 1;
  const out = u < 0.5, k = out ? u / 0.5 : (u - 0.5) / 0.5;
  const x = out ? 8 + k * 242 : 250 - k * 242;
  if (kind === 'worm') return { x, y: -6, rot: 0, flip: !out };
  return { x: path ? 258 - x : x, y: path ? 52 : -10, rot: (out !== !!path ? 1 : -1) * Math.PI / 2, flip: false };
};

// Packet cards on pooled 2x canvases, the bugs that crawl on them, and the target brackets.
export class PacketsView implements View {
  private readonly visuals = new Map<number, Visual>();
  private readonly free: number[] = Array.from({ length: POOL }, (_, i) => i);
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly tag: Phaser.GameObjects.Text;
  private hovered: number | null = null;
  private raised: number | null = null;
  private run: Run | null = null;

  constructor(private readonly scene: FieldScene, private readonly intents: { target(id: number | null): void; hover(p: Packet | null): void }) {
    for (let i = 0; i < POOL; i++) scene.textures.createCanvas(`card-${i}`, CARD_TEX_W, CARD_TEX_H);
    this.overlay = scene.add.graphics();
    this.tag = scene.add.text(0, 0, t('actor.target'), { fontFamily: 'Space Mono', fontSize: '13px', fontStyle: '700', color: CSS.ink, backgroundColor: CSS.red, padding: { x: 6, y: 0 }, resolution: RENDER_SCALE }).setVisible(false);
    scene.layers.packets.add([this.overlay, this.tag]);
    scene.input.on('pointermove', (ptr: Phaser.Input.Pointer) => this.onMove(ptr));
    scene.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => this.onDown(ptr));
    // A quick flick can go from a card straight onto a DOM panel with no move over the canvas in between.
    scene.input.on('gameout', () => { if (this.hovered !== null) { this.hovered = null; this.intents.hover(null); } });
  }

  // The card drawn on top under the pointer: hits follow the display order, so a click lands on
  // what the player sees. Doomed cards let the click through; the core would refuse them anyway.
  private at(ptr: Phaser.Input.Pointer): Packet | null {
    const x = ptr.worldX, y = ptr.worldY - FIELD_TOP, layer = this.scene.layers.packets;
    let top: Packet | null = null, best = -1;
    for (const p of this.run?.state.packets ?? []) {
      const v = this.visuals.get(p.id);
      if (!v || p.dead || p.entering || p.doomed || x < p.x || x > p.x + PKT_W || y < packetY(p) || y > packetY(p) + PKT_H) continue;
      const i = layer.getIndex(v.box);
      if (i > best) { best = i; top = p; }
    }
    return top;
  }

  private onMove(ptr: Phaser.Input.Pointer): void {
    const p = this.at(ptr);
    if ((p?.id ?? null) !== this.hovered) { this.hovered = p?.id ?? null; this.intents.hover(p); }
  }

  private onDown(ptr: Phaser.Input.Pointer): void {
    if (!this.run || this.run.state.phase !== 'playing') return;
    const p = this.at(ptr);
    this.intents.target(p && this.run.state.locked !== p.id ? p.id : null);
  }

  start(run: Run): void {
    this.run = run;
    // In root mode the tag inverts, dark on the bright target colour, so its label stays readable through the amber matrix.
    const root = run.state.cfg.root;
    this.tag.setBackgroundColor(targetColor(root)).setColor(root ? CSS.paper : CSS.ink);
    this.hovered = null;
    this.raised = null;
    for (const id of [...this.visuals.keys()]) this.drop(id);
  }

  refresh(): void {
    for (const v of this.visuals.values()) v.key = '';
    this.tag.setText(t('actor.target'));
  }

  event(ev: RunEvent, run: Run): void {
    if (ev.type === 'spawned') this.create(ev.packet, run);
    if (ev.type === 'shattered') this.drop(ev.packet.id);
    if (ev.type === 'consumed') this.drop(ev.packetId);
    if (ev.type === 'owned') this.refresh();
  }

  private create(p: Packet, run: Run): void {
    const slot = this.free.shift();
    if (slot === undefined) return;
    const layer = this.scene.layers.packets;
    const img = this.scene.add.image(0, 0, `card-${slot}`).setOrigin(0, 0).setScale(1 / 2);
    // One box per packet holds its card and its bugs; the name lets the smoke test read the stacking.
    const box = this.scene.add.container(snap(p.x), packetY(p), [img]).setName(`packet-${p.id}`);
    // Newest on top, as in the mock, but under the locked card, the brackets and the tag.
    const raised = this.raised !== null ? this.visuals.get(this.raised)?.box : undefined;
    layer.addAt(box, layer.getIndex(raised ?? this.overlay));
    const bugs: Visual['bugs'] = [];
    if (isBugged(p.t, run.state.owned)) {
      const kind = BUG_OF[p.t.kind as Exclude<typeof p.t.kind, 'legit'>];
      const count = p.t.tier === 1 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const s = this.scene.add.sprite(0, 0, `bug-${kind}-0`);
        box.add(s);
        bugs.push({ s, kind, path: i, phase: Math.random() });
      }
    }
    this.visuals.set(p.id, { slot, box, img, bugs, key: '' });
  }

  private drop(id: number): void {
    const v = this.visuals.get(id);
    if (!v) return;
    v.box.destroy();
    this.free.push(v.slot);
    this.visuals.delete(id);
    if (this.hovered === id) { this.hovered = null; this.intents.hover(null); }
  }

  // Spawn order with the locked card raised above the rest, like the mock's z-index.
  private restack(): void {
    const layer = this.scene.layers.packets;
    let i = 0;
    for (const [id, v] of this.visuals) if (id !== this.raised) layer.moveTo(v.box, i++);
    const top = this.raised !== null ? this.visuals.get(this.raised) : undefined;
    if (top) layer.moveTo(top.box, i);
  }

  private paint(p: Packet, v: Visual, run: Run): void {
    const s = run.state;
    const state: CardState = s.locked === p.id ? 'locked' : p.doomed ? 'locked' : this.hovered === p.id ? 'hover' : p.slowed ? 'slowed' : 'idle';
    const lens = s.owned.includes('lens') && !!p.t.decoded;
    const key = `${state}|${s.hints}|${lens}|${t('inspector.decoded')}`;
    if (key === v.key) return;
    v.key = key;
    const tex = this.scene.textures.get(`card-${v.slot}`) as Phaser.Textures.CanvasTexture;
    drawCard(tex.getContext(), {
      src: p.src, port: PORT_LABEL[p.lane], text: lens ? p.t.decoded! : p.t.card,
      hints: (lens ? p.t.decodedHints ?? p.t.hints : p.t.hints) ?? [], hintsOn: s.hints, decodedTag: lens ? t('inspector.decoded') : null, state, root: s.cfg.root,
    });
    tex.refresh();
  }

  // One bracket: an arm's end, the corner, the other arm's end. (strokePoints is typed for Vector2 only.)
  private corner(x0: number, y0: number, cx: number, cy: number, x1: number, y1: number): void {
    const g = this.overlay;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(cx, cy);
    g.lineTo(x1, y1);
    g.strokePath();
  }

  frame(run: Run | null, _dt: number, time: number): void {
    this.overlay.clear();
    this.tag.setVisible(false);
    if (!run) return;
    // The console's skip clears the field without a per-packet event; free whatever it left behind.
    for (const id of this.visuals.keys()) if (!run.state.packets.some((p) => p.id === id)) this.drop(id);
    if (run.state.locked !== this.raised) { this.raised = run.state.locked; this.restack(); }
    for (const p of run.state.packets) {
      const v = this.visuals.get(p.id);
      if (!v) continue;
      const x = snap(p.x);
      this.paint(p, v, run);
      v.box.setPosition(x, packetY(p));
      v.img.setCrop(0, 0, p.entering ? Math.max(0, (FW_X - x) * 2) : CARD_TEX_W, CARD_TEX_H);
      for (const b of v.bugs) {
        const pose = bugPose(b.kind, b.path, time, b.phase);
        b.s.setPosition(pose.x, pose.y).setRotation(pose.rot).setFlipX(pose.flip);
        b.s.setTexture(`bug-${b.kind}-${Math.floor(time / 0.12) % 2}`);
        b.s.setVisible(x + pose.x < FW_X);
      }
    }
    const locked = run.state.locked !== null ? run.state.packets.find((p) => p.id === run.state.locked) : undefined;
    if (!locked) return;
    const x = snap(locked.x), y = packetY(locked), r = Math.floor(time / 0.25) % 2 ? 20 : 16;
    this.overlay.lineStyle(3, parseInt(targetColor(run.state.cfg.root).slice(1), 16), 1);
    this.corner(x - 9, y - 9 + r, x - 9, y - 9, x - 9 + r, y - 9);
    this.corner(x + PKT_W + 9 - r, y + PKT_H + 9, x + PKT_W + 9, y + PKT_H + 9, x + PKT_W + 9, y + PKT_H + 9 - r);
    this.tag.setPosition(x, y - 19).setVisible(true);
  }
}

// packages
import Phaser from 'phaser';

// core
import { FIELD_H, KN_X, SQUIRE_POS } from '../../core/constants';
import type { KnightId } from '../../core/content/knights';
import type { RunEvent } from '../../core/events';
import { CSS } from '../../core/palette';
import type { Run } from '../../core/run';
import { knightY, mounted, type KnightState } from '../../core/state';

// art
import { knightKey, type KnightPose } from '../../art/sprites';

// i18n
import { t } from '../../i18n';

// stage
import { RENDER_SCALE } from '../../stage';

// game
import type { FieldScene } from '../FieldScene';
import type { View } from '../view';
import type { EffectsView } from './effects';

// Seconds between the dust bursts a galloping horse kicks up, on the view clock.
const DUST_GAP = 0.08;

const label = (scene: FieldScene, text: string, bg: string): Phaser.GameObjects.Text =>
  scene.add.text(0, 0, text, { fontFamily: 'Space Mono', fontSize: '13px', fontStyle: '700', color: CSS.paper, backgroundColor: bg, padding: { x: 5, y: 0 }, resolution: RENDER_SCALE }).setOrigin(0.5, 0);

// The knight the player picked, in whichever pose the core's state calls for, and the squire at his post.
export class ActorsView implements View {
  private readonly knight: Phaser.GameObjects.Image;
  private readonly you: Phaser.GameObjects.Text;
  private readonly squire: Phaser.GameObjects.Image;
  private readonly squireLabel: Phaser.GameObjects.Text;
  private id: KnightId = 'black';
  private charging = false;
  private dustAt = 0;

  constructor(scene: FieldScene, private readonly effects: EffectsView) {
    const layer = scene.layers.actors;
    this.knight = scene.add.image(KN_X, knightY(2, false), knightKey('black', 'foot-idle')).setOrigin(0, 0);
    this.you = label(scene, t('actor.you'), CSS.ink);
    this.squire = scene.add.image(SQUIRE_POS.x, SQUIRE_POS.y, 'squire-idle').setOrigin(0, 0).setVisible(false);
    // Above his head, clear of the uptime strip below and of the knight's spear on the same lane.
    this.squireLabel = label(scene, t('actor.squire'), CSS.gold).setOrigin(0, 1).setPosition(SQUIRE_POS.x - 4, SQUIRE_POS.y - 2).setVisible(false);
    layer.add([this.squire, this.squireLabel, this.knight, this.you]);
  }

  refresh(): void {
    this.you.setText(t('actor.you'));
    this.squireLabel.setText(t('actor.squire'));
  }

  start(run: Run): void {
    this.id = run.state.cfg.knight;
    this.charging = false;
  }

  event(ev: RunEvent): void {
    if (ev.type === 'chargeStarted') { this.charging = true; this.dustAt = 0; }
    // The core puts him back at his post the moment a gallop ends, or the run does, so the sprite goes there too.
    if (ev.type === 'chargeEnded' || ev.type === 'runEnded') { this.charging = false; this.knight.setX(KN_X); }
  }

  frame(run: Run | null, _dt: number, time: number): void {
    const s = run?.state;
    const k: Omit<KnightState, 'lane' | 'cooldown'> = s?.knight ?? { x: KN_X, y: knightY(2, false), moving: false, throwT: 0, facing: 'left', charge: { t: 0, used: false } };
    const horse = s ? mounted(s) : false;
    const ended = s?.phase === 'ended';
    const won = ended && s.endReason === 'won';
    // A gallop flips the leg frames faster than a walk; the run's end dismounts him to kneel or to cheer.
    const pose: KnightPose = ended ? (won ? 'cheer' : 'down')
      : horse ? (k.throwT > 0 ? 'horse-throw' : k.moving ? (Math.floor(time / (k.charge.t > 0 ? 0.07 : 0.11)) % 2 ? 'horse-1' : 'horse-0') : 'horse-0')
      : k.throwT > 0 ? 'foot-throw' : 'foot-idle';
    // The cheer hops (reduced effects keep him planted), a kneeling knight stays on his knee, and an idle one on his feet breathes.
    const bob = ended ? (won && !this.effects.reduced ? -Math.abs(Math.sin(time * 6)) * 10 : 0) : !k.moving && k.throwT === 0 ? (Math.floor(time / 0.5) % 2 ? -3 : 0) : 0;
    // On foot for the end poses: the lane's own height, not the saddle's or wherever a walk was cut short.
    const y = ended && s ? knightY(s.knight.lane, false) : k.y;
    this.knight.setTexture(knightKey(this.id, pose)).setPosition(k.x, y + bob).setFlipX(k.moving && k.facing === 'right');
    // On the bottom lane the tag rides up over his feet instead of slipping under the uptime strip.
    this.you.setPosition(k.x + this.knight.displayWidth / 2, Math.min(y + this.knight.displayHeight - 4, FIELD_H - this.you.displayHeight));
    if (this.charging && k.charge.t > 0 && time >= this.dustAt) { this.dustAt = time + DUST_GAP; this.dust(k.x, y, k.facing); }
    const hasSquire = !!s?.owned.includes('squire');
    this.squire.setVisible(hasSquire).setTexture(s && s.squire.throwT > 0 ? 'squire-throw' : 'squire-idle');
    this.squireLabel.setVisible(hasSquire);
  }

  // A puff at the hooves on the side the horse is leaving; reduced effects ask for none.
  private dust(x: number, y: number, facing: 'left' | 'right'): void {
    const w = this.knight.displayWidth, h = this.knight.displayHeight;
    this.effects.crumbs(facing === 'left' ? x + w - 12 : x + 12, y + h - 8, this.effects.reduced ? 0 : 3);
  }
}

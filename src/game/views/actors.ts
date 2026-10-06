// packages
import Phaser from 'phaser';

// core
import { FIELD_H, KN_X, SQUIRE_POS } from '../../core/constants';
import { CSS } from '../../core/palette';
import type { Run } from '../../core/run';
import { knightY, mounted } from '../../core/state';

// art
import { knightKey, type KnightPose } from '../../art/sprites';

// i18n
import { t } from '../../i18n';

// stage
import { RENDER_SCALE } from '../../stage';

// game
import type { FieldScene } from '../FieldScene';
import type { View } from '../view';

const label = (scene: FieldScene, text: string, bg: string): Phaser.GameObjects.Text =>
  scene.add.text(0, 0, text, { fontFamily: 'Space Mono', fontSize: '13px', fontStyle: '700', color: CSS.paper, backgroundColor: bg, padding: { x: 5, y: 0 }, resolution: RENDER_SCALE }).setOrigin(0.5, 0);

export class ActorsView implements View {
  private readonly knight: Phaser.GameObjects.Image;
  private readonly you: Phaser.GameObjects.Text;
  private readonly squire: Phaser.GameObjects.Image;
  private readonly squireLabel: Phaser.GameObjects.Text;

  constructor(scene: FieldScene) {
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

  frame(run: Run | null, _dt: number, time: number): void {
    const s = run?.state;
    const k = s?.knight ?? { x: KN_X, y: knightY(2, false), moving: false, throwT: 0, facing: 'left' as const };
    const horse = s ? mounted(s) : false;
    const pose: KnightPose = horse
      ? k.throwT > 0 ? 'horse-throw' : k.moving ? (Math.floor(time / 0.11) % 2 ? 'horse-1' : 'horse-0') : 'horse-0'
      : k.throwT > 0 ? 'foot-throw' : 'foot-idle';
    const bob = !k.moving && k.throwT === 0 && Math.floor(time / 0.5) % 2 ? -3 : 0;
    this.knight.setTexture(knightKey('black', pose)).setPosition(k.x, k.y + bob).setFlipX(k.moving && k.facing === 'right');
    // On the bottom lane the tag rides up over his feet instead of slipping under the uptime strip.
    this.you.setPosition(k.x + this.knight.displayWidth / 2, Math.min(k.y + this.knight.displayHeight - 4, FIELD_H - this.you.displayHeight));
    const hasSquire = !!s?.owned.includes('squire');
    this.squire.setVisible(hasSquire).setTexture(s && s.squire.throwT > 0 ? 'squire-throw' : 'squire-idle');
    this.squireLabel.setVisible(hasSquire);
  }
}

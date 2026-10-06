// packages
import Phaser from 'phaser';

// core
import { FW_X, LANE_COUNT, LANE_H, LANE_X0 } from '../../core/constants';
import { HEX } from '../../core/palette';
import { destrierLevel } from '../../core/rules';
import type { Run } from '../../core/run';

// game
import type { FieldScene } from '../FieldScene';
import type { View } from '../view';

export class LanesView implements View {
  private readonly highlight: Phaser.GameObjects.Container;
  private readonly slow: Phaser.GameObjects.Rectangle;
  private readonly flows: Phaser.GameObjects.TileSprite[] = [];

  constructor(scene: FieldScene) {
    const back = scene.layers.back;
    const g = scene.add.graphics();
    g.fillStyle(HEX.mute, 1);
    for (let i = 1; i <= LANE_COUNT; i++) for (let x = LANE_X0; x < FW_X; x += 8) g.fillRect(x, i * LANE_H - 1, 4, 1);
    back.add(g);
    // The current lane: a faint wash with hairline top and bottom edges, as in the mock.
    this.highlight = scene.add.container(0, 0, [
      scene.add.rectangle(LANE_X0, 0, FW_X - LANE_X0, LANE_H, HEX.ink, 0.045).setOrigin(0, 0),
      scene.add.rectangle(LANE_X0, 0, FW_X - LANE_X0, 1, HEX.ink, 0.12).setOrigin(0, 0),
      scene.add.rectangle(LANE_X0, LANE_H - 1, FW_X - LANE_X0, 1, HEX.ink, 0.12).setOrigin(0, 0),
    ]);
    back.add(this.highlight);
    // The Destrier's slow: a gold wash over the knight's lane, deeper from level II (a shape's fill alpha multiplies the object's, so the object's carries it).
    this.slow = scene.add.rectangle(LANE_X0, 0, FW_X - LANE_X0, LANE_H, HEX.gold).setOrigin(0, 0).setAlpha(0.06).setVisible(false);
    back.add(this.slow);
    if (!scene.textures.exists('flow')) {
      const tex = scene.textures.createCanvas('flow', 30, 2);
      if (tex) { const c = tex.getContext(); c.fillStyle = '#44464d'; c.fillRect(0, 0, 12, 2); tex.refresh(); }
    }
    for (let i = 0; i < LANE_COUNT; i++) {
      const ts = scene.add.tileSprite(LANE_X0, i * LANE_H + 44, FW_X - LANE_X0, 2, 'flow').setOrigin(0, 0).setAlpha(0.5);
      back.add(ts);
      this.flows.push(ts);
    }
  }

  frame(run: Run | null, dt: number): void {
    for (const f of this.flows) f.tilePositionX -= 18.75 * dt;
    // The logical lane, which is also the one the slow applies to, not wherever the sprite is on its way there.
    const lane = run?.state.knight.lane ?? 2;
    this.highlight.y = lane * LANE_H;
    const lvl = run ? destrierLevel(run.state.owned) : 0;
    this.slow.setVisible(lvl > 0).setY(lane * LANE_H).setAlpha(lvl >= 2 ? 0.1 : 0.06);
  }
}

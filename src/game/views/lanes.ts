// packages
import Phaser from 'phaser';

// core
import { FW_X, LANE_COUNT, LANE_H, LANE_X0 } from '../../core/constants';
import { HEX } from '../../core/palette';
import type { Run } from '../../core/run';

// game
import type { FieldScene } from '../FieldScene';
import type { View } from '../view';

export class LanesView implements View {
  private readonly highlight: Phaser.GameObjects.Container;
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
    this.highlight.y = (run?.state.knight.lane ?? 2) * LANE_H;
  }
}

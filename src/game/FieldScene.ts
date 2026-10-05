// packages
import Phaser from 'phaser';

// stage
import { RENDER_SCALE, SCREEN_H, SCREEN_W } from '../stage';

let resolveReady: (scene: FieldScene) => void = () => {};

export class FieldScene extends Phaser.Scene {
  static readonly ready: Promise<FieldScene> = new Promise((r) => { resolveReady = r; });
  onFrame: ((deltaMs: number) => void) | null = null;

  constructor() {
    super('field');
  }

  create(): void {
    this.cameras.main.setZoom(RENDER_SCALE).centerOn(SCREEN_W / 2, SCREEN_H / 2);
    this.add.text(40, 40, 'NONE SHALL PASS', {
      fontFamily: 'Space Mono', fontSize: '18px', color: '#f2efe7', resolution: RENDER_SCALE,
    }).setName('boot-title');
    resolveReady(this);
  }

  update(_time: number, deltaMs: number): void {
    this.onFrame?.(deltaMs);
  }
}

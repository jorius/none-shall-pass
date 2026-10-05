// packages
import Phaser from 'phaser';

// core
import { FIELD_TOP } from '../core/constants';

// art
import { registerTextures } from '../art/textures';

// stage
import { RENDER_SCALE, SCREEN_H, SCREEN_W } from '../stage';

type Layer = Phaser.GameObjects.Container;
let resolveReady: (scene: FieldScene) => void = () => {};

export class FieldScene extends Phaser.Scene {
  static readonly ready: Promise<FieldScene> = new Promise((r) => { resolveReady = r; });
  onFrame: ((deltaMs: number) => void) | null = null;
  layers!: { back: Layer; packets: Layer; objects: Layer; actors: Layer; fx: Layer };

  constructor() {
    super('field');
  }

  create(): void {
    registerTextures(this);
    this.cameras.main.setZoom(RENDER_SCALE).centerOn(SCREEN_W / 2, SCREEN_H / 2);
    const layer = (): Layer => this.add.container(0, FIELD_TOP);
    this.layers = { back: layer(), packets: layer(), objects: layer(), actors: layer(), fx: layer() };
    resolveReady(this);
  }

  update(_time: number, deltaMs: number): void {
    this.onFrame?.(deltaMs);
  }
}

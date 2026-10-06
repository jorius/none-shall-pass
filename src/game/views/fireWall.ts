// packages
import Phaser from 'phaser';

// core
import { FIELD_H, FW_X } from '../../core/constants';
import type { RunEvent } from '../../core/events';
import { HEX } from '../../core/palette';

// game
import type { FieldScene } from '../FieldScene';
import type { View } from '../view';

const W = 8, H = 150;
export type FirePalette = [number, number, number, number][];
export const FIRE_BLUE: FirePalette = [[22, 96, 143, 190], [47, 182, 255, 230], [143, 220, 255, 245], [232, 248, 255, 255]];
export const FIRE_AMBER: FirePalette = [[120, 60, 0, 190], [255, 150, 0, 230], [255, 200, 80, 245], [255, 240, 200, 255]];

// A column of animated pixel fire: the firewall, literally.
export class FireWallView implements View {
  private readonly tex: Phaser.Textures.CanvasTexture;
  private readonly data: ImageData;
  private readonly flash: Phaser.GameObjects.Rectangle;
  palette: FirePalette = FIRE_BLUE;

  constructor(private readonly scene: FieldScene) {
    this.tex = scene.textures.createCanvas('firewall', W, H)!;
    this.tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.data = this.tex.getContext().createImageData(W, H);
    scene.layers.objects.add(scene.add.image(FW_X, 0, 'firewall').setOrigin(0, 0).setScale(3).setAlpha(0.92));
    this.flash = scene.add.rectangle(FW_X, 0, 24, FIELD_H, HEX.blue, 0).setOrigin(0, 0);
    scene.layers.objects.add(this.flash);
  }

  frame(_run: unknown, _dt: number, time: number): void {
    const d = this.data.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = 1 - Math.abs(x - 3.5) / 4.3;
      const v = (Math.sin(y * 0.55 + time * 7 + x * 0.9) + Math.sin(y * 0.23 + time * 4.1 - x * 1.9) + Math.sin(y * 1.17 + time * 11.3 + x)) / 3;
      const k = c * 0.95 + v * 0.45 - 0.12;
      const idx = k > 0.92 ? 3 : k > 0.68 ? 2 : k > 0.42 ? 1 : k > 0.2 ? 0 : -1;
      const o = (y * W + x) * 4;
      if (idx < 0) { d[o + 3] = 0; continue; }
      const col = this.palette[idx];
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = col[3];
    }
    this.tex.getContext().putImageData(this.data, 0, 0);
    this.tex.refresh();
  }

  // The fire flares when it takes a packet in and when one of the rules shatters a packet at it (the lockdown's shatter is further up the lane).
  event(ev: RunEvent): void {
    if (ev.type === 'entered' || (ev.type === 'shattered' && ev.by === 'rule' && ev.ruleId !== 'lockdown')) this.flare();
  }

  // Brighter and longer than the quieter flash reduced effects keep. A new flare replaces one still fading.
  private flare(): void {
    const { reduced } = this.scene;
    this.scene.tweens.killTweensOf(this.flash);
    this.flash.setAlpha(reduced ? 0.6 : 0.9);
    this.scene.tweens.add({ targets: this.flash, alpha: 0, duration: reduced ? 140 : 200 });
  }
}

// packages
import Phaser from 'phaser';

// core
import { RACK } from '../core/constants';

// local
import { paintGrid, type Grid } from './pixels';
import { rackSprite, SPRITE_DEFS } from './sprites';

const addGrid = (scene: Phaser.Scene, key: string, g: Grid, scale: number, pal?: Record<string, string>): void => {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, g[0].length * scale, g.length * scale);
  if (!tex) return;
  paintGrid(tex.getContext(), g, scale, pal);
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
};

// Pixel sprites are drawn at their logical size; the 2x camera upsamples them with NEAREST.
export const registerTextures = (scene: Phaser.Scene): void => {
  for (const d of SPRITE_DEFS) addGrid(scene, d.key, d.grid(), d.scale, d.pal);
  addGrid(scene, 'rack', rackSprite(RACK.rows).grid, 3);
};

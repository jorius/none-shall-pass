// packages
import type Phaser from 'phaser';

// local
import type { App } from '../../app';
import type { FieldScene } from '../FieldScene';
import type { View } from '../view';
import { FIRE_AMBER, FIRE_BLUE, type FireWallView } from './fireWall';

// Luminance into amber phosphor (a faint glow in the blacks): the field's ink lands near the DOM's #ffb000 and its
// dim near #b07a00. A plain sepia comes out beige beside the amber panels.
const AMBER = [
  0.344, 0.675, 0.131, 0, 6,
  0.224, 0.440, 0.086, 0, 5,
  0.036, 0.070, 0.014, 0, 2,
  0, 0, 0, 1, 0,
];

// Root mode: an amber-phosphor terminal. The DOM swaps its CSS variables; the canvas gets an amber colour matrix.
// Every refresh applies the App's current mode, so a repeated refresh never stacks a second filter.
export class RootModeView implements View {
  private filter: Phaser.Filters.ColorMatrix | null = null;

  constructor(private readonly scene: FieldScene, private readonly ui: HTMLElement, private readonly fire: FireWallView, private readonly app: App) {}

  refresh(): void {
    const on = this.app.root;
    this.ui.classList.toggle('root', on);
    document.body.classList.toggle('root', on);
    this.fire.palette = on ? FIRE_AMBER : FIRE_BLUE;
    const cam = this.scene.cameras.main;
    if (on && !this.filter) {
      this.filter = cam.filters.internal.addColorMatrix();
      this.filter.colorMatrix.set(AMBER);
      cam.setBackgroundColor('#1a1408');
    } else if (!on && this.filter) {
      cam.filters.internal.remove(this.filter);
      this.filter = null;
      cam.setBackgroundColor('#292929');
    }
  }
}

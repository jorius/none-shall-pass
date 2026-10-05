// packages
import Phaser from 'phaser';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@fontsource/atkinson-hyperlegible-next/400.css';
import '@fontsource/atkinson-hyperlegible-next/700.css';

// local
import './styles.css';
import { FieldScene } from './game/FieldScene';
import { RENDER_SCALE, SCREEN_H, SCREEN_W } from './stage';

const loadFonts = (): Promise<unknown> => Promise.race([
  Promise.all([
    document.fonts.load('13px "Space Mono"'),
    document.fonts.load('700 13px "Space Mono"'),
    document.fonts.load('14px "IBM Plex Mono"'),
    document.fonts.load('15px "Atkinson Hyperlegible Next"'),
  ]),
  // Fonts that fail to arrive must not block the game; it falls back to system faces.
  new Promise((r) => setTimeout(r, 2500)),
]);

const boot = async (): Promise<void> => {
  await loadFonts();
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'stage',
    width: SCREEN_W * RENDER_SCALE,
    height: SCREEN_H * RENDER_SCALE,
    backgroundColor: '#292929',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true },
    scene: [FieldScene],
  });
  (window as unknown as { __nsp: unknown }).__nsp = { game };
};

void boot();

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
import { App } from './app';
import { FieldScene } from './game/FieldScene';
import { ActorsView } from './game/views/actors';
import { EffectsView } from './game/views/effects';
import { FieldObjectsView } from './game/views/fieldObjects';
import { FireWallView } from './game/views/fireWall';
import { LanesView } from './game/views/lanes';
import { PacketsView } from './game/views/packets';
import { RackView } from './game/views/rack';
import { detectLang, onLang, setLang } from './i18n';
import { RENDER_SCALE, SCREEN_H, SCREEN_W } from './stage';
import { createStore } from './storage';
import { Bubble } from './ui/bubble';
import { Coach } from './ui/coach';
import { el } from './ui/dom';
import { EventLog } from './ui/eventLog';
import { Floats } from './ui/floats';
import { Gutter } from './ui/gutter';
import { Hud } from './ui/hud';
import { Inspector } from './ui/inspector';
import { createUiLayer } from './ui/layer';
import { LoadoutTiles } from './ui/loadout';
import { UptimeStrip } from './ui/uptime';

const loadFonts = (): Promise<unknown> => Promise.race([
  Promise.all([
    document.fonts.load('13px "Space Mono"'),
    document.fonts.load('700 13px "Space Mono"'),
    document.fonts.load('14px "IBM Plex Mono"'),
    document.fonts.load('600 14px "IBM Plex Mono"'),
    document.fonts.load('15px "Atkinson Hyperlegible Next"'),
  ]),
  // Fonts that fail to arrive must not block the game; it falls back to system faces.
  new Promise((r) => setTimeout(r, 2500)),
]);

const boot = async (): Promise<void> => {
  await loadFonts();
  const store = createStore();
  setLang(store.prefs().lang ?? detectLang());
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
  const scene = await FieldScene.ready;
  const app = new App(scene, store);
  app.add(new LanesView(scene), new FireWallView(scene), new RackView(scene), new FieldObjectsView(scene), new ActorsView(scene));
  const effects = new EffectsView(scene);
  effects.reduced = !!store.prefs().reducedFx || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // The DOM layer comes after the canvas, so the inspector the hover feeds is created further down.
  let inspector: Inspector | null = null;
  app.add(
    new PacketsView(scene, {
      // Like the keys, a click only targets while the field is live, not under the pause or console screen.
      target: (id) => { if (app.run && app.screen === 'playing') app.dispatch(app.run.target(id)); },
      hover: (p) => inspector?.hover(p),
    }),
    effects,
  );
  const ui = createUiLayer(document.getElementById('stage')!, game.canvas);
  app.add(new Hud(ui, app), new Gutter(ui), new UptimeStrip(ui), new Bubble(ui), new Floats(ui), new Coach(ui, store));
  const bottom = el('div', 'bottom', ui);
  inspector = new Inspector(bottom);
  app.add(inspector, new EventLog(bottom, inspector), new LoadoutTiles(ui, inspector));
  el('div', 'scanlines', ui);
  app.add({ pause: (p) => ui.classList.toggle('paused', p) });
  onLang(() => app.refresh());
  (window as unknown as { __nsp: unknown }).__nsp = { game, app };
  // Until the title screen exists (Task 18), boot straight into a campaign.
  app.startRun('campaign');
};

void boot();

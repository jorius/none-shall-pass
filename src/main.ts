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
import { RootModeView } from './game/views/rootMode';
import { detectLang, onLang, setLang } from './i18n';
import { RENDER_SCALE, SCREEN_H, SCREEN_W } from './stage';
import { createStore } from './storage';
import { AnalyticsView } from './ui/analyticsView';
import { Bubble } from './ui/bubble';
import { Coach } from './ui/coach';
import { ConsoleView } from './ui/consoleView';
import { el } from './ui/dom';
import { EventLog } from './ui/eventLog';
import { Floats } from './ui/floats';
import { Gutter } from './ui/gutter';
import { Hud } from './ui/hud';
import { Inspector } from './ui/inspector';
import { createUiLayer } from './ui/layer';
import { LoadoutTiles } from './ui/loadout';
import { Overlays } from './ui/overlays';
import { renderPhoneGate, shouldGate } from './ui/phoneGate';
import { UptimeStrip } from './ui/uptime';
import { renderWebglGate, shouldGateWebgl } from './ui/webglGate';

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
  // Phones get a card instead of the game, before Phaser ever starts.
  // `pointer` is only the primary input; `any-pointer` spares a tablet with a trackpad or a mouse.
  const coarseOnly = window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(any-pointer: fine)').matches;
  if (shouldGate(Math.min(window.screen.width, window.screen.height), coarseOnly)) { renderPhoneGate(document.getElementById('app')!); return; }
  // Phaser 4 has no canvas renderer: without WebGL the card comes up instead of a blank page.
  if (shouldGateWebgl(document.createElement('canvas'))) { renderWebglGate(document.getElementById('app')!); return; }
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
  const fireWall = new FireWallView(scene);
  app.add(new LanesView(scene), fireWall, new RackView(scene), new FieldObjectsView(scene), new ActorsView(scene));
  const effects = new EffectsView(scene);
  // The system setting is the default until the player picks one in the pause menu.
  effects.reduced = store.prefs().reducedFx ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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
  app.add(new Overlays(ui, app, { effects }));
  app.add(new ConsoleView(ui, app), new RootModeView(scene, ui, fireWall, app));
  app.add(new AnalyticsView(app));
  ui.classList.toggle('reduced', effects.reduced);
  onLang(() => app.refresh());
  (window as unknown as { __nsp: unknown }).__nsp = { game, app, effects };
  app.quit();
};

// Whatever else stops the boot ends on the card with a generic message, not on a blank page.
boot().catch((e: unknown) => { console.error(e); renderWebglGate(document.getElementById('app')!, 'boot'); });

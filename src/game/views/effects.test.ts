// packages
import { describe, expect, it, vi } from 'vitest';

// local
import type { FieldScene } from '../FieldScene';
import { EffectsView } from './effects';

// The view only reaches for Phaser to filter a texture it builds, and the scene below already has every texture.
vi.mock('phaser', () => ({ default: {} }));

// A scene with just enough in it to build the view and snap: the textures exist, the emitters take what they are told, and a tween never
// finishes (so a veil stays on the field until the test lets it go).
const setup = () => {
  const emitter = () => ({ addEmitZone: vi.fn(), pause: vi.fn(), resume: vi.fn(), explode: vi.fn(), emitParticleAt: vi.fn() });
  const rect = () => { const r = { setOrigin: () => r, destroy: vi.fn() }; return r; };
  const scene = {
    reduced: false, textures: { exists: () => true }, layers: { fx: { add: vi.fn() } }, cameras: { main: { shake: vi.fn() } },
    tweens: { add: vi.fn(), timeScale: 1 }, time: { paused: false }, add: { particles: vi.fn(emitter), rectangle: vi.fn(rect) },
  };
  const fx = new EffectsView(scene as unknown as FieldScene);
  // The view's own clock, as the app hands it to every frame (seconds, frozen under the pause).
  const at = (secs: number): void => fx.frame(null, 0, secs);
  // What the knight's hits did so far: the shakes, the white veils drawn and the veils still on the field.
  const seen = () => ({ shakes: scene.cameras.main.shake.mock.calls.length, veils: scene.add.rectangle.mock.calls.length, up: fx.debugFlashes() });
  return { scene, fx, at, seen };
};

describe('the knight\'s hit snap', () => {
  it('draws the same veil as before: the whole field in white at 35%, with a 60 ms shake and a 60 ms fade', () => {
    const { scene, fx } = setup();
    fx.snap();
    expect(scene.add.rectangle).toHaveBeenCalledWith(0, 0, 1280, 450, 0xffffff, 0.35);
    expect(scene.cameras.main.shake).toHaveBeenCalledWith(60, 0.0015);
    expect(scene.tweens.add).toHaveBeenCalledWith(expect.objectContaining({ alpha: 0, duration: 60 }));
  });

  it('draws a veil for the first hit, before any frame has run', () => {
    const { fx, seen } = setup();
    fx.snap();
    expect(seen()).toEqual({ shakes: 1, veils: 1, up: 1 });
  });

  // Three flashes a second is the most a photosensitive player can be asked for: throws land 0.25 s apart, a charge kills every 0.28 s.
  it('flashes once for two hits 100 ms apart, and shakes for both', () => {
    const { fx, at, seen } = setup();
    at(10);
    fx.snap();
    at(10.1);
    fx.snap();
    expect(seen()).toEqual({ shakes: 2, veils: 1, up: 1 });
  });

  it('flashes twice for two hits 400 ms apart', () => {
    const { fx, at, seen } = setup();
    at(10);
    fx.snap();
    at(10.4);
    fx.snap();
    expect(seen()).toEqual({ shakes: 2, veils: 2, up: 2 });
  });

  it('keeps its gap at 350 ms: none at 340, one at 360', () => {
    const early = setup();
    early.at(5);
    early.fx.snap();
    early.at(5.34);
    early.fx.snap();
    expect(early.seen().veils).toBe(1);
    const late = setup();
    late.at(5);
    late.fx.snap();
    late.at(5.36);
    late.fx.snap();
    expect(late.seen().veils).toBe(2);
  });

  it('counts the gap from the last veil drawn, not the last hit: a charge killing every 0.28 s flashes every other kill', () => {
    const { fx, at, seen } = setup();
    for (let i = 0; i < 8; i++) { at(20 + i * 0.28); fx.snap(); }
    // Kills at 0, .28, .56, .84, 1.12, 1.4, 1.68, 1.96: veils at 0, .56, 1.12, 1.68, never more than three in any second.
    expect(seen()).toEqual({ shakes: 8, veils: 4, up: 4 });
  });

  it('judges a hit by the clock and not by whether the last veil is still up: it fades in 60 ms, and a hit at 100 ms still gets no second one', () => {
    const { scene, fx, at, seen } = setup();
    at(1);
    fx.snap();
    // The veil's tween ends: it leaves the field.
    (scene.tweens.add.mock.calls[0][0] as { onComplete: () => void }).onComplete();
    at(1.1);
    fx.snap();
    expect(seen()).toEqual({ shakes: 2, veils: 1, up: 0 });
  });

  it('flashes once for two kills in the same step, as a charge can land', () => {
    const { fx, at, seen } = setup();
    at(3);
    fx.snap();
    fx.snap();
    expect(seen()).toEqual({ shakes: 2, veils: 1, up: 1 });
  });

  it('does nothing under reduced effects: no shake, no veil', () => {
    const { scene, fx, at, seen } = setup();
    scene.reduced = true;
    at(1);
    fx.snap();
    at(2);
    fx.snap();
    expect(seen()).toEqual({ shakes: 0, veils: 0, up: 0 });
  });
});

// core
import type { CardId } from '../core/content/cards';
import type { RunEvent } from '../core/events';
import type { Screen } from '../core/keys';
import { destrierLevel, obsLevel } from '../core/rules';
import type { Run } from '../core/run';

// game
import type { View } from '../game/view';

// local
import { createMusic } from './music';
import { createSynth, type SfxName } from './synth';

export interface AudioPrefs { sound: boolean; music: boolean; volume: 0 | 1 | 2 | 3 }

// The master level at each step of VOLUME; the music sits at half the effects, and the loop drops to 40% under a menu.
const VOLUME = [0, 0.35, 0.65, 1] as const;
const MUSIC_LEVEL = 0.5;
const DUCKED = 0.4;

// The game's sound, played from its events: short synthesized effects and a looping 16-step tune, with the switches the pause
// menu and the M key work. Without an AudioContext, or before the first gesture, it does nothing at all.
export class AudioView implements View {
  unlocked = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private synth: ReturnType<typeof createSynth> | null = null;
  private music: ReturnType<typeof createMusic> | null = null;
  private prefs: AudioPrefs;
  private screenNow: Screen = 'title';
  // What the run owned at the last pick, to tell a level rising from any other card.
  private owned: CardId[] = [];
  // When a suspended context was last asked to resume.
  private woke = -Infinity;

  constructor(private readonly make: () => AudioContext | null, prefs: Partial<AudioPrefs>, private readonly onChange?: (p: AudioPrefs) => void) {
    this.prefs = { sound: prefs.sound ?? true, music: prefs.music ?? true, volume: prefs.volume ?? 2 };
  }

  // The page's side, kept out of the constructor so nothing here needs a window: the first key or press unlocks the audio, and a
  // click on an overlay button ticks. Returns the way to stop listening.
  attach(win: Window): () => void {
    const gesture = (): void => this.unlock();
    // The capture phase sees a button before its own handler redraws the screen, which takes the button out of the page.
    const click = (e: Event): void => {
      const button = (e.target as Element | null)?.closest?.<HTMLButtonElement>('.ov button');
      if (button && !button.disabled) this.sfx('button');
    };
    win.addEventListener('keydown', gesture);
    win.addEventListener('pointerdown', gesture);
    win.document.addEventListener('click', click, true);
    return () => {
      win.removeEventListener('keydown', gesture);
      win.removeEventListener('pointerdown', gesture);
      win.document.removeEventListener('click', click, true);
    };
  }

  // Browsers only start audio after a user gesture: the first key or press builds the graph, and every one after asks a
  // context that is still suspended to resume (the first may not have counted, an Esc for one).
  unlock(): void {
    if (!this.unlocked) {
      this.unlocked = true;
      this.build();
    }
    this.wake();
  }

  private build(): void {
    try {
      const ctx = this.make();
      if (!ctx) return;
      this.ctx = ctx;
      this.master = ctx.createGain(); this.sfxGain = ctx.createGain(); this.musicGain = ctx.createGain();
      this.sfxGain.connect(this.master); this.musicGain.connect(this.master); this.master.connect(ctx.destination);
      this.synth = createSynth(ctx, this.sfxGain); this.music = createMusic(ctx, this.musicGain);
      this.apply();
      this.sync();
    } catch {
      // No Web Audio, or a graph that will not build: the game plays on without sound.
      this.ctx = this.master = this.sfxGain = this.musicGain = this.synth = this.music = null;
    }
  }

  // A context still suspended is asked again by each later gesture (the first may not have counted), though not by every repeat of
  // a held key. A resume that is refused, or never answers because there is no output device, leaves the game silent, not broken.
  private wake(): void {
    const ctx = this.ctx, now = Date.now();
    if (!ctx || ctx.state === 'running' || now - this.woke < 500) return;
    this.woke = now;
    try { void Promise.resolve(ctx.resume?.()).catch(() => undefined); } catch { /* silent */ }
  }

  private apply(): void {
    if (this.master) this.master.gain.value = VOLUME[this.prefs.volume];
    if (this.sfxGain) this.sfxGain.gain.value = this.prefs.sound ? 1 : 0;
    if (this.musicGain) this.musicGain.gain.value = this.prefs.music ? MUSIC_LEVEL : 0;
  }

  // The loop follows the screen and the switches: it plays on every screen but the debrief, softer under the pause, the Armory
  // and the console, and not at all (so nothing is queued for nobody) while MUSIC is off or the VOLUME is 0.
  private sync(): void {
    const music = this.music;
    if (!music) return;
    try {
      const s = this.screenNow;
      music.setLevel(s === 'paused' || s === 'armory' || s === 'console' ? DUCKED : 1);
      if (this.prefs.music && this.prefs.volume > 0 && s !== 'debrief') music.start();
      else music.stop();
    } catch { /* silent */ }
  }

  set(p: Partial<AudioPrefs>): void {
    this.prefs = { ...this.prefs, ...p };
    this.apply();
    this.sync();
    this.onChange?.({ ...this.prefs });
  }

  get settings(): AudioPrefs { return { ...this.prefs }; }

  // Whether the music loop is running.
  get looping(): boolean { return this.music?.running ?? false; }

  // M: everything off, or, when nothing was on, everything back.
  toggleMute(): void {
    const on = !(this.prefs.sound || this.prefs.music);
    this.set({ sound: on, music: on });
  }

  private sfx(n: SfxName): void {
    try { if (this.prefs.sound) this.synth?.play(n); } catch { /* a dead context plays nothing */ }
  }

  // A new run, or the idle one behind the title, has bought nothing yet.
  start(run?: Run): void {
    this.owned = run ? [...run.state.owned] : [];
  }

  event(ev: RunEvent): void {
    switch (ev.type) {
      case 'thrown': this.sfx('throw'); break;
      case 'shattered': this.sfx('hit'); break;
      case 'missed': this.sfx('miss'); break;
      case 'consumed': this.sfx('swallow'); break;
      case 'resolved': if (ev.outcome === 'breach') this.sfx('breach'); break;
      case 'waveStarted': this.sfx('waveStart'); break;
      case 'chargeStarted': this.sfx('charge'); break;
      case 'owned':
        this.sfx('pick');
        // Destrier or Observability going up a level gets its fanfare on top of the pick.
        if (destrierLevel(ev.owned) > destrierLevel(this.owned) || obsLevel(ev.owned) > obsLevel(this.owned)) this.sfx('levelUp');
        this.owned = [...ev.owned];
        break;
    }
  }

  screen(s: Screen): void {
    this.screenNow = s;
    this.sync();
    if (s === 'paused') this.sfx('pause');
    if (s === 'recap') this.sfx('recap');
  }
}

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

export interface AudioPrefs { sound: boolean; music: boolean; volume: 1 | 2 | 3 }

// The master level at each step of VOLUME (1 to 3: SOUND and MUSIC are the ways to silence); the music sits at half the effects,
// and the loop drops to 40% under a menu.
const VOLUME = { 1: 0.35, 2: 0.65, 3: 1 } as const;
const MUSIC_LEVEL = 0.5;
const DUCKED = 0.4;
// The limiter node adds makeup gain of its own at these settings (+1.7 dB, measured on Chromium's), which would put the whole mix
// up and its peaks nearer full scale; the master level takes it back out, so the limiter only acts on the peaks.
const MAKEUP = 1.22;

// The game's sound, played from its events: short synthesized effects and a looping 16-step tune, with the switches the pause
// menu and the M key work. Without an AudioContext, or before the first gesture, it does nothing at all.
export class AudioView implements View {
  unlocked = false;
  // Told once, when the first gesture unlocks it (whether or not a context could be built): whoever hints at the sound has nothing left to ask for.
  onUnlock: (() => void) | null = null;
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
  // The switches M took away, to give them back.
  private muted: { sound: boolean; music: boolean } | null = null;
  // Whether the master feeds a limiter (see build).
  private limited = false;
  // When a suspended context was last asked to resume.
  private woke = -Infinity;
  // Whether a hidden tab suspended the context, so that the tab coming back resumes it.
  private hushed = false;

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
    // A tab nobody can see goes silent: the pause only ducks the loop (to 40%) during play, and under the title, the setup, the recap and the
    // draft nothing pauses at all, so a hidden tab would play on at full level. Coming back resumes only a context the hiding suspended.
    const visibility = (): void => {
      if (win.document.hidden) this.hush();
      else if (this.hushed) { this.hushed = false; this.wake(true); }
    };
    win.addEventListener('keydown', gesture);
    win.addEventListener('pointerdown', gesture);
    win.document.addEventListener('click', click, true);
    win.document.addEventListener('visibilitychange', visibility);
    return () => {
      win.removeEventListener('keydown', gesture);
      win.removeEventListener('pointerdown', gesture);
      win.document.removeEventListener('click', click, true);
      win.document.removeEventListener('visibilitychange', visibility);
    };
  }

  // Browsers only start audio after a user gesture: the first key or press builds the graph, and every one after asks a
  // context that is still suspended to resume (the first may not have counted, an Esc for one).
  unlock(): void {
    if (!this.unlocked) {
      this.unlocked = true;
      this.build();
      this.onUnlock?.();
    }
    this.wake();
  }

  private build(): void {
    try {
      const ctx = this.make();
      if (!ctx) return;
      this.ctx = ctx;
      this.master = ctx.createGain(); this.sfxGain = ctx.createGain(); this.musicGain = ctx.createGain();
      this.sfxGain.connect(this.master); this.musicGain.connect(this.master);
      // A limiter just under full scale, where the browser has one, so a charge's stack of hits cannot clip. Set as a brick wall
      // (-3 dB, no knee, 20:1) and not as the node's defaults (-24 dB, a 30 dB knee, 12:1), which squash the whole mix. The node
      // adds makeup gain of its own (see MAKEUP) and fades in over its first quarter second, so the first tick after the first
      // gesture is softer.
      const limiter = ctx.createDynamicsCompressor?.();
      this.limited = !!limiter;
      if (limiter) {
        limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.003; limiter.release.value = 0.25;
        this.master.connect(limiter);
        limiter.connect(ctx.destination);
      } else this.master.connect(ctx.destination);
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
  // `force` is a tab coming back to a context it had suspended: asked at once, whatever the context says (the suspend may not be through
  // yet) and however recent the last ask. The loop's timer kept its place, and plays on from the clock (see createMusic's pump).
  private wake(force = false): void {
    const ctx = this.ctx, now = Date.now();
    if (!ctx || (!force && (ctx.state === 'running' || now - this.woke < 500))) return;
    this.woke = now;
    try { void Promise.resolve(ctx.resume?.()).catch(() => undefined); } catch { /* silent */ }
  }

  // Before the first gesture there is no context to suspend, and the first gesture builds one.
  private hush(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    this.hushed = true;
    try { void Promise.resolve(ctx.suspend?.()).catch(() => undefined); } catch { /* silent */ }
  }

  private apply(): void {
    if (this.master) this.master.gain.value = VOLUME[this.prefs.volume] / (this.limited ? MAKEUP : 1);
    if (this.sfxGain) this.sfxGain.gain.value = this.prefs.sound ? 1 : 0;
    if (this.musicGain) this.musicGain.gain.value = this.prefs.music ? MUSIC_LEVEL : 0;
  }

  // The loop follows the screen and the switches: it plays on every screen but the debrief, softer under the pause, the Armory
  // and the console, and not at all (so nothing is queued for nobody) while MUSIC is off.
  private sync(): void {
    const music = this.music;
    if (!music) return;
    try {
      const s = this.screenNow;
      music.setLevel(s === 'paused' || s === 'armory' || s === 'console' ? DUCKED : 1);
      if (this.prefs.music && s !== 'debrief') music.start();
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

  // M: with anything on, everything goes off and the pair that was on is remembered. With nothing on, that pair comes back, whatever was
  // done to the switches meanwhile: one turned on and off again by hand changes nothing, one left on is on (and M takes that pair instead).
  // With no pair remembered (a session saved muted, or both switched off by hand) both come on.
  toggleMute(): void {
    const { sound, music } = this.prefs;
    if (sound || music) {
      this.muted = { sound, music };
      this.set({ sound: false, music: false });
    } else {
      this.set(this.muted ?? { sound: true, music: true });
      this.muted = null;
    }
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
        // Destrier or Observability going up a level gets its fanfare in place of the pick: both start a 523 Hz square on the same
        // instant, so together they would only double in phase.
        this.sfx(destrierLevel(ev.owned) > destrierLevel(this.owned) || obsLevel(ev.owned) > obsLevel(this.owned) ? 'levelUp' : 'pick');
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

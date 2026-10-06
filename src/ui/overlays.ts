// audio
import type { AudioPrefs, AudioView } from '../audio';

// core
import { STARTING_LOADOUT } from '../core/content/cards';
import type { RunEvent } from '../core/events';
import type { Screen } from '../core/keys';
import type { Run } from '../core/run';
import { resultOf } from '../core/score';

// game
import type { View } from '../game/view';
import type { EffectsView } from '../game/views/effects';

// i18n
import { lang, setLang } from '../i18n';

// stage
import { SCREEN_W } from '../stage';

// local
import type { App, Choice } from '../app';
import { slotOf, type Prefs } from '../storage';
import { renderArmory } from './armory';
import { renderDebrief, type PrevBest } from './debrief';
import { el } from './dom';
import { renderDraft } from './draftPanel';
import { renderPause } from './pausePanel';
import { renderRecap } from './recap';
import { renderSetup } from './setup';
import { renderHowto, renderTitle } from './title';

type Kind = 'none' | 'title' | 'howto' | 'setup' | 'recap' | 'draft' | 'armory' | 'pause' | 'debrief';

// The pair last played, or the Analyst on the Black Knight before any was: what the title and the setup show.
const chosen = (p: Prefs): Choice => ({ knight: p.knight ?? 'black', difficulty: p.difficulty ?? 'analyst' });

// The screens between and around the runs, in one box over the field; it follows the App's screen.
export class Overlays implements View {
  private readonly box: HTMLElement;
  private kind: Kind = 'none';
  // The Armory remembers how it was opened (see show): which button had the focus (an index among the box's buttons, -1 for none:
  // a mouse player, or the field) and which view it opened over.
  private armoryAt = -1;
  private armoryFrom: Kind = 'none';
  private ended: { run: Run; newBest: boolean; prev: PrevBest } | null = null;
  // What each screen last drew its entrance for: the hand the draft flipped in, and the run whose debrief counted up and stamped.
  // Drawn again (a pick, a refresh, a language switch), the same hand or run comes up finished, not replayed.
  private dealt: object | null = null;
  private debriefed: object | null = null;

  constructor(private readonly ui: HTMLElement, private readonly app: App, private readonly opts: { effects: EffectsView; audio: Pick<AudioView, 'settings' | 'set'> }) {
    this.box = el('div', 'ov', ui);
    app.onScreen = (s) => this.onScreen(s);
    // Saved the moment the run ends, once; the debrief comes up later with the best it had to beat.
    app.onEnd = (run) => {
      const r = resultOf(run.state), slot = slotOf(r), bests = app.store.bests();
      const before = r.mode === 'campaign' ? bests.campaign[slot] : bests.overtime[slot];
      const prev = before ? { ...before } : null;
      const { newBest } = app.store.recordResult(r);
      this.ended = { run, newBest, prev };
    };
    // The how-to is one screen deep: Esc goes back, as BACK does. It listens first (capture, ahead of the App's key handling), so the
    // Esc that closes the Armory over the how-to is not also taken as the how-to's own once the App has put the how-to back.
    window.addEventListener('keydown', (e) => {
      if (this.kind !== 'howto' || e.key !== 'Escape' || e.repeat) return;
      e.preventDefault();
      this.show('title');
    }, true);
  }

  private onScreen(s: Screen): void {
    // The how-to is only a view of the title (the App's screen stays 'title' under it), so an Armory opened over it closes back onto it.
    if (s === 'title') this.show(this.kind === 'armory' && this.armoryFrom === 'howto' ? 'howto' : 'title');
    else if (s === 'setup') this.show('setup');
    else if (s === 'recap') this.show('recap');
    else if (s === 'draft') this.show('draft');
    else if (s === 'armory') this.show('armory');
    else if (s === 'paused') this.show('pause');
    else if (s === 'debrief') this.show('debrief');
    else if (s === 'playing' || s === 'console') this.hide();
  }

  // Everything else in the layer goes inert while a screen is up: Tab stays on its buttons,
  // and the HUD's pause button cannot be reached from under a draft.
  private inert(on: boolean): void {
    for (const c of this.ui.children) if (c !== this.box) c.toggleAttribute('inert', on);
  }

  private buttons(): HTMLButtonElement[] {
    return [...this.box.querySelectorAll('button')];
  }

  // Buttons never take the mouse's focus (dom.ts), so a focused one here means a keyboard player.
  private focused(): number {
    return this.buttons().indexOf(document.activeElement as HTMLButtonElement);
  }

  // The same place if it is still open; otherwise, after a pick, the next affordable card (wrapping round)
  // before REROLL or NEXT WAVE; otherwise the next open button.
  private focusFrom(i: number): void {
    const all = this.buttons();
    const open = [...all.slice(i), ...all.slice(0, i)].filter((b) => !b.disabled);
    const here = all[i] && !all[i].disabled ? all[i] : undefined;
    (here ?? open.find((b) => b.closest('.ucard')) ?? open[0])?.focus();
  }

  private show(kind: Kind): void {
    // The Armory gives CLOSE the focus to everyone, so on the way out the focus tells nothing about the player: the way in does.
    // A keyboard player gets back the button they left (a draft opened on T from card 3 comes back on card 3, never on card 1,
    // where the next Space would spend the free pick), and a player with none gets none (never a card under Space).
    const leaving = this.kind === 'armory';
    const at = leaving ? this.armoryAt : this.focused();
    if (kind === 'armory' && !leaving) { this.armoryAt = at; this.armoryFrom = this.kind; }
    const back = leaving && kind === this.armoryFrom;
    this.kind = kind;
    this.box.className = `ov show ov-${kind}`;
    this.inert(true);
    this.render();
    // The recap puts the focus on its own CONTINUE, the setup on its START and the Armory on its CLOSE, for every player.
    if (at >= 0 && kind !== 'recap' && kind !== 'setup' && kind !== 'armory') this.focusFrom(back ? at : 0);
  }

  private hide(): void {
    this.kind = 'none';
    this.box.className = 'ov';
    this.box.innerHTML = '';
    this.inert(false);
  }

  // A pick, a reroll or a language switch redraws the screen in place; a keyboard player keeps their place.
  private redraw(): void {
    const at = this.focused();
    this.render();
    if (at >= 0) this.focusFrom(at);
  }

  // A pick: the card's icon flies to the loadout column's new tile. The pick redraws the draft, which takes the card out of the page,
  // so the icon is copied and measured first; the flight is aimed after, once LoadoutTiles has drawn the tile (under this screen).
  private pick(i: number): void {
    const a = this.app, d = a.run?.state.draft, card = d?.picks[i], taken = d?.taken.length ?? 0;
    const icon = this.box.querySelectorAll('.ucard')[i]?.querySelector<HTMLImageElement>('img.px');
    const from = icon?.getBoundingClientRect(), copy = icon?.cloneNode(true) as HTMLImageElement | undefined;
    a.pick(i);
    // Nothing flies for a pick the core refused, nor for the backup, which heals the rack and gets no tile.
    if (!from || !copy || !card || card.id === 'backup' || (d?.taken.length ?? 0) === taken) return;
    this.fly(copy, from);
  }

  private fly(img: HTMLImageElement, from: DOMRect): void {
    const tiles = this.ui.querySelectorAll('.loadout .ltile'), tile = tiles[tiles.length - 1];
    if (!tile || this.opts.effects.reduced || typeof img.animate !== 'function') return;
    // The layer is scaled to the window, so screen measurements are divided by that scale to get back to its own 1280×720 pixels.
    const ui = this.ui.getBoundingClientRect(), k = ui.width / SCREEN_W || 1, to = tile.getBoundingClientRect();
    img.classList.add('fly');
    img.style.left = `${(from.left - ui.left) / k}px`;
    img.style.top = `${(from.top - ui.top) / k}px`;
    img.style.width = `${from.width / k}px`;
    img.style.height = `${from.height / k}px`;
    this.ui.appendChild(img);
    // Centre to centre; it shrinks on the way, and is gone when it lands (the tile pulses once the field is back in view).
    const dx = (to.left + to.width / 2 - (from.left + from.width / 2)) / k, dy = (to.top + to.height / 2 - (from.top + from.height / 2)) / k;
    const flight = img.animate([{ transform: 'translate(0,0)' }, { transform: `translate(${dx}px, ${dy}px) scale(.6)` }], { duration: 300, easing: 'ease-in' });
    flight.onfinish = () => img.remove();
  }

  private toggleLang = (): void => {
    const next = lang() === 'en' ? 'es' : 'en';
    this.app.store.setPrefs({ lang: next });
    setLang(next);
  };

  // A sound switch moves: every view refreshes, so the pause menu redraws in place (a keyboard player keeps the button) and the
  // HUD's MUTED badge follows.
  private tune(p: Partial<AudioPrefs>): void {
    this.opts.audio.set(p);
    this.app.refresh();
  }

  refresh(): void {
    // The Armory is read-only, frozen under the field, and nothing a refresh brings (a language, a sound switch) can reach it:
    // redrawing it would only drop the card under the mouse from its detail.
    if (this.kind !== 'none' && this.kind !== 'armory') this.redraw();
  }

  event(ev: RunEvent): void {
    if (this.kind === 'draft' && (ev.type === 'draftChanged' || ev.type === 'uptime' || ev.type === 'owned')) this.redraw();
  }

  private render(): void {
    const a = this.app;
    switch (this.kind) {
      case 'title':
        // The title shows the pair last played and the bests of its difficulty; PLAY and OVERTIME go through the setup.
        renderTitle(this.box, { bests: a.store.bests(), root: a.root, ...chosen(a.store.prefs()), play: () => a.openSetup('campaign'), overtime: () => a.openSetup('overtime'), howto: () => this.show('howto'), armory: () => a.act('armory'), toggleLang: this.toggleLang });
        break;
      case 'howto':
        renderHowto(this.box, () => this.show('title'));
        break;
      case 'setup':
        // Each pick is saved and redrawn in place; START plays the mode PLAY or OVERTIME asked for on the pair saved.
        renderSetup(this.box, {
          ...chosen(a.store.prefs()),
          root: a.root,
          pick: (k) => { a.store.setPrefs({ knight: k }); this.redraw(); },
          level: (d) => { a.store.setPrefs({ difficulty: d }); this.redraw(); },
          start: () => a.startRun(a.pendingMode, chosen(a.store.prefs())),
          back: () => a.quit(),
        });
        break;
      case 'recap':
        if (a.run) renderRecap(this.box, a.run, () => a.act('continue'));
        break;
      case 'draft':
        if (a.run) {
          // A hand just dealt (a wave's draft, a reroll) flips its cards in; the same hand drawn again does not.
          const hand = a.run.state.draft?.picks ?? null, fresh = hand !== this.dealt;
          this.dealt = hand;
          renderDraft(this.box, a.run, { pick: (i) => this.pick(i), reroll: () => a.reroll(), next: () => a.nextWave() }, fresh);
        }
        break;
      case 'armory':
        // Read only: what the run in hand owns and holds, or the loadout a run starts with when there is none (from the title).
        renderArmory(this.box, { owned: a.run?.state.owned ?? [...STARTING_LOADOUT], credits: a.run?.state.credits ?? 0, close: () => a.act('armory') });
        break;
      case 'pause':
        renderPause(this.box, {
          reduced: this.opts.effects.reduced,
          audio: this.opts.audio.settings,
          resume: () => a.setScreen('playing'),
          quit: () => a.quit(),
          armory: () => a.act('armory'),
          toggleLang: this.toggleLang,
          toggleReduced: () => {
            this.opts.effects.reduced = !this.opts.effects.reduced;
            a.store.setPrefs({ reducedFx: this.opts.effects.reduced });
            this.ui.classList.toggle('reduced', this.opts.effects.reduced);
            this.redraw();
          },
          toggleSound: () => this.tune({ sound: !this.opts.audio.settings.sound }),
          toggleMusic: () => this.tune({ music: !this.opts.audio.settings.music }),
          // Three steps, 1 to 3 and round again: never 0, where nothing would play with the switches on and no badge to say why.
          cycleVolume: () => this.tune({ volume: ((this.opts.audio.settings.volume % 3) + 1) as AudioPrefs['volume'] }),
        });
        break;
      case 'debrief':
        if (this.ended) {
          const s = this.ended.run.state;
          // The count-up and the stamp play once per run, and never under reduced effects: a refresh (M, H, a language switch) redraws
          // the finished screen. (resultOf makes a new result each time, so the run's own record is what is remembered.)
          const animate = this.debriefed !== this.ended && !this.opts.effects.reduced;
          this.debriefed = this.ended;
          // PLAY AGAIN skips the setup: the same mode on the same pair.
          renderDebrief(this.box, s, resultOf(s), this.ended, { again: () => a.startRun(s.cfg.mode, { knight: s.cfg.knight, difficulty: s.cfg.difficulty }), title: () => a.quit() }, animate);
        }
        break;
      default:
        break;
    }
  }
}

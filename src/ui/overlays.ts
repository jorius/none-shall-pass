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
  // Whether a button had the focus when the Armory opened (see show).
  private armoryKeyboard = false;
  private ended: { run: Run; newBest: boolean; prev: PrevBest } | null = null;

  constructor(private readonly ui: HTMLElement, private readonly app: App, private readonly opts: { effects: EffectsView }) {
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
    // The how-to is one screen deep: Esc goes back, as BACK does.
    window.addEventListener('keydown', (e) => {
      if (this.kind !== 'howto' || e.key !== 'Escape' || e.repeat) return;
      e.preventDefault();
      this.show('title');
    });
  }

  private onScreen(s: Screen): void {
    if (s === 'title') this.show('title');
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
    // The Armory gives CLOSE the focus to everyone, so a screen it hands back to asks what the player did on the way in:
    // a draft that opened on T with no button focused must not come back with a card under Space.
    const keyboard = this.kind === 'armory' ? this.armoryKeyboard : this.focused() >= 0;
    if (kind === 'armory') this.armoryKeyboard = keyboard;
    this.kind = kind;
    this.box.className = `ov show ov-${kind}`;
    this.inert(true);
    this.render();
    // The recap puts the focus on its own CONTINUE, the setup on its START and the Armory on its CLOSE, for every player.
    if (keyboard && kind !== 'recap' && kind !== 'setup' && kind !== 'armory') this.focusFrom(0);
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

  private toggleLang = (): void => {
    const next = lang() === 'en' ? 'es' : 'en';
    this.app.store.setPrefs({ lang: next });
    setLang(next);
  };

  refresh(): void {
    if (this.kind !== 'none') this.redraw();
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
        if (a.run) renderDraft(this.box, a.run, { pick: (i) => a.pick(i), reroll: () => a.reroll(), next: () => a.nextWave() });
        break;
      case 'armory':
        // Read only: what the run in hand owns and holds, or the loadout a run starts with when there is none (from the title).
        renderArmory(this.box, { owned: a.run?.state.owned ?? [...STARTING_LOADOUT], credits: a.run?.state.credits ?? 0, close: () => a.act('armory') });
        break;
      case 'pause':
        renderPause(this.box, {
          reduced: this.opts.effects.reduced,
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
        });
        break;
      case 'debrief':
        if (this.ended) {
          const s = this.ended.run.state;
          // PLAY AGAIN skips the setup: the same mode on the same pair.
          renderDebrief(this.box, s, resultOf(s), this.ended, { again: () => a.startRun(s.cfg.mode, { knight: s.cfg.knight, difficulty: s.cfg.difficulty }), title: () => a.quit() });
        }
        break;
      default:
        break;
    }
  }
}

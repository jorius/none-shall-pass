// core
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
import type { App } from '../app';
import { renderDebrief } from './debrief';
import { el } from './dom';
import { renderDraft } from './draftPanel';
import { renderPause } from './pausePanel';
import { renderHowto, renderTitle } from './title';

type Kind = 'none' | 'title' | 'howto' | 'draft' | 'pause' | 'debrief';

// The screens between and around the runs, in one box over the field; it follows the App's screen.
export class Overlays implements View {
  private readonly box: HTMLElement;
  private kind: Kind = 'none';
  private ended: { run: Run; newBest: boolean } | null = null;

  constructor(private readonly ui: HTMLElement, private readonly app: App, private readonly opts: { effects: EffectsView }) {
    this.box = el('div', 'ov', ui);
    app.onScreen = (s) => this.onScreen(s);
    app.onEnd = (run) => {
      const r = resultOf(run.state);
      const { newBest } = app.store.recordResult(r);
      this.ended = { run, newBest };
      this.show('debrief');
    };
  }

  private onScreen(s: Screen): void {
    if (s === 'title') this.show('title');
    else if (s === 'draft') this.show('draft');
    else if (s === 'paused') this.show('pause');
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

  private focusFrom(i: number): void {
    const open = this.buttons().filter((b, n) => n >= i && !b.disabled);
    (open[0] ?? this.buttons().filter((b) => !b.disabled).at(-1))?.focus();
  }

  private show(kind: Kind): void {
    const keyboard = this.focused() >= 0;
    this.kind = kind;
    this.box.className = `ov show ov-${kind}`;
    this.inert(true);
    this.render();
    if (keyboard) this.focusFrom(0);
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
        renderTitle(this.box, { bests: a.store.bests(), root: a.root, play: () => a.startRun('campaign'), overtime: () => a.startRun('overtime'), howto: () => this.show('howto'), toggleLang: this.toggleLang });
        break;
      case 'howto':
        renderHowto(this.box, () => this.show('title'));
        break;
      case 'draft':
        if (a.run) renderDraft(this.box, a.run, { pick: (i) => a.pick(i), reroll: () => a.reroll(), next: () => a.nextWave() });
        break;
      case 'pause':
        renderPause(this.box, {
          reduced: this.opts.effects.reduced,
          resume: () => a.setScreen('playing'),
          quit: () => a.quit(),
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
          renderDebrief(this.box, s, resultOf(s), this.ended.newBest, { again: () => a.startRun(s.cfg.mode), title: () => a.quit() });
        }
        break;
      default:
        break;
    }
  }
}

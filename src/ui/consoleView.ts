// core
import { isCheat, runCommand } from '../core/console';
import type { Screen } from '../core/keys';

// game
import type { View } from '../game/view';

// i18n
import { lang, t } from '../i18n';

// local
import type { App } from '../app';
import { el } from './dom';

// The backtick's terminal over the lanes. Everything typed, and every reply, goes in as text, never as markup.
// The App routes only Esc and the backtick while it is open, so the rest of the keyboard types here.
export class ConsoleView implements View {
  private readonly box: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly out: HTMLElement;
  private readonly input: HTMLInputElement;
  private greeted = false;

  constructor(private readonly ui: HTMLElement, private readonly app: App) {
    this.box = el('div', 'term', ui);
    this.bar = el('div', 'bar', this.box, t('console.title'));
    this.out = el('pre', '', this.box);
    this.out.setAttribute('aria-live', 'polite');
    const row = el('div', 'in', this.box);
    el('span', '', row, '$');
    this.input = el('input', '', row);
    this.input.setAttribute('aria-label', t('console.input'));
    this.input.spellcheck = false;
    this.input.autocomplete = 'off';
    this.input.addEventListener('keydown', (e) => {
      // Tab would walk the focus out onto the HUD's buttons, where the next Space clicks one.
      if (e.key === 'Tab') { e.preventDefault(); return; }
      if (e.key !== 'Enter') return;
      e.preventDefault();
      this.exec(this.input.value);
      this.input.value = '';
    });
    // A click anywhere in the terminal puts the caret back in the prompt.
    this.box.addEventListener('click', () => this.input.focus());
  }

  // Appended as a new text node, so a screen reader announces only the new lines.
  private print(lines: string[]): void {
    this.out.append(`${lines.join('\n')}\n`);
    this.out.scrollTop = this.out.scrollHeight;
  }

  private exec(cmd: string): void {
    this.print([`$ ${cmd}`]);
    const run = this.app.run;
    const reply = runCommand(cmd, { lang: lang(), owned: run?.state.owned ?? [] });
    const e = reply.effect;
    // An ended run's result is already saved, so a cheat could only mislabel it.
    if (isCheat(e) && run?.state.phase === 'ended') { this.print([t('console.ended')]); return; }
    if (reply.lines.length) this.print(reply.lines);
    if (!e) return;
    if (e.kind === 'clear') this.out.textContent = '';
    if (e.kind === 'exit') this.app.act('closeConsole');
    if (e.kind === 'glitch') {
      this.ui.classList.remove('glitch-hard');
      void this.ui.offsetWidth;
      this.ui.classList.add('glitch-hard');
      setTimeout(() => this.ui.classList.remove('glitch-hard'), 900);
    }
    if (isCheat(e) && run) {
      const evs = e.kind === 'credits' ? run.cheat('credits', e.amount) : run.cheat(e.kind === 'god' ? 'god' : 'skip');
      this.app.act('closeConsole');
      this.app.dispatch(evs);
    }
  }

  refresh(): void {
    this.bar.textContent = t('console.title');
    this.input.setAttribute('aria-label', t('console.input'));
  }

  // Closed, the prompt lets the focus go: a hidden input holding it would swallow every game key.
  screen(s: Screen): void {
    const open = s === 'console';
    this.box.classList.toggle('show', open);
    if (!open) {
      if (document.activeElement === this.input) this.input.blur();
      return;
    }
    if (!this.greeted) { this.print([t('console.greeting')]); this.greeted = true; }
    setTimeout(() => { if (this.box.classList.contains('show')) this.input.focus(); }, 0);
  }
}

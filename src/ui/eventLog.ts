// core
import { cardById } from '../core/content/cards';
import type { LogEntry, RunEvent } from '../core/events';
import type { Run } from '../core/run';

// game
import type { View } from '../game/view';

// i18n
import { loc, t } from '../i18n';

// local
import { button, el } from './dom';
import type { Inspector } from './inspector';

const GLYPH: Record<LogEntry['outcome'], string> = { hit: '✓', squire: '✓', charge: '✓', rule: '✓', served: '●', neutralized: '◆', breach: '✗', fp: '☹' };
const CLS: Record<LogEntry['outcome'], string> = { hit: 'ok', squire: 'ok', charge: 'ok', rule: 'ok', served: 'ok', neutralized: 'ok', breach: 'bad', fp: 'fp' };

// Every outcome, newest first, scrollable, with a MISTAKES filter: where you went wrong stays findable.
// Rows are text nodes only, so a payload in the log can never turn into markup.
export class EventLog implements View {
  private readonly rows: HTMLElement;
  private readonly none: HTMLElement;
  private readonly title: HTMLElement;
  private readonly count: HTMLElement;
  private readonly all: HTMLButtonElement;
  private readonly mis: HTMLButtonElement;
  private run: Run | null = null;
  // How far the list is scrolled only to keep rows still under a pointer resting at its top.
  private held = 0;

  constructor(bottom: HTMLElement, private readonly inspector: Inspector) {
    const box = el('div', 'log', bottom);
    const head = el('div', 'ptitle', box);
    this.title = el('span', '', head, t('log.title'));
    this.title.style.color = 'var(--dim)';
    this.count = el('span', 'count', head, t('log.hint'));
    const f = el('span', 'lfilter', head);
    this.all = button(f, 'on', t('log.all'), () => this.filter(false));
    this.mis = button(f, '', t('log.mistakes'), () => this.filter(true));
    // Outside .rows, which holds exactly one element per log entry.
    this.none = el('div', 'none', box, t('log.noMistakes'));
    this.none.hidden = true;
    this.rows = el('div', 'rows', box);
    // Once the pointer that was holding the top goes, the list returns to the newest row.
    this.rows.addEventListener('mouseleave', () => {
      if (this.held && this.rows.scrollTop === this.held) this.rows.scrollTop = 0;
      this.held = 0;
    });
  }

  private filter(mistakes: boolean): void {
    this.rows.classList.toggle('mistakes', mistakes);
    this.mis.classList.toggle('on', mistakes);
    this.all.classList.toggle('on', !mistakes);
    this.renderCount();
  }

  private pts(e: LogEntry): string {
    switch (e.outcome) {
      case 'hit': case 'charge': return e.packet.t.tier && e.packet.t.tier > 1 ? `+${e.points} · ${t(`tier.${e.packet.t.tier}`)}` : `+${e.points}`;
      case 'rule': return `+${e.points} · ${loc(cardById(e.ruleId!).name)}`;
      case 'neutralized': return `+${e.points} · ${loc(cardById(e.ruleId!).name)}`;
      case 'served': return e.packet.t.decoy ? `+${e.points} · ${t('log.notFooled')}` : `+${e.points}`;
      case 'breach': return t('log.uptimeLoss', { n: e.damage ?? 0 });
      case 'fp': return e.fpBy === 'rule' ? t('log.by', { rule: loc(cardById(e.ruleId!).name) }) : e.fpBy === 'squire' ? t('log.squireHit') : t('log.youHit');
      default: return `+${e.points}`;
    }
  }

  private row(e: LogEntry): HTMLElement {
    const r = el('div', `row ${CLS[e.outcome]}`), pts = this.pts(e);
    el('span', 'wv', r, `W${e.wave}`);
    el('span', 'g', r, GLYPH[e.outcome]);
    el('span', 'what', r, t(`log.${e.outcome}`));
    el('span', 'pl', r, e.packet.t.card);
    // The points column can ellipsize in Spanish; the tooltip keeps all of it readable.
    el('span', 'pts', r, pts).title = pts;
    r.addEventListener('mouseenter', () => this.inspector.verdict(e));
    return r;
  }

  private renderCount(): void {
    const log = this.run?.state.log ?? [];
    const m = log.filter((e) => e.outcome === 'breach' || e.outcome === 'fp').length;
    const events = log.length === 1 ? t('log.event') : t('log.events', { n: log.length });
    this.count.textContent = log.length ? `${events} · ${m === 1 ? t('log.nMistake') : t('log.nMistakes', { n: m })}` : t('log.hint');
    this.none.hidden = m > 0 || !this.rows.classList.contains('mistakes');
  }

  start(run: Run): void {
    this.run = run;
    this.held = 0;
    this.rows.replaceChildren();
    this.filter(false);
    this.renderCount();
  }

  refresh(): void {
    this.title.textContent = t('log.title');
    this.all.textContent = t('log.all');
    this.mis.textContent = t('log.mistakes');
    this.none.textContent = t('log.noMistakes');
    const top = this.rows.scrollTop;
    this.rows.replaceChildren(...(this.run?.state.log ?? []).map((e) => this.row(e)));
    this.rows.scrollTop = top;
    this.renderCount();
  }

  event(ev: RunEvent, run: Run): void {
    if (ev.type !== 'log') return;
    this.run = run;
    const prev = this.rows.scrollTop, r = this.row(ev.entry);
    this.rows.prepend(r);
    // The run keeps the newest LOG_MAX entries, and so does the DOM.
    while (this.rows.childElementCount > run.state.log.length) this.rows.lastElementChild!.remove();
    // Scrolled down reading an old row, or resting the pointer on one at the top: hold it in place instead of letting
    // the new row push it away (under a still pointer that would also swap the verdict in the inspector).
    const pointer = this.rows.matches(':hover');
    if (prev > 0 || pointer) {
      this.rows.scrollTop = prev + r.offsetHeight;
      if (pointer && prev === this.held) this.held = this.rows.scrollTop;
    }
    this.renderCount();
  }
}

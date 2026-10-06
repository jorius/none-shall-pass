// core
import type { LogEntry } from '../core/events';
import type { Run } from '../core/run';

// i18n
import { loc, t } from '../i18n';

// local
import { button, el } from './dom';

// What the caller knows and the list does not: the line for an empty list, and how many mistakes there were in all
// when the entries are themselves a capped list (the debrief's).
export interface MistakesOpts { empty?: string; total?: number }

// Breaches and false positives as a list: family, the full request with its tells underlined, and why.
// Text nodes only (el(..., text) and append(string)): the requests are attack strings by design and never touch innerHTML.
export const renderMistakes = (parent: HTMLElement, entries: LogEntry[], max: number, opts: MistakesOpts = {}): void => {
  const list = el('div', 'mistakes', parent);
  if (!entries.length) { el('p', '', list, opts.empty ?? t('recap.clean')); return; }
  const shown = entries.slice(0, max);
  for (const e of shown) {
    const m = el('div', `mistake ${e.outcome}`, list);
    const head = el('div', 'mhead', m);
    el('span', 'tag', head, t(`log.${e.outcome}`));
    el('span', 'fam', head, t(`family.${e.packet.t.kind}`));
    el('span', 'wv', head, `W${e.wave}`);
    const pre = el('pre', 'req', m);
    // The tells are authored against the whole request (the text the inspector marks), underlined here for free:
    // this is the lesson, not the test.
    const text = e.packet.t.raw, tells = (e.packet.t.hints ?? []).filter((h) => h.length);
    let i = 0;
    while (i < text.length) {
      let best: string | null = null, at = Infinity;
      for (const h of tells) { const j = text.indexOf(h, i); if (j >= 0 && j < at) { at = j; best = h; } }
      if (!best) { pre.append(text.slice(i)); break; }
      pre.append(text.slice(i, at), el('mark', '', undefined, best));
      i = at + best.length;
    }
    el('p', 'why', m, loc(e.packet.t.why));
  }
  const total = opts.total ?? entries.length;
  if (total > shown.length) el('p', 'more', list, t('recap.more', { n: total - shown.length }));
};

// One of a kind reads in the singular, as the log's count does.
const count = (n: number, one: string, many: string): string => (n === 1 ? t(one) : t(many, { n }));

// The wave's mistakes before its draft. CONTINUE takes the focus for every player: Space or Enter goes on.
export const renderRecap = (box: HTMLElement, run: Run, cont: () => void): void => {
  box.innerHTML = '';
  const s = run.state, m = s.waveMistakes;
  el('h2', '', box, t('recap.title', { n: s.wave }));
  const br = m.filter((e) => e.outcome === 'breach').length, fp = m.length - br;
  el('p', 'note', box, `${count(br, 'recap.breach', 'recap.breaches')} · ${count(fp, 'recap.fp', 'recap.fps')}`);
  el('div', 'draft-h', box, t('recap.what'));
  renderMistakes(box, m, 8);
  button(el('div', 'row-btns', box), 'btn', t('recap.continue'), cont).focus();
};

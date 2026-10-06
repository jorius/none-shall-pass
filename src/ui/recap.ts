// core
import type { LogEntry } from '../core/events';
import type { Run } from '../core/run';

// i18n
import { loc, t } from '../i18n';

// local
import { button, el } from './dom';

// Breaches and false positives as a list: family, the payload with its tells underlined, and why.
// Text nodes only (el(..., text) and append(string)): the payloads are attack strings by design and never touch innerHTML.
export const renderMistakes = (parent: HTMLElement, entries: LogEntry[], max: number, empty = t('recap.clean')): void => {
  const list = el('div', 'mistakes', parent);
  if (!entries.length) { el('p', '', list, empty); return; }
  for (const e of entries.slice(0, max)) {
    const m = el('div', `mistake ${e.outcome}`, list);
    const head = el('div', 'mhead', m);
    el('span', 'tag', head, t(`log.${e.outcome}`));
    el('span', 'fam', head, t(`family.${e.packet.t.kind}`));
    el('span', 'wv', head, `W${e.wave}`);
    const pre = el('pre', 'req', m);
    // The tells are underlined here for free: this is the lesson, not the test.
    const text = e.packet.t.card, tells = (e.packet.t.hints ?? []).filter((h) => h.length);
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
  if (entries.length > max) el('p', 'more', list, t('recap.more', { n: entries.length - max }));
};

// The wave's mistakes before its draft. CONTINUE takes the focus for every player: Space or Enter goes on.
export const renderRecap = (box: HTMLElement, run: Run, cont: () => void): void => {
  box.innerHTML = '';
  const s = run.state, m = s.waveMistakes;
  el('h2', '', box, t('recap.title', { n: s.wave }));
  const br = m.filter((e) => e.outcome === 'breach').length, fp = m.length - br;
  el('p', 'note', box, `${t('recap.breaches', { n: br })} · ${t('recap.fps', { n: fp })}`);
  el('div', 'draft-h', box, t('recap.what'));
  renderMistakes(box, m, 8);
  button(el('div', 'row-btns', box), 'btn', t('recap.continue'), cont).focus();
};

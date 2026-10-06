// core
import { grade, shareText, type RunResult } from '../core/score';
import { breachTotal, type RunState } from '../core/state';

// i18n
import { fmtNum, lang, loc, t } from '../i18n';

// local
import { button, el } from './dom';

// Every run-derived string (payloads, explanations, the share line) goes in as text, never as markup.
export const renderDebrief = (box: HTMLElement, s: RunState, r: RunResult, newBest: boolean, act: { again(): void; title(): void }): void => {
  box.innerHTML = '';
  const head = r.won ? t('debrief.won') : r.mode === 'overtime' ? t('debrief.overtimeOver') : r.reason === 'usersGone' ? t('debrief.usersGone') : t('debrief.serverDown');
  el('h2', '', box, head);
  const wrap = el('div', 'debrief', box);
  const left = el('div', '', wrap);
  const g = grade(r);
  if (g) { el('div', 'note', left, t('debrief.grade')); el('div', 'grade', left, g); }
  else { el('div', 'note', left, t('debrief.waves')); el('div', 'grade', left, String(r.wavesCleared)); }
  const sc = el('div', 'best', left);
  sc.append(el('b', '', undefined, `${t('debrief.score')} ${fmtNum(r.score)}`));
  if (newBest && !r.tampered) sc.append(' ', el('span', 'newbest', undefined, t('debrief.newBest')));
  if (r.tampered) el('div', 'note', left, t('debrief.tampered'));
  const st = r.stats;
  const list = el('div', 'statlist', left);
  const line = (k: string, v: string) => { const d = el('div', '', list, t(k)); d.append(el('b', '', undefined, v)); };
  line('debrief.hits', `${st.hits[1]} / ${st.hits[2]} / ${st.hits[3]}`);
  line('debrief.decoys', String(st.decoysKept));
  line('debrief.squire', String(st.squireHits));
  line('debrief.rules', String(st.ruleBlocks));
  line('debrief.served', String(st.served));
  line('debrief.neutralized', String(st.neutralized));
  line('debrief.fps', String(st.falsePositives));
  line('debrief.breaches', String(breachTotal(st)));
  line('debrief.uptime', `${r.uptime}%`);
  const right = el('div', '', wrap);
  el('div', 'draft-h', right, t('debrief.mistakes'));
  const mistakes = s.log.filter((e) => e.outcome === 'breach' || e.outcome === 'fp');
  const ml = el('div', 'mistakes', right);
  if (!mistakes.length) el('p', '', ml, t('debrief.noMistakes'));
  for (const e of mistakes.slice(0, 30)) {
    const m = el('div', 'mistake', ml);
    el('code', '', m, `W${e.wave} · ${t(`log.${e.outcome}`)} · ${e.packet.t.card}`);
    el('p', '', m, loc(e.packet.t.why));
  }
  const text = shareText(r, lang());
  const ta = el('textarea', 'share', right);
  ta.readOnly = true;
  ta.value = text;
  const row = el('div', 'row-btns', box);
  const copy = button(row, 'btn', t('debrief.copy'), () => {
    // Without clipboard access the line is only selected, and the button says so instead of claiming a copy.
    const fallback = (): void => { ta.focus(); ta.select(); copy.textContent = t('debrief.selected'); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => { copy.textContent = t('debrief.copied'); }, fallback);
    else fallback();
  });
  button(row, 'btn ghost', t('debrief.again'), act.again);
  button(row, 'btn ghost', t('debrief.toTitle'), act.title);
};

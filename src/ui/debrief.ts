// core
import { KNIGHTS } from '../core/content/knights';
import { CAMPAIGN } from '../core/content/waves';
import { DIFFICULTIES } from '../core/difficulty';
import { grade, shareText, type Grade, type RunResult } from '../core/score';
import { breachTotal, type RunState } from '../core/state';
import type { MaliciousKind } from '../core/types';

// i18n
import { fmtNum, lang, loc, t } from '../i18n';

// local
import { track } from '../analytics';
import { button, el } from './dom';
import { renderMistakes } from './recap';

// The best this slot held before the run's own result was saved: what the run had to beat.
export type PrevBest = { score: number; grade: Grade } | { wave: number; score: number } | null;

const FAMILIES: MaliciousKind[] = ['sqli', 'xss', 'brute', 'scan', 'flood'];

// Cmd on a Mac, Ctrl elsewhere, for the copy-it-yourself hint.
const copyKeys = (): string => {
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
  return /mac/i.test(nav.userAgentData?.platform || nav.platform || '') ? '⌘C' : 'CTRL+C';
};

// Every run-derived string (payloads, explanations, the share line) goes in as text, never as markup.
export const renderDebrief = (box: HTMLElement, s: RunState, r: RunResult, best: { newBest: boolean; prev: PrevBest }, act: { again(): void; title(): void }): void => {
  box.innerHTML = '';
  const head = r.won ? t('debrief.won') : r.mode === 'overtime' ? t('debrief.overtimeOver') : r.reason === 'usersGone' ? t('debrief.usersGone') : t('debrief.serverDown');
  el('h2', '', box, head);
  // Who held the gate, and at what: the knight, their motto and the difficulty.
  el('p', 'note', box, `${loc(KNIGHTS[r.knight].name)} · ${loc(KNIGHTS[r.knight].motto)} · ${loc(DIFFICULTIES[r.difficulty].name)}`);
  const wrap = el('div', 'debrief', box);
  const left = el('div', '', wrap);
  const g = grade(r);
  // One wave number everywhere (here, the share line, the title's best): the wave the run reached.
  if (g) { el('div', 'note', left, t('debrief.grade')); el('div', 'grade', left, g); }
  else { el('div', 'note', left, t('debrief.reachedTitle')); el('div', 'grade', left, String(r.wave)); }
  const sc = el('div', 'best', left);
  sc.append(el('b', '', undefined, `${t('debrief.score')} ${fmtNum(r.score)}`));
  if (best.newBest && !r.tampered) sc.append(' ', el('span', 'newbest', undefined, t('debrief.newBest')));
  const prev = best.prev;
  if (prev) el('div', 'note', left, 'grade' in prev ? t('debrief.prevCampaign', { s: fmtNum(prev.score), g: prev.grade }) : t('debrief.prevOvertime', { w: prev.wave, s: fmtNum(prev.score) }));
  if (r.tampered) el('div', 'note', left, t('debrief.tampered'));
  const st = r.stats;
  const list = el('div', 'statlist', left);
  const line = (k: string, v: string) => { const d = el('div', '', list, t(k)); d.append(el('b', '', undefined, v)); };
  if (r.mode === 'campaign') line('debrief.reached', `${r.wave} / ${CAMPAIGN.length}`);
  line('debrief.hits', `${st.hits[1]} / ${st.hits[2]} / ${st.hits[3]}`);
  line('debrief.decoys', String(st.decoysKept));
  line('debrief.squire', String(st.squireHits));
  line('debrief.charges', String(st.chargeHits));
  line('debrief.rules', String(st.ruleBlocks));
  line('debrief.served', String(st.served));
  line('debrief.neutralized', String(st.neutralized));
  line('debrief.fps', String(st.falsePositives));
  line('debrief.breaches', String(breachTotal(st)));
  // The breaches by family, under their total.
  const fams = el('div', 'fams', list);
  for (const f of FAMILIES) {
    const item = el('span', '', fams, `${t(`debrief.fam.${f}`)} `);
    item.append(el('b', '', undefined, String(st.breaches[f])));
  }
  line('debrief.uptime', `${r.uptime}%`);
  const right = el('div', '', wrap);
  el('div', 'draft-h', right, t('debrief.mistakes'));
  // The whole run's, newest first (the recap lists a wave's oldest first), in the same rows. The kept list is itself
  // capped, so the rest is counted from the run's totals.
  renderMistakes(right, s.mistakes, 30, { empty: t('debrief.noMistakes'), total: st.falsePositives + breachTotal(st) });
  const text = shareText(r, lang());
  const ta = el('textarea', 'share', right);
  ta.readOnly = true;
  ta.value = text;
  const row = el('div', 'row-btns', box);
  const copy = button(row, 'btn', t('debrief.copy'), () => {
    // Without clipboard access the line is only selected, and the button says so instead of claiming a copy.
    const fallback = (): void => { ta.focus(); ta.select(); copy.textContent = t('debrief.selected', { k: copyKeys() }); };
    const copied = (): void => { copy.textContent = t('debrief.copied'); track('share-copied', { mode: r.mode }); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(copied, fallback);
    else fallback();
  });
  button(row, 'btn ghost', t('debrief.again'), act.again);
  button(row, 'btn ghost', t('debrief.toTitle'), act.title);
};

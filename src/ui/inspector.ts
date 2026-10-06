// core
import type { Card } from '../core/content/cards';
import { NETWORKS } from '../core/content/networks';
import type { LogEntry } from '../core/events';
import { isBugged } from '../core/rules';
import type { Run } from '../core/run';
import type { Packet } from '../core/state';
import type { MaliciousKind } from '../core/types';

// art
import { BUG_OF } from '../art/sprites';

// game
import { CHIP_COLOR } from '../game/cards';
import type { View } from '../game/view';

// i18n
import { loc, t } from '../i18n';

// local
import { el } from './dom';

const PORT = [':22', '/login', '/search', '/comments', ':*'];
const ENTITY: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
// Packets carry attack strings by design: every string that is not our own markup goes through here before innerHTML.
const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ENTITY[c]);
// With hints on, wraps each tell in a <mark>; the text inside and between the marks is escaped like any other.
// An empty tell is found at every position and would stop the search, so only the real ones take part.
const mark = (text: string, hints: string[] | undefined, on: boolean): string => {
  const tells = on ? hints?.filter((h) => h.length) : undefined;
  if (!tells?.length) return esc(text);
  let out = '', i = 0;
  while (i < text.length) {
    let best: string | null = null, at = Infinity;
    for (const h of tells) { const j = text.indexOf(h, i); if (j >= 0 && j < at) { at = j; best = h; } }
    if (!best) { out += esc(text.slice(i)); break; }
    out += `${esc(text.slice(i, at))}<mark>${esc(best)}</mark>`;
    i = at + best.length;
  }
  return out;
};

type Focus = { kind: 'packet'; p: Packet } | { kind: 'verdict'; e: LogEntry } | { kind: 'card'; c: Card } | { kind: 'empty' };

// The bottom-left panel: the hovered packet, else a log verdict or loadout card the pointer is on, else the target.
export class Inspector implements View {
  readonly box: HTMLElement;
  private hovered: Packet | null = null;
  private pinned: Focus = { kind: 'empty' };
  private run: Run | null = null;
  private shownKey = '';

  constructor(bottom: HTMLElement) {
    this.box = el('div', 'ins', bottom);
    // Leaving the whole panel, not just the log, so a verdict stays up while the pointer moves over to copy its request.
    bottom.addEventListener('mouseleave', () => this.leave());
    this.render();
  }

  start(run: Run): void { this.run = run; this.hovered = null; this.pinned = { kind: 'empty' }; this.render(); }
  refresh(): void { this.shownKey = ''; this.render(); }

  hover(p: Packet | null): void { this.hovered = p; this.render(); }
  verdict(e: LogEntry): void { this.pinned = { kind: 'verdict', e }; this.hovered = null; this.render(); }
  card(c: Card): void { this.pinned = { kind: 'card', c }; this.hovered = null; this.render(); }
  leave(): void { this.pinned = { kind: 'empty' }; this.render(); }

  frame(run: Run | null): void {
    this.run = run;
    if (this.hovered?.dead) this.hovered = null;
    this.render();
  }

  private focus(): Focus {
    if (this.hovered) return { kind: 'packet', p: this.hovered };
    if (this.pinned.kind !== 'empty') return this.pinned;
    const s = this.run?.state;
    const locked = s && s.locked !== null ? s.packets.find((p) => p.id === s.locked) : undefined;
    return locked ? { kind: 'packet', p: locked } : { kind: 'empty' };
  }

  private render(): void {
    const f = this.focus(), s = this.run?.state;
    const key = f.kind === 'packet' ? `p${f.p.id}|${s?.locked}|${s?.hints}|${s?.owned.length}`
      : f.kind === 'verdict' ? `v${f.e.seq}` : f.kind === 'card' ? `c${f.c.id}` : 'empty';
    if (key === this.shownKey) return;
    this.shownKey = key;
    this.box.scrollTop = 0;
    if (f.kind === 'empty') {
      this.box.innerHTML = `<div class="ptitle">${t('inspector.title')}</div><p class="empty">${esc(t('inspector.empty1'))}<br>${esc(t('inspector.empty2'))}</p>`;
      return;
    }
    if (f.kind === 'card') {
      const c = f.c;
      this.box.innerHTML = `<div class="ptitle">${t('inspector.loadout')}<span>${t(`draft.cat.${c.cat}`)}</span><span>${t(`draft.rarity.${c.rarity}`)}</span></div>
        <div class="cname">${esc(loc(c.name))}</div><p class="why">${esc(loc(c.does))}</p>
        <p class="why dim"><b class="irl">${t('inspector.irl')}</b> ${esc(loc(c.irl))}</p><p class="why dim"><b class="catch">${t('inspector.catch')}</b> ${esc(loc(c.catch))}</p>`;
      return;
    }
    const p = f.kind === 'packet' ? f.p : f.e.packet;
    const hintsOn = !!s?.hints;
    const lens = !!s?.owned.includes('lens') && !!p.t.decoded;
    let tags = '';
    if (f.kind === 'packet') {
      if (s?.locked === p.id) tags += `<span class="lk">${t('inspector.target')}</span>`;
      if (s && isBugged(p.t, s.owned)) tags += `<span class="fl">${esc(t('inspector.bugged', { bug: t(`bug.${BUG_OF[p.t.kind as MaliciousKind]}`) }))}</span>`;
    }
    // The protocol badge the card wears on the field, in the card's own colour (protocol only: it never says whether the packet is an attack).
    const chip = `<span class="chip" style="background:${CHIP_COLOR[p.t.chip]}">${esc(p.t.chip)}</span>`;
    const title = `<div class="ptitle">${t('inspector.title')}${chip}${tags}<span class="ip">${esc(t('inspector.src', { ip: p.src }))}</span><span class="as">${esc(loc(NETWORKS[p.t.net]))}</span><span class="ln">${esc(t('inspector.lane', { lane: PORT[p.lane] }))}</span></div>`;
    let req = `<pre class="req">${mark(p.t.request.join('\n'), p.t.hints, hintsOn)}</pre>`;
    if (lens) req += `<div class="ctx">${t('inspector.decoded')} · ${mark(p.t.decoded!, p.t.decodedHints, hintsOn)}</div>`;
    if (p.t.context) req += `<div class="ctx">${mark(loc(p.t.context), p.t.hints, hintsOn)}</div>`;
    if (f.kind === 'verdict') {
      // The answer before the evidence: a six-line request would otherwise push the explanation out of the panel.
      const fam = t(`family.${p.t.kind}`), tier = p.t.tier ?? 1;
      const sub = p.t.kind === 'legit' ? (p.t.decoy ? ` · ${t('inspector.decoy')}` : '') : ` · ${'●'.repeat(tier)}${'○'.repeat(3 - tier)} ${t(`tier.${tier}`)}`;
      this.box.innerHTML = `${title}<div class="verdict ${p.t.kind === 'legit' ? 'ok' : 'bad'}">${esc(t('inspector.verdict', { family: fam }) + sub)}</div><p class="why">${esc(loc(p.t.why))}</p>${req}`;
    } else {
      this.box.innerHTML = `${title}${req}<div class="ask">${s?.locked === p.id ? t('inspector.askLocked') : t('inspector.ask')}</div>`;
    }
  }
}

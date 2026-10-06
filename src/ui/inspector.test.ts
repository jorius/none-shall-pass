// @vitest-environment jsdom
// packages
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// core
import { cardById } from '../core/content/cards';
import type { LogEntry } from '../core/events';
import { Run } from '../core/run';
import type { Packet } from '../core/state';
import { cfg, place } from '../core/testkit';
import type { Template } from '../core/types';

// i18n
import { setLang } from '../i18n';

// local
import { EventLog } from './eventLog';
import { Inspector } from './inspector';

const text = (root: ParentNode, sel: string): string => root.querySelector(sel)?.textContent ?? '';
const entry = (run: Run, packet: Packet, over: Partial<LogEntry> = {}): LogEntry => {
  const e: LogEntry = { seq: ++run.state.logSeq, wave: run.state.wave, outcome: 'breach', packet, points: 0, damage: 10, ...over };
  run.state.log.unshift(e);
  return e;
};

describe('Inspector and EventLog escaping', () => {
  // The game shows attack strings by design; none of them may ever become markup.
  const EVIL = `<img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>' OR 1=1--`;
  const t: Template = {
    id: 'evil', lane: 3, kind: 'xss', tier: 2, net: 'vps', weight: 1, card: `POST /comments ${EVIL}`,
    request: ['POST /comments HTTP/1.1', `{"body":"${EVIL}"}`], hints: ['<img src=x', '<script>'], decodedHints: ['onerror='],
    context: { en: `THIS IP · ${EVIL}`, es: `ESTA IP · ${EVIL}` }, why: { en: `Why · ${EVIL}`, es: `Por qué · ${EVIL}` },
    raw: '', decoded: `decoded ${EVIL}`, chip: 'POST', path: '/comments', payload: EVIL,
  };
  const SRC = `192.0.2.9"><img src=x onerror="window.__pwned=3">`;
  let bottom: HTMLElement, ins: Inspector, log: EventLog, run: Run, p: Packet;
  const markup = (): number => bottom.querySelectorAll('img, script').length;
  beforeEach(() => {
    bottom = document.createElement('div');
    document.body.appendChild(bottom);
    ins = new Inspector(bottom);
    log = new EventLog(bottom, ins);
    run = new Run(cfg());
    run.state.owned.push('lens', 'obs2');
    p = { id: 1, t, src: SRC, lane: 3, x: 300, checked: false, entering: false, doomed: false, held: false, heldOnce: false, slowed: false, dead: false };
    run.state.packets.push(p);
    ins.start(run);
    log.start(run);
  });
  afterEach(() => {
    bottom.remove();
    delete (window as unknown as { __pwned?: number }).__pwned;
  });

  for (const hints of [false, true]) {
    it(`renders a hovered packet's request, context, decode and source as text (hints ${hints ? 'on' : 'off'})`, () => {
      run.setHints(hints);
      run.state.locked = p.id;
      ins.hover(p);
      const box = bottom.querySelector('.ins') as HTMLElement;
      expect(markup()).toBe(0);
      expect(text(box, '.req')).toBe(`POST /comments HTTP/1.1\n{"body":"${EVIL}"}`);
      expect(box.textContent).toContain(`decoded ${EVIL}`);
      expect(box.textContent).toContain(`THIS IP · ${EVIL}`);
      expect(box.textContent).toContain(SRC);
      if (hints) {
        // Each tell is wrapped in a mark, and the text inside and around every mark stays text.
        expect([...box.querySelectorAll('.req mark')].map((m) => m.textContent)).toEqual(['<img src=x', '<script>']);
        expect([...box.querySelectorAll('.ctx mark')].map((m) => m.textContent)).toEqual(['onerror=', '<img src=x', '<script>']);
      } else {
        expect(box.querySelectorAll('mark')).toHaveLength(0);
      }
      expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
    });
  }

  it('renders a log row and its verdict as text', () => {
    run.setHints(true);
    log.event({ type: 'log', entry: entry(run, p) }, run);
    const row = bottom.querySelector('.rows .row') as HTMLElement;
    expect(text(row, '.pl')).toBe(`POST /comments ${EVIL}`);
    row.dispatchEvent(new MouseEvent('mouseenter'));
    expect(text(bottom, '.ins .why')).toBe(`Why · ${EVIL}`);
    expect(bottom.querySelector('.ins')?.textContent).toContain(`{"body":"${EVIL}"}`);
    expect(markup()).toBe(0);
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });
});

describe('Inspector', () => {
  let bottom: HTMLElement, ins: Inspector, run: Run;
  const box = (): HTMLElement => bottom.querySelector('.ins') as HTMLElement;
  beforeEach(() => {
    bottom = document.createElement('div');
    ins = new Inspector(bottom);
    run = new Run(cfg());
    ins.start(run);
  });
  afterEach(() => setLang('en'));

  it('explains the controls until there is something to read', () => {
    expect(text(box(), '.ptitle')).toBe('INSPECTOR');
    expect(text(box(), '.empty')).toContain('Tab cycles the packets');
  });

  it('reads the hovered packet, then falls back to the target', () => {
    const a = place(run.state, 'sqli-tautology', 300), b = place(run.state, 'legit-socks', 100);
    ins.hover(a);
    expect(text(box(), '.req')).toBe(a.t.request.join('\n'));
    expect(text(box(), '.ptitle')).toContain('SRC 192.0.2.10');
    expect(text(box(), '.ptitle')).toContain('AS64511 · VPS host');
    expect(text(box(), '.ptitle')).toContain('LANE /search');
    expect(text(box(), '.ask')).toBe('Malicious or legit? Tab or click to target it.');
    run.state.locked = b.id;
    ins.hover(null);
    expect(text(box(), '.req')).toBe(b.t.request.join('\n'));
    expect(text(box(), '.ptitle .lk')).toBe('TARGET');
    expect(text(box(), '.ask')).toContain('Space to throw');
    b.held = true;
    ins.frame(run);
    expect(text(box(), '.ptitle .hd')).toBe('HELD');
    run.state.locked = null;
    ins.frame(run);
    expect(box().querySelector('.empty')).not.toBeNull();
  });

  it('flags bugged attacks and shows the decode only with the lens', () => {
    const p = place(run.state, 'sqli-encoded', 300);
    ins.hover(p);
    expect(box().querySelector('.ptitle .fl')).toBeNull();
    expect(box().textContent).not.toContain('DECODED');
    run.state.owned.push('obs3', 'lens');
    ins.frame(run);
    expect(text(box(), '.ptitle .fl')).toBe('BUGGED · spider');
    expect(box().textContent).toContain("DECODED · GET /search?q=' OR 1=1--");
  });

  it('skips an empty hint instead of hanging on it', () => {
    const p = place(run.state, 'sqli-tautology', 300);
    p.t = { ...p.t, hints: ['', "' OR 1=1--"] };
    run.setHints(true);
    ins.hover(p);
    expect([...box().querySelectorAll('.req mark')].map((m) => m.textContent)).toEqual(["' OR 1=1--"]);
    p.t = { ...p.t, hints: [''] };
    ins.refresh();
    expect(box().querySelectorAll('mark')).toHaveLength(0);
    expect(text(box(), '.req')).toBe(p.t.request.join('\n'));
  });

  it('drops a hovered packet once it is gone', () => {
    const p = place(run.state, 'sqli-tautology', 300);
    ins.hover(p);
    p.dead = true;
    ins.frame(run);
    expect(box().querySelector('.empty')).not.toBeNull();
  });

  it('shows a verdict with its family, tier and explanation', () => {
    const p = place(run.state, 'sqli-union', 300);
    ins.verdict({ seq: 1, wave: 1, outcome: 'breach', packet: p, points: 0, damage: 12 });
    expect(box().querySelector('.verdict')?.className).toBe('verdict bad');
    expect(text(box(), '.verdict')).toBe('VERDICT · SQL INJECTION · ●●○ tricky');
    expect(text(box(), '.why')).toBe(p.t.why.en);
    expect(box().querySelector('.ask')).toBeNull();
    const d = place(run.state, 'decoy-union', 100);
    ins.verdict({ seq: 2, wave: 1, outcome: 'served', packet: d, points: 40 });
    expect(box().querySelector('.verdict')?.className).toBe('verdict ok');
    expect(text(box(), '.verdict')).toBe('VERDICT · REAL USER · looked scary, was fine');
  });

  it('explains a loadout card, and clears it on leave', () => {
    ins.card(cardById('destrier'));
    expect(text(box(), '.ptitle')).toBe('LOADOUTKNIGHTLEGENDARY');
    expect(text(box(), '.cname')).toBe('Destrier I');
    expect(text(box(), '.why b.irl')).toBe('IN REAL LIFE');
    expect(text(box(), '.why b.catch')).toBe('THE CATCH');
    ins.leave();
    expect(box().querySelector('.empty')).not.toBeNull();
  });

  it('starts a new run clean', () => {
    const p = place(run.state, 'sqli-tautology', 300);
    ins.hover(p);
    ins.start(new Run(cfg()));
    expect(box().querySelector('.empty')).not.toBeNull();
    ins.verdict({ seq: 1, wave: 1, outcome: 'breach', packet: p, points: 0, damage: 12 });
    ins.start(new Run(cfg()));
    expect(box().querySelector('.empty')).not.toBeNull();
  });

  it('relabels in Spanish on refresh', () => {
    const p = place(run.state, 'brute-ssh-root', 300);
    run.state.owned.push('obs1');
    run.state.locked = p.id;
    ins.frame(run);
    setLang('es');
    ins.refresh();
    expect(text(box(), '.ptitle')).toContain('OBJETIVO');
    expect(text(box(), '.ptitle .fl')).toBe('CON BICHOS · escarabajo');
    expect(text(box(), '.ptitle')).toContain('CARRIL :22');
    expect(text(box(), '.ask')).toContain('Espacio para lanzar');
  });

  it('keeps a verdict while the pointer crosses the panel, and drops it when the pointer leaves', () => {
    const p = place(run.state, 'sqli-union', 300);
    ins.verdict({ seq: 1, wave: 1, outcome: 'breach', packet: p, points: 0, damage: 12 });
    box().dispatchEvent(new MouseEvent('mouseleave'));
    expect(box().querySelector('.verdict')).not.toBeNull();
    bottom.dispatchEvent(new MouseEvent('mouseleave'));
    expect(box().querySelector('.verdict')).toBeNull();
  });
});

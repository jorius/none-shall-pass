// @vitest-environment jsdom
// packages
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// core
import { LOG_MAX } from '../core/constants';
import type { LogEntry } from '../core/events';
import { Run } from '../core/run';
import { cfg, place } from '../core/testkit';

// i18n
import { setLang } from '../i18n';

// local
import { EventLog } from './eventLog';
import { Inspector } from './inspector';

describe('EventLog', () => {
  let bottom: HTMLElement, log: EventLog, run: Run;
  const rows = (): HTMLElement[] => [...bottom.querySelectorAll<HTMLElement>('.rows .row')];
  const cells = (r: HTMLElement): string[] => [...r.children].map((c) => c.textContent ?? '');
  const count = (): string => bottom.querySelector('.log .count')?.textContent ?? '';
  const button = (i: number): HTMLButtonElement => bottom.querySelectorAll<HTMLButtonElement>('.lfilter button')[i];
  // Like the core: newest first, capped at LOG_MAX, and the event carries the entry.
  const add = (template: string, over: Partial<LogEntry>): void => {
    const s = run.state;
    const e: LogEntry = { seq: ++s.logSeq, wave: s.wave, outcome: 'served', packet: place(s, template, 300), points: 10, ...over };
    s.log.unshift(e);
    if (s.log.length > LOG_MAX) s.log.pop();
    log.event({ type: 'log', entry: e }, run);
  };
  beforeEach(() => {
    bottom = document.createElement('div');
    log = new EventLog(bottom, new Inspector(bottom));
    run = new Run(cfg());
    log.start(run);
  });
  afterEach(() => {
    setLang('en');
    vi.restoreAllMocks();
  });

  it('lists every outcome newest first and counts the mistakes', () => {
    expect(count()).toBe('hover a line for the verdict');
    add('legit-socks', { outcome: 'served', points: 10 });
    add('sqli-union', { outcome: 'hit', points: 100 });
    add('xss-script', { outcome: 'breach', points: 0, damage: 10 });
    add('legit-oreilly', { outcome: 'fp', points: 0, fpBy: 'rule', ruleId: 'quote' });
    add('scan-telnet', { outcome: 'rule', points: 20, ruleId: 'lockdown' });
    add('decoy-union', { outcome: 'served', points: 40 });
    add('legit-login', { outcome: 'fp', points: 0, fpBy: 'squire' });
    expect(rows().map((r) => r.className)).toEqual(['row fp', 'row ok', 'row ok', 'row fp', 'row bad', 'row ok', 'row ok']);
    expect(cells(rows()[0])).toEqual(['W1', '☹', 'FALSE POSITIVE', 'POST /login user=maria.g pass=••••••••', 'the squire hit a real user']);
    expect(cells(rows()[1]).at(-1)).toBe('+40 · not fooled');
    expect(cells(rows()[2]).at(-1)).toBe('+20 · Port lockdown');
    expect(cells(rows()[3]).slice(2).join('|')).toBe("FALSE POSITIVE|GET /search?q=O'Reilly+books|by Quote filter");
    expect(cells(rows()[4]).slice(1, 3).concat(cells(rows()[4]).at(-1)!)).toEqual(['✗', 'BREACH', '−10% uptime']);
    expect(cells(rows()[5]).at(-1)).toBe('+100 · tricky');
    expect(count()).toBe('7 events · 3 mistakes');
  });

  it('files a charge kill with the hits, at the flat rate with no tier label', () => {
    add('sqli-orderby', { outcome: 'charge', points: 20 });
    expect(rows()[0].className).toBe('row ok');
    expect(cells(rows()[0]).slice(1, 3)).toEqual(['✓', 'CHARGE']);
    expect(cells(rows()[0]).at(-1)).toBe('+20');
    expect(count()).toBe('1 event · 0 mistakes');
  });

  it('filters down to mistakes, and keeps the filter as new rows arrive', () => {
    add('sqli-union', { outcome: 'breach', points: 0, damage: 12 });
    expect(count()).toBe('1 event · 1 mistake');
    add('legit-socks', { outcome: 'served' });
    button(1).click();
    expect(bottom.querySelector('.rows')?.classList.contains('mistakes')).toBe(true);
    expect([button(0).className, button(1).className]).toEqual(['', 'on']);
    add('legit-rain-jacket', { outcome: 'served' });
    expect(bottom.querySelector('.rows')?.classList.contains('mistakes')).toBe(true);
    expect(rows()).toHaveLength(3);
    button(0).click();
    expect(bottom.querySelector('.rows')?.classList.contains('mistakes')).toBe(false);
  });

  it('says so when the MISTAKES view has nothing to show', () => {
    const none = (): HTMLElement => bottom.querySelector('.log .none') as HTMLElement;
    add('legit-socks', { outcome: 'served' });
    expect(none().hidden).toBe(true);
    button(1).click();
    expect(none().hidden).toBe(false);
    expect(none().textContent).toBe('No mistakes yet.');
    add('sqli-union', { outcome: 'breach', points: 0, damage: 12 });
    expect(none().hidden).toBe(true);
    log.start(new Run(cfg()));
    button(1).click();
    setLang('es');
    log.refresh();
    expect(none().hidden).toBe(false);
    expect(none().textContent).toBe('Aún no hay errores.');
    button(0).click();
    expect(none().hidden).toBe(true);
  });

  it('holds the rows still under a pointer resting at the top, and returns to the top when it leaves', () => {
    const box = bottom.querySelector('.rows') as HTMLElement;
    vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(24);
    const hover = vi.spyOn(box, 'matches').mockImplementation((sel) => sel === ':hover');
    add('legit-socks', { outcome: 'served' });
    add('legit-socks', { outcome: 'served' });
    expect(box.scrollTop).toBe(48);
    box.dispatchEvent(new MouseEvent('mouseleave'));
    expect(box.scrollTop).toBe(0);
    // Scrolled down by the player: held while reading, and left where the player put it.
    hover.mockReturnValue(false);
    box.scrollTop = 30;
    add('legit-socks', { outcome: 'served' });
    expect(box.scrollTop).toBe(54);
    box.dispatchEvent(new MouseEvent('mouseleave'));
    expect(box.scrollTop).toBe(54);
    // At the top with no pointer on the list, the newest row simply shows up first.
    box.scrollTop = 0;
    add('legit-socks', { outcome: 'served' });
    expect(box.scrollTop).toBe(0);
  });

  it('never holds more rows than the run keeps', () => {
    for (let i = 0; i < LOG_MAX + 25; i++) add('legit-socks', { outcome: 'served' });
    expect(rows()).toHaveLength(LOG_MAX);
    expect(count()).toBe(`${LOG_MAX} events · 0 mistakes`);
  });

  it('pins the verdict of a hovered row in the inspector', () => {
    add('sqli-union', { outcome: 'breach', points: 0, damage: 12 });
    rows()[0].dispatchEvent(new MouseEvent('mouseenter'));
    expect(bottom.querySelector('.ins .verdict')?.textContent).toBe('VERDICT · SQL INJECTION · ●●○ tricky');
  });

  it('starts a new run empty and unfiltered', () => {
    add('sqli-union', { outcome: 'breach', points: 0, damage: 12 });
    button(1).click();
    run = new Run(cfg());
    log.start(run);
    expect(rows()).toHaveLength(0);
    expect(bottom.querySelector('.rows')?.classList.contains('mistakes')).toBe(false);
    expect(count()).toBe('hover a line for the verdict');
  });

  it('relabels and rebuilds its rows in Spanish on refresh', () => {
    add('scan-telnet', { outcome: 'rule', points: 20, ruleId: 'lockdown' });
    add('legit-login', { outcome: 'fp', points: 0, fpBy: 'knight' });
    setLang('es');
    log.refresh();
    expect(bottom.querySelector('.log .ptitle')?.textContent).toBe('REGISTRO2 eventos · 1 errorTODOERRORES');
    expect(cells(rows()[0]).slice(2)).toEqual(['FALSO POSITIVO', 'POST /login user=maria.g pass=••••••••', 'le diste a un usuario real']);
    expect(cells(rows()[1]).at(-1)).toBe('+20 · Puertos cerrados');
  });
});

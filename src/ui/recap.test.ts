// @vitest-environment jsdom
// packages
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

// core
import type { LogEntry } from '../core/events';
import { freshState, place } from '../core/testkit';
import type { Template } from '../core/types';

// i18n
import { setLang } from '../i18n';

// local
import { renderMistakes } from './recap';

// A mistake on a real template (a port scan, which has no context line of its own), with whatever the case changes about it.
const mistake = (over: Partial<Template> = {}, templateId = 'scan-telnet'): LogEntry => {
  const packet = place(freshState(), templateId, 300);
  packet.t = { ...packet.t, ...over };
  return { seq: 1, wave: 3, outcome: 'breach', packet, points: 0 };
};

describe('renderMistakes', () => {
  let box: HTMLElement;
  const rows = (entries: LogEntry[]): HTMLElement[] => {
    box.replaceChildren();
    renderMistakes(box, entries, 8);
    return [...box.querySelectorAll<HTMLElement>('.mistake')];
  };
  const marks = (root: ParentNode): (string | null)[] => [...root.querySelectorAll('mark')].map((m) => m.textContent);
  beforeEach(() => {
    document.body.innerHTML = '';
    box = document.createElement('div');
    document.body.append(box);
  });
  afterEach(() => setLang('en'));

  it('shows the context line under the request, with the tells that only the context carries underlined', () => {
    // The tell is in the context line alone: the request has nothing for it to mark, as with credential stuffing.
    const [row] = rows([mistake({ raw: 'POST /login HTTP/2', hints: ['41 logins'], context: { en: 'THIS IP · 41 logins in 60 s', es: 'ESTA IP · 41 inicios de sesión en 60 s' } })]);
    const ctx = row.querySelector<HTMLElement>('.ctx')!;
    expect(ctx.textContent).toBe('THIS IP · 41 logins in 60 s');
    expect(marks(ctx)).toEqual(['41 logins']);
    expect(marks(row.querySelector('pre')!)).toEqual([]);
    // Between the request and the reason, in that order.
    expect([...row.children].map((c) => c.className)).toEqual(['mhead', 'req', 'ctx', 'why']);
  });

  it('underlines the tells of the credential-stuffing context the way the inspector does', () => {
    const [row] = rows([mistake({}, 'brute-stuffing')]);
    expect(row.querySelector('.ctx')?.textContent).toBe('THIS IP · 41 logins in 60 s · 41 different accounts');
    expect(marks(row.querySelector('.ctx')!)).toEqual(['41', '60 s', '41']);
  });

  it('marks a tell in the request and in the context both, each by its own text', () => {
    const [row] = rows([mistake({ raw: 'user=a&pass=41', hints: ['41'], context: { en: '41 logins', es: '41 inicios' } })]);
    expect(marks(row.querySelector('pre')!)).toEqual(['41']);
    expect(marks(row.querySelector('.ctx')!)).toEqual(['41']);
  });

  it('draws no context line for a packet that has none', () => {
    const [row] = rows([mistake()]);
    expect(row.querySelector('.ctx')).toBeNull();
    expect([...row.children].map((c) => c.className)).toEqual(['mhead', 'req', 'why']);
  });

  it('reads the context in the language on screen', () => {
    setLang('es');
    const [row] = rows([mistake({ raw: 'x', hints: ['41'], context: { en: 'THIS IP · 41', es: 'ESTA IP · 41 inicios' } })]);
    expect(row.querySelector('.ctx')?.textContent).toBe('ESTA IP · 41 inicios');
    expect(marks(row.querySelector('.ctx')!)).toEqual(['41']);
  });

  it('puts the context in as text: an attack string in it is never markup', () => {
    const evil = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=2</script>';
    const [row] = rows([mistake({ raw: 'x', hints: ['<script>'], context: { en: `THIS IP · ${evil}`, es: `ESTA IP · ${evil}` } })]);
    expect(row.querySelector('.ctx')?.textContent).toBe(`THIS IP · ${evil}`);
    expect(marks(row.querySelector('.ctx')!)).toEqual(['<script>']);
    expect(box.querySelectorAll('img, script')).toHaveLength(0);
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined();
  });
});

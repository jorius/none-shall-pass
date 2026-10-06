// packages
import { describe, expect, it } from 'vitest';

// core
import { STUFF_IP } from '../constants';
import { cardParts, TEMPLATES, templateById } from './packets';

const DOC_IP = /^(192\.0\.2|198\.51\.100|203\.0\.113)\.\d{1,3}$/;
const LANES_FOR: Record<string, number[]> = { scan: [4], brute: [0, 1], sqli: [2], xss: [3], flood: [1, 2, 3] };

describe('packet catalogue', () => {
  it('has unique ids and positive weights', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TEMPLATES) expect(t.weight).toBeGreaterThan(0);
  });

  it('gives every malicious packet a tier and no legit packet one', () => {
    for (const t of TEMPLATES) {
      if (t.kind === 'legit') expect(t.tier).toBeUndefined();
      else expect([1, 2, 3]).toContain(t.tier);
      if (t.decoy) expect(t.kind).toBe('legit');
    }
  });

  it('puts each family on its lanes', () => {
    for (const t of TEMPLATES) if (t.kind !== 'legit') expect(LANES_FOR[t.kind]).toContain(t.lane);
  });

  it('explains every packet in both languages', () => {
    for (const t of TEMPLATES) {
      expect(t.why.en.length).toBeGreaterThan(10);
      expect(t.why.es.length).toBeGreaterThan(10);
      if (t.context) { expect(t.context.en).not.toBe(''); expect(t.context.es).not.toBe(''); }
    }
  });

  it('only uses documentation addresses and .example hosts', () => {
    for (const t of TEMPLATES) {
      if (t.fixedSrc) expect(t.fixedSrc).toMatch(DOC_IP);
      for (const line of t.request) {
        const host = /^Host: (.+)$/.exec(line);
        if (host) expect(host[1]).toMatch(/\.example$/);
      }
    }
    expect(STUFF_IP).toMatch(DOC_IP);
  });

  it('anchors every hint in the text the player can see, in both languages', () => {
    for (const t of TEMPLATES) {
      const shown = [t.card, ...t.request].join('\n');
      // An empty hint is found everywhere and underlines nothing; the renderers skip it, the catalogue must not have one.
      for (const h of [...(t.hints ?? []), ...(t.decodedHints ?? [])]) expect(h.length, `${t.id} empty hint`).toBeGreaterThan(0);
      for (const h of t.hints ?? []) {
        const inBothContexts = !!t.context && t.context.en.includes(h) && t.context.es.includes(h);
        expect(shown.includes(h) || inBothContexts, `${t.id} hint ${h}`).toBe(true);
      }
      for (const h of t.decodedHints ?? []) expect(t.decoded, `${t.id} decoded hint`).toContain(h);
    }
  });

  it('derives raw and decoded text', () => {
    const enc = templateById('sqli-encoded');
    expect(enc.decoded).toBe("GET /search?q=' OR 1=1--");
    expect(templateById('sqli-tautology').decoded).toBeUndefined();
    expect(enc.raw).toContain('%27%20OR%201%3D1--');
    expect(() => templateById('nope')).toThrow('unknown packet template nope');
  });

  it('covers every family the waves need', () => {
    const kinds = new Set(TEMPLATES.map((t) => t.kind));
    for (const k of ['legit', 'sqli', 'xss', 'brute', 'scan', 'flood']) expect(kinds.has(k as never)).toBe(true);
    const scans = TEMPLATES.filter((t) => t.kind === 'scan').map((t) => t.port).sort((a, b) => a! - b!);
    expect(scans).toEqual([23, 445, 3389]);
  });
});

describe('card parts', () => {
  it('splits the request line into chip, path and payload', () => {
    expect(cardParts("GET /search?q=' OR 1=1--")).toEqual({ chip: 'GET', path: '/search', payload: "q=' OR 1=1--" });
    expect(cardParts('POST /login user=admin pass=123456')).toEqual({ chip: 'POST', path: '/login', payload: 'user=admin pass=123456' });
    expect(cardParts('POST /search {"q":"socks","sort":"price; DROP TABLE orders--"}')).toEqual({ chip: 'POST', path: '/search', payload: '{"q":"socks","sort":"price; DROP TABLE orders--"}' });
    expect(cardParts('SSH-2.0-libssh_0.9.6 root:toor')).toEqual({ chip: 'SSH', path: ':22', payload: 'libssh_0.9.6 root:toor' });
    expect(cardParts('SSH-2.0-OpenSSH_9.6 publickey deploy')).toEqual({ chip: 'SSH', path: ':22', payload: 'OpenSSH_9.6 publickey deploy' });
    expect(cardParts('SYN → :23 telnet')).toEqual({ chip: 'TCP', path: 'SYN :23', payload: '→ telnet' });
    expect(cardParts('SMTP :25 EHLO mail.partner.example')).toEqual({ chip: 'SMTP', path: ':25', payload: 'EHLO mail.partner.example' });
    expect(cardParts('GET /comments?page=2')).toEqual({ chip: 'GET', path: '/comments', payload: 'page=2' });
    expect(cardParts('GET /login')).toEqual({ chip: 'GET', path: '/login', payload: '' });
  });

  it('gives every template its parts, and the payload never repeats the path', () => {
    for (const t of TEMPLATES) {
      expect(['GET', 'POST', 'SSH', 'SMTP', 'TCP']).toContain(t.chip);
      expect(t.path.length).toBeGreaterThan(0);
      expect(t.payload.startsWith(t.path)).toBe(false);
      // The payload is lifted from the card, never invented; the TCP branch alone moves the arrow next to the service.
      expect(t.card).toContain(t.payload.replace(/^→ /, '').slice(0, 8));
    }
  });

  it('falls back to a TCP chip with no path for a shape it does not know', () => {
    expect(cardParts('ICMP echo request')).toEqual({ chip: 'TCP', path: '', payload: 'ICMP echo request' });
  });
});

// packages
import { describe, expect, it } from 'vitest';

// core
import type { CardId } from './content/cards';
import { templateById as T } from './content/packets';
import { chargeReady, destrierLevel, firewallRule, isBugged, lockdownBlocks, obsLevel, serverFix, tarpitSlows } from './rules';

const p = (id: string, src = '192.0.2.10', x = 0) => ({ t: T(id), src, x });

describe('firewall rules', () => {
  it('quote filter catches quotes, including the innocent O\'Reilly search', () => {
    const owned: CardId[] = ['quote'];
    expect(firewallRule(p('sqli-tautology'), owned, {})).toBe('quote');
    expect(firewallRule(p('legit-oreilly'), owned, {})).toBe('quote');
    expect(firewallRule(p('sqli-encoded'), owned, {})).toBeNull();
    expect(firewallRule(p('sqli-orderby'), owned, {})).toBeNull();
    expect(firewallRule(p('legit-socks'), owned, {})).toBeNull();
  });

  it('fail2ban bans an IP on /login or ssh after two failures', () => {
    const owned: CardId[] = ['f2b'];
    expect(firewallRule(p('brute-admin', '203.0.113.66'), owned, { '203.0.113.66': 1 })).toBeNull();
    expect(firewallRule(p('brute-admin', '203.0.113.66'), owned, { '203.0.113.66': 2 })).toBe('f2b');
    expect(firewallRule(p('legit-login', '203.0.113.66'), owned, { '203.0.113.66': 2 })).toBe('f2b');
    expect(firewallRule(p('sqli-tautology', '203.0.113.66'), owned, { '203.0.113.66': 5 })).toBeNull();
  });

  it('cdn absorbs flood traffic only', () => {
    expect(firewallRule(p('flood-search'), ['cdn'], {})).toBe('cdn');
    expect(firewallRule(p('legit-rain-jacket'), ['cdn'], {})).toBeNull();
  });

  it('port lockdown stops scans only', () => {
    expect(lockdownBlocks(T('scan-rdp'), ['lockdown'])).toBe(true);
    expect(lockdownBlocks(T('legit-smtp'), ['lockdown'])).toBe(false);
    expect(lockdownBlocks(T('scan-rdp'), [])).toBe(false);
  });
});

describe('server fixes', () => {
  it('prepared statements stop SQLi except the sort-field trick', () => {
    expect(serverFix(T('sqli-union'), ['prepared'])).toBe('prepared');
    expect(serverFix(T('sqli-orderby'), ['prepared'])).toBeNull();
    expect(serverFix(T('sqli-orderby'), ['sortlist'])).toBe('sortlist');
  });
  it('mfa stops brute force, csp stops xss, nothing stops scans at the server', () => {
    expect(serverFix(T('brute-stuffing'), ['mfa'])).toBe('mfa');
    expect(serverFix(T('xss-jslink'), ['csp'])).toBe('csp');
    expect(serverFix(T('scan-rdp'), ['prepared', 'mfa', 'csp', 'sortlist'])).toBeNull();
    expect(serverFix(T('legit-socks'), ['prepared'])).toBeNull();
  });
});

describe('observability bugs', () => {
  it('reveals tiers up to the owned level and never decoys', () => {
    expect(obsLevel([])).toBe(0);
    expect(obsLevel(['obs1', 'obs2'])).toBe(2);
    expect(isBugged(T('sqli-tautology'), ['obs1'])).toBe(true);
    expect(isBugged(T('sqli-union'), ['obs1'])).toBe(false);
    expect(isBugged(T('sqli-union'), ['obs1', 'obs2'])).toBe(true);
    expect(isBugged(T('sqli-orderby'), ['obs1', 'obs2'])).toBe(false);
    expect(isBugged(T('sqli-orderby'), ['obs1', 'obs2', 'obs3'])).toBe(true);
    expect(isBugged(T('decoy-union'), ['obs1', 'obs2', 'obs3'])).toBe(false);
  });
});

describe('destrier', () => {
  it('levels with the highest tier owned', () => {
    expect(destrierLevel([])).toBe(0);
    expect(destrierLevel(['destrier'])).toBe(1);
    expect(destrierLevel(['destrier', 'destrier2'])).toBe(2);
    expect(destrierLevel(['destrier', 'destrier2', 'destrier3'])).toBe(3);
  });

  it('has its charge ready from level III until the charge is used', () => {
    expect(chargeReady([], false)).toBe(false);
    expect(chargeReady(['destrier', 'destrier2'], false)).toBe(false);
    expect(chargeReady(['destrier', 'destrier2', 'destrier3'], false)).toBe(true);
    expect(chargeReady(['destrier', 'destrier2', 'destrier3'], true)).toBe(false);
  });
});

describe('tarpit', () => {
  it('slows repeat IPs on /login inside the tar only', () => {
    const seen = { '203.0.113.66': 2, '192.0.2.10': 1 };
    expect(tarpitSlows(p('brute-admin', '203.0.113.66', 400), ['tarpit'], seen)).toBe(true);
    expect(tarpitSlows(p('brute-admin', '192.0.2.10', 400), ['tarpit'], seen)).toBe(false);
    expect(tarpitSlows(p('brute-admin', '203.0.113.66', 900), ['tarpit'], seen)).toBe(false);
    expect(tarpitSlows(p('brute-admin', '203.0.113.66', 400), [], seen)).toBe(false);
    expect(tarpitSlows(p('brute-ssh-root', '203.0.113.66', 400), ['tarpit'], seen)).toBe(false);
  });
});

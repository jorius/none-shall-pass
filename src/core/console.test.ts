// packages
import { describe, expect, it } from 'vitest';

// core
import { HELP, isCheat, MAN, runCommand } from './console';

const en = { lang: 'en' as const, owned: ['lockdown'] as const };
const es = { lang: 'es' as const, owned: [] as const };

describe('runCommand', () => {
  it('lists commands without the cheats', () => {
    const r = runCommand('help', en);
    expect(r.lines.join('\n')).toContain('man <attack>');
    expect(r.lines.join('\n')).not.toMatch(/\bgod\b|credits|skip/);
    expect(runCommand('help', es).lines.join('\n')).toContain('man <ataque>');
    expect(runCommand('help', es).lines.join('\n')).not.toMatch(/\bgod\b|credits|créditos|skip/);
  });

  it('answers whoami and man pages in both languages', () => {
    expect(runCommand('whoami', en).lines[0]).toContain('Black Knight');
    expect(runCommand('whoami', es).lines[0]).toContain('Caballero Negro');
    expect(runCommand('man sqli', en).lines.join(' ')).toContain('prepared statements');
    expect(runCommand('man xss', es).lines.join(' ')).toContain('Content-Security-Policy');
    expect(runCommand('man', en).lines[0]).toContain('man sqli');
    expect(runCommand('man nothing', en).lines[0]).toContain('man sqli');
    expect(runCommand('man xss', en).lines.join(' ')).toContain('encode for the output context; allow only http(s) links');
    expect(runCommand('man xss', es).lines.join(' ')).toContain('codifica según el contexto de salida; permite solo enlaces http(s)');
  });

  it('does not read man pages off the object prototype', () => {
    for (const name of ['constructor', '__proto__', 'CONSTRUCTOR', '__PROTO__']) {
      expect(runCommand(`man ${name}`, en).lines, name).toEqual(['What manual page do you want? Try: man sqli']);
    }
  });

  it('hands out copies, so a caller editing a reply cannot change the next one', () => {
    for (const cmd of ['help', 'man sqli']) {
      const first = runCommand(cmd, en);
      const before = [...first.lines];
      first.lines.push('tampered');
      first.lines[0] = 'tampered';
      expect(runCommand(cmd, en).lines, cmd).toEqual(before);
    }
  });

  it('has every console table in both languages, line for line', () => {
    expect(Object.keys(MAN).length).toBeGreaterThan(0);
    expect(HELP.es.length).toBe(HELP.en.length);
    for (const [name, page] of Object.entries(MAN)) expect(page.es.length, name).toBe(page.en.length);
  });

  it('reflects port lockdown in nmap', () => {
    expect(runCommand('nmap shop.example', en).lines.join('\n')).toMatch(/23\/tcp\s+filtered/);
    expect(runCommand('nmap shop.example', es).lines.join('\n')).toMatch(/23\/tcp\s+open/);
    // Lockdown, not the language, decides what answers.
    expect(runCommand('nmap shop.example', { lang: 'en', owned: [] }).lines.join('\n')).toMatch(/23\/tcp\s+open/);
    expect(runCommand('nmap shop.example', { lang: 'es', owned: ['lockdown'] }).lines.join('\n')).toMatch(/23\/tcp\s+filtered/);
  });

  it('jokes about dropping everything and refuses sudo', () => {
    expect(runCommand('iptables -P INPUT DROP', en).lines[0]).toContain('zero users');
    expect(runCommand('sudo make me a sandwich', en).lines[0]).toBe('Nice try.');
    expect(runCommand('sudo rm -rf /', en)).toEqual({ lines: ['No.'], effect: { kind: 'glitch' } });
    expect(runCommand('sudo rm -rf --no-preserve-root /', es).effect).toEqual({ kind: 'glitch' });
  });

  it('runs cheats and says the run is tampered', () => {
    expect(runCommand('god', en).effect).toEqual({ kind: 'god' });
    expect(runCommand('credits 500', en)).toMatchObject({ effect: { kind: 'credits', amount: 500 } });
    expect(runCommand('credits', en).effect).toEqual({ kind: 'credits', amount: 1000 });
    expect(runCommand('credits -5', en).effect).toEqual({ kind: 'credits', amount: 1 });
    // The Run's cheat() floors the amount but does not guard NaN, so a non-number must still reach it as 1.
    expect(runCommand('credits abc', en).effect).toEqual({ kind: 'credits', amount: 1 });
    expect(runCommand('skip', es).lines[0]).toContain('TAMPERED');
    expect(isCheat({ kind: 'god' })).toBe(true);
    expect(isCheat({ kind: 'clear' })).toBe(false);
    expect(isCheat(undefined)).toBe(false);
    for (const cmd of ['god', 'skip', 'credits 5']) expect(isCheat(runCommand(cmd, en).effect), cmd).toBe(true);
    for (const cmd of ['sudo rm -rf /', 'exit', 'clear']) expect(isCheat(runCommand(cmd, en).effect), cmd).toBe(false);
  });

  it('always hands the Run a finite whole amount of credits', () => {
    expect(runCommand('credits 2.7', en).effect).toEqual({ kind: 'credits', amount: 2 });
    expect(runCommand('credits 1e309', en).effect).toEqual({ kind: 'credits', amount: 1_000_000 });
    for (const arg of ['abc', 'Infinity', '-Infinity', '0x10', '0']) {
      const e = runCommand(`credits ${arg}`, en).effect;
      const amount = e?.kind === 'credits' ? e.amount : NaN;
      expect(amount, `credits ${arg}`).toSatisfy((n: number) => Number.isInteger(n) && n >= 1 && n <= 1_000_000);
    }
  });

  it('handles clear, exit, blanks and unknowns', () => {
    expect(runCommand('clear', en)).toEqual({ lines: [], effect: { kind: 'clear' } });
    expect(runCommand('exit', en).effect).toEqual({ kind: 'exit' });
    expect(runCommand('   ', en)).toEqual({ lines: [] });
    expect(runCommand('hack the planet', en).lines[0]).toBe('hack: command not found. Try help.');
    expect(runCommand('hack', es).lines[0]).toBe('hack: comando no encontrado. Prueba help.');
  });
});

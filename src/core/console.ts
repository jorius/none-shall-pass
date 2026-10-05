// core
import type { CardId } from './content/cards';
import type { Lang } from './types';

export type ConsoleEffect = { kind: 'clear' } | { kind: 'exit' } | { kind: 'glitch' } | { kind: 'god' } | { kind: 'skip' } | { kind: 'credits'; amount: number };
export interface ConsoleReply { lines: string[]; effect?: ConsoleEffect }

const T = <A extends readonly string[]>(en: A, es: A) => ({ en, es });

export const HELP = T(
  ['commands:', '  help                 this list', '  whoami               who you are', '  man <attack>         sqli · xss · brute · scan · flood', '  nmap shop.example    what answers from outside', '  clear · exit'],
  ['comandos:', '  help                 esta lista', '  whoami               quién eres', '  man <ataque>         sqli · xss · brute · scan · flood', '  nmap shop.example    qué responde desde afuera', '  clear · exit'],
);

export const MAN: Record<string, { en: readonly string[]; es: readonly string[] }> = {
  sqli: T(
    ['SQLI(7)  SQL injection', "Input spliced into a query becomes part of it: ' OR 1=1-- matches every row.", 'Fix: prepared statements; allow-list identifiers such as sort columns.'],
    ['SQLI(7)  inyección SQL', "La entrada pegada en una consulta se vuelve parte de ella: ' OR 1=1-- coincide con todas las filas.", 'Solución: sentencias preparadas; listas permitidas para identificadores como columnas de orden.'],
  ),
  xss: T(
    ['XSS(7)  cross-site scripting', "Markup from users runs as code in other users' browsers: <script>, onerror=, javascript: links.", 'Fix: encode for the output context; allow only http(s) links; add a Content-Security-Policy.'],
    ['XSS(7)  cross-site scripting', 'El marcado de usuarios se ejecuta como código en los navegadores de otros: <script>, onerror=, enlaces javascript:.', 'Solución: codifica según el contexto de salida; permite solo enlaces http(s); agrega una Content-Security-Policy.'],
  ),
  brute: T(
    ['BRUTE(7)  password guessing, spraying, stuffing', 'Lists of common or leaked passwords, tried until one works.', 'Fix: MFA, SSH keys, rate limits, fail2ban.'],
    ['BRUTE(7)  adivinanza, spraying, stuffing', 'Listas de contraseñas comunes o filtradas, probadas hasta que una funciona.', 'Solución: MFA, llaves SSH, límites de intentos, fail2ban.'],
  ),
  scan: T(
    ['SCAN(7)  port scanning', 'SYN probes map which services answer before the real attack.', "Fix: close what you don't use; default-deny."],
    ['SCAN(7)  escaneo de puertos', 'Sondas SYN mapean qué servicios responden antes del ataque real.', 'Solución: cierra lo que no usas; denegar por defecto.'],
  ),
  flood: T(
    ['FLOOD(7)  denial of service', 'Thousands of harmless-looking requests; the volume is the attack.', 'Fix: a CDN, rate limits, caching.'],
    ['FLOOD(7)  denegación de servicio', 'Miles de peticiones de aspecto inofensivo; el volumen es el ataque.', 'Solución: una CDN, límites de peticiones, caché.'],
  ),
};

const MAN_HINT = { en: 'What manual page do you want? Try: man sqli', es: '¿Qué página del manual quieres? Prueba: man sqli' };
const TAMPERED = { en: 'This run is now marked TAMPERED.', es: 'Esta partida queda marcada como TAMPERED.' };

const nmap = (lang: Lang, owned: readonly CardId[]): string[] => {
  const locked = owned.includes('lockdown');
  const row = (port: string, svc: string, open: boolean) => `${port.padEnd(9)}${(open ? 'open' : 'filtered').padEnd(10)}${svc}`;
  return [
    lang === 'es' ? 'Iniciando Nmap ( https://nmap.org )' : 'Starting Nmap ( https://nmap.org )',
    'PORT     STATE     SERVICE',
    row('22/tcp', 'ssh', true),
    row('23/tcp', 'telnet', !locked),
    row('25/tcp', 'smtp', true),
    row('443/tcp', 'https', true),
    row('445/tcp', 'microsoft-ds', !locked),
    row('3389/tcp', 'ms-wbt-server', !locked),
    lang === 'es' ? 'Nmap terminado: 1 dirección IP (1 host activo)' : 'Nmap done: 1 IP address (1 host up)',
  ];
};

export const isCheat = (e?: ConsoleEffect): boolean => !!e && (e.kind === 'god' || e.kind === 'skip' || e.kind === 'credits');

export const runCommand = (input: string, ctx: { lang: Lang; owned: readonly CardId[] }): ConsoleReply => {
  const { lang } = ctx;
  const line = input.trim().replace(/\s+/g, ' ');
  if (!line) return { lines: [] };
  const [cmd, ...args] = line.split(' ');
  const c = cmd.toLowerCase();
  switch (c) {
    case 'help': return { lines: [...HELP[lang]] };
    case 'whoami': return { lines: [lang === 'es' ? 'el Caballero Negro. Brazos: los dos, por ahora.' : 'the Black Knight. Arms: both, for now.'] };
    case 'man': {
      // An own-property check, so 'man constructor' or 'man __proto__' cannot read Object.prototype.
      const name = (args[0] ?? '').toLowerCase();
      const page = Object.hasOwn(MAN, name) ? MAN[name] : undefined;
      return { lines: page ? [...page[lang]] : [MAN_HINT[lang]] };
    }
    case 'nmap': return { lines: nmap(lang, ctx.owned) };
    case 'iptables':
      if (line === 'iptables -P INPUT DROP') {
        return { lines: [lang === 'es' ? 'Listo. Tu servidor está perfectamente seguro y tiene cero usuarios.' : 'Done. Your server is perfectly secure and has zero users.'] };
      }
      break;
    case 'sudo':
      if (/^sudo rm -rf( --no-preserve-root)? \/$/.test(line)) return { lines: ['No.'], effect: { kind: 'glitch' } };
      return { lines: [lang === 'es' ? 'Buen intento.' : 'Nice try.'] };
    case 'clear': return { lines: [], effect: { kind: 'clear' } };
    case 'exit': case 'quit': return { lines: [], effect: { kind: 'exit' } };
    case 'god': return { lines: [`${lang === 'es' ? 'Modo dios activado.' : 'God mode on.'} ${TAMPERED[lang]}`], effect: { kind: 'god' } };
    case 'skip': return { lines: [`${lang === 'es' ? 'Oleada saltada.' : 'Wave skipped.'} ${TAMPERED[lang]}`], effect: { kind: 'skip' } };
    case 'credits': {
      const n = args.length ? Math.min(1_000_000, Math.max(1, Math.floor(Number(args[0]) || 1))) : 1000;
      return { lines: [`+${n} ${lang === 'es' ? 'créditos.' : 'credits.'} ${TAMPERED[lang]}`], effect: { kind: 'credits', amount: n } };
    }
  }
  return { lines: [lang === 'es' ? `${cmd}: comando no encontrado. Prueba help.` : `${cmd}: command not found. Try help.`] };
};

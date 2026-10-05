// core
import type { Kind, Localized } from '../types';

export type Mode = 'campaign' | 'overtime';

export interface WaveDef {
  id: string;
  name: Localized;
  intro: Localized;
  only?: Kind[];
  boost: Partial<Record<Kind, number>>;
  spawn: number;
  secs: number;
  speedMult: number;
  tier3Mult: number;
}

export const CAMPAIGN: readonly WaveDef[] = [
  { id: 'recon', name: { en: 'RECON', es: 'RECONOCIMIENTO' }, intro: { en: 'Someone is knocking on every port.', es: 'Alguien está tocando todos los puertos.' },
    only: ['legit', 'scan'], boost: { scan: 2 }, spawn: 1.4, secs: 50, speedMult: 1, tier3Mult: 1 },
  { id: 'brute', name: { en: 'BRUTE FORCE', es: 'FUERZA BRUTA' }, intro: { en: 'The login page is getting popular.', es: 'La página de inicio de sesión se está volviendo popular.' },
    only: ['legit', 'scan', 'brute'], boost: { brute: 2.5 }, spawn: 1.2, secs: 60, speedMult: 1, tier3Mult: 1 },
  { id: 'sqli', name: { en: 'SQL INJECTION', es: 'INYECCIÓN SQL' }, intro: { en: 'Someone is poking at /search.', es: 'Alguien está hurgando en /search.' },
    only: ['legit', 'scan', 'brute', 'sqli'], boost: { sqli: 2.2 }, spawn: 1.15, secs: 60, speedMult: 1, tier3Mult: 1 },
  { id: 'xss', name: { en: 'XSS', es: 'XSS' }, intro: { en: 'The comments section is getting busy.', es: 'La sección de comentarios se está llenando.' },
    only: ['legit', 'scan', 'brute', 'sqli', 'xss'], boost: { xss: 3 }, spawn: 1.1, secs: 60, speedMult: 1, tier3Mult: 1 },
  { id: 'flood', name: { en: 'BOTNET FLOOD', es: 'INUNDACIÓN BOTNET' }, intro: { en: 'A botnet just woke up.', es: 'Una botnet acaba de despertar.' },
    boost: { flood: 4, brute: 1.5 }, spawn: 0.75, secs: 60, speedMult: 1, tier3Mult: 1 },
  { id: 'finale', name: { en: 'FINALE', es: 'FINAL' }, intro: { en: 'Everything, all at once.', es: 'Todo, al mismo tiempo.' },
    boost: {}, spawn: 0.8, secs: 60, speedMult: 1, tier3Mult: 1.5 },
];

const MAX_SPEED_MULT = 150 / 72;

export const overtimeWave = (n: number): WaveDef => ({
  id: 'overtime',
  name: { en: `OVERTIME ${n}`, es: `TIEMPO EXTRA ${n}` },
  intro: { en: 'They keep coming.', es: 'Siguen llegando.' },
  boost: {},
  spawn: Math.max(0.45, 0.8 * 0.95 ** (n - 1)),
  secs: 45,
  speedMult: Math.min(MAX_SPEED_MULT, 1.06 ** (n - 1)),
  tier3Mult: 1 + 0.15 * (n - 1),
});

export const waveFor = (mode: Mode, n: number): WaveDef =>
  mode === 'campaign' ? CAMPAIGN[Math.min(n, CAMPAIGN.length) - 1] : overtimeWave(n);

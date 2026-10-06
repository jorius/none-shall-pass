// core
import type { Localized, Tier } from './types';

export type Difficulty = 'intern' | 'analyst' | 'incident' | 'zeroday';

export interface DifficultyDef {
  id: Difficulty;
  mult: number;
  speed: number;
  rep: number;
  hints: boolean;
  name: Localized;
  desc: Localized;
}

export const DIFFICULTY_IDS: readonly Difficulty[] = ['intern', 'analyst', 'incident', 'zeroday'];

export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  intern: { id: 'intern', mult: 0.5, speed: 0.75, rep: 14, hints: true, name: { en: 'Intern', es: 'Practicante' },
    desc: { en: 'Packets at 75% speed, 14 reputation, only obvious attacks until wave 4. For learning the tells.', es: 'Paquetes al 75%, 14 de reputación, solo ataques obvios hasta la oleada 4. Para aprender las señales.' } },
  analyst: { id: 'analyst', mult: 1, speed: 1, rep: 10, hints: true, name: { en: 'Analyst', es: 'Analista' },
    desc: { en: 'The game as designed: 10 reputation, tricky attacks as the waves bring them.', es: 'El juego tal como se diseñó: 10 de reputación, ataques engañosos según llegan las oleadas.' } },
  incident: { id: 'incident', mult: 1.5, speed: 1.25, rep: 8, hints: true, name: { en: 'Incident', es: 'Incidente' },
    desc: { en: 'Packets at 125%, 8 reputation, tricky attacks twice as common from wave 2.', es: 'Paquetes al 125%, 8 de reputación, ataques engañosos el doble de comunes desde la oleada 2.' } },
  zeroday: { id: 'zeroday', mult: 2, speed: 1.5, rep: 5, hints: false, name: { en: 'Zero-day', es: 'Día cero' },
    desc: { en: 'Packets at 150%, 5 reputation, sneaky attacks from their first wave and more of them, no hints.', es: 'Paquetes al 150%, 5 de reputación, ataques sigilosos desde su primera oleada y más de ellos, sin pistas.' } },
};

// A weight multiplier on a template's tier for this difficulty and wave: 0 removes it from the deal.
export const tierWeight = (d: Difficulty, wave: number, tier: Tier): number => {
  if (tier === 1) return 1;
  if (d === 'intern') return wave < 4 ? 0 : 1;
  if (d === 'incident') return tier === 2 && wave >= 2 ? 2 : 1;
  if (d === 'zeroday') return tier === 3 ? 2.5 : 1.5;
  return 1;
};

export const allowsHints = (d: Difficulty): boolean => DIFFICULTIES[d].hints;

// core
import type { Localized } from '../types';

export type KnightId = 'black' | 'sentinel' | 'raider' | 'warden' | 'ghost' | 'forge';

// What the sprite builder draws differently per knight (src/art/sprites.ts reads this; the core only carries it).
export interface KnightLook {
  plume?: boolean;
  face: 'open' | 'closed';
  braid?: boolean;
  beard?: 'brown' | 'red';
  goggles?: boolean;
  chest: 'cross' | 'plain' | 'chevron' | 'split' | 'cloak' | 'apron';
  shield: 'cross' | 'eye' | 'blade' | 'split' | 'mask' | 'prompt';
}

export interface KnightDef {
  id: KnightId;
  she: boolean;
  name: Localized;
  team: Localized;
  motto: Localized;
  who: Localized;
  color: string;
  look: KnightLook;
  // Palette letters to recolour (src/art/pixels.ts PAL), empty for the stock sprite.
  pal: Record<string, string>;
}

export const KNIGHT_IDS: readonly KnightId[] = ['black', 'sentinel', 'raider', 'warden', 'ghost', 'forge'];

export const KNIGHTS: Record<KnightId, KnightDef> = {
  black: { id: 'black', she: false, name: { en: 'The Black Knight', es: 'El Caballero Negro' }, team: { en: 'THE CLASSIC', es: 'EL CLÁSICO' },
    motto: { en: '"None shall pass."', es: '"Nadie pasará."' }, who: { en: 'The original gatekeeper. Holds the line on stubbornness alone.', es: 'El guardián original. Sostiene la línea a pura terquedad.' },
    color: '#f2efe7', look: { plume: true, face: 'closed', chest: 'cross', shield: 'cross' }, pal: {} },
  sentinel: { id: 'sentinel', she: true, name: { en: 'Sentinel', es: 'Centinela' }, team: { en: 'BLUE TEAM', es: 'EQUIPO AZUL' },
    motto: { en: '"Logs don\'t lie."', es: '"Los logs no mienten."' }, who: { en: 'A defender who lives in the SOC: alerts, baselines and long night shifts.', es: 'Una defensora que vive en el SOC: alertas, líneas base y turnos de noche largos.' },
    color: '#2fb6ff', look: { plume: true, face: 'open', braid: true, chest: 'plain', shield: 'eye' },
    pal: { R: '#2fb6ff', r: '#16608f', B: '#16608f', b: '#0d3a57', y: '#e8c870', Y: '#b8963e' } },
  raider: { id: 'raider', she: false, name: { en: 'Raider', es: 'Asaltante' }, team: { en: 'RED TEAM', es: 'EQUIPO ROJO' },
    motto: { en: '"Think like the attacker."', es: '"Piensa como el atacante."' }, who: { en: 'An operator who breaks in for a living, with permission, so the real ones can\'t.', es: 'Un operador que irrumpe por oficio, con permiso, para que los de verdad no puedan.' },
    color: '#ff2f2f', look: { plume: true, face: 'closed', chest: 'chevron', shield: 'blade' },
    pal: { l: '#6d7690', w: '#a7b2c4', m: '#3a4152', d: '#262a35', B: '#a3161c', b: '#5e0c10' } },
  warden: { id: 'warden', she: true, name: { en: 'Warden', es: 'Guardiana' }, team: { en: 'PURPLE TEAM', es: 'EQUIPO MORADO' },
    motto: { en: '"Break it, then fix it."', es: '"Rómpelo, luego arréglalo."' }, who: { en: 'Stands between red and blue: every attack becomes a lesson for the defence.', es: 'Está entre el rojo y el azul: cada ataque se vuelve una lección para la defensa.' },
    color: '#b48cff', look: { plume: true, face: 'open', braid: true, chest: 'split', shield: 'split' },
    pal: { R: '#b48cff', r: '#6e4bb5', A: '#ff2f2f', B: '#2fb6ff', b: '#6e4bb5', y: '#c9603a', Y: '#8a3a22' } },
  ghost: { id: 'ghost', she: true, name: { en: 'Ghost', es: 'Fantasma' }, team: { en: 'PRIVACY', es: 'PRIVACIDAD' },
    motto: { en: '"Leave no trace."', es: '"No dejes rastro."' }, who: { en: 'Hardened, encrypted, anonymous. Treats every connection as hostile.', es: 'Endurecida, cifrada, anónima. Trata cada conexión como hostil.' },
    color: '#3ddc84', look: { plume: true, face: 'closed', braid: true, chest: 'cloak', shield: 'mask' },
    pal: { l: '#4a5061', w: '#6d7690', m: '#2a2c35', d: '#1b1d24', R: '#3ddc84', r: '#1f8a50', B: '#14532d', b: '#0b2e1a', y: '#c9d4e2', Y: '#8f9bb3' } },
  forge: { id: 'forge', she: false, name: { en: 'Forge', es: 'Forja' }, team: { en: 'BUILD YOUR OWN', es: 'HAZLO TÚ MISMO' },
    motto: { en: '"Read the manual. Then rewrite it."', es: '"Lee el manual. Luego reescríbelo."' }, who: { en: 'A sysadmin who compiled their own armour from source and documented every rivet.', es: 'Un sysadmin que compiló su propia armadura desde el código y documentó cada remache.' },
    color: '#8fdcff', look: { goggles: true, face: 'open', beard: 'red', chest: 'apron', shield: 'prompt' },
    pal: { R: '#8fdcff', r: '#2fb6ff' } },
};

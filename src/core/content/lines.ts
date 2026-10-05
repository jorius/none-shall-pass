// core
import type { Localized } from '../types';

export type LineId = 'waveStart' | 'firstBreach' | 'fleshWound' | 'invincible' | 'haveAtYou' | 'oops' | 'angry'
  | 'noTarget' | 'emptyLane' | 'draw' | 'usersGone' | 'won';

// The Black Knight's voice: short Monty Python quotes, our own Spanish.
export const LINES: Record<LineId, { text: Localized; sub?: Localized }> = {
  waveStart: { text: { en: 'None shall pass.', es: 'Nadie pasará.' } },
  firstBreach: { text: { en: "'Tis but a scratch.", es: 'Es solo un rasguño.' } },
  fleshWound: { text: { en: "It's just a flesh wound.", es: 'Es solo una herida superficial.' } },
  invincible: { text: { en: "I'm invincible!", es: '¡Soy invencible!' }, sub: { en: 'You are not.', es: 'No lo eres.' } },
  haveAtYou: { text: { en: 'Have at you!', es: '¡En guardia!' }, sub: { en: 'Good eye: that one was hiding.', es: 'Buen ojo: ese estaba escondido.' } },
  oops: { text: { en: 'Oops.', es: 'Ups.' }, sub: { en: 'That was a customer.', es: 'Ese era un cliente.' } },
  angry: { text: { en: 'Your users are getting angry.', es: 'Tus usuarios se están enojando.' }, sub: { en: 'Three more and they leave.', es: 'Tres más y se van.' } },
  noTarget: { text: { en: 'No target.', es: 'Sin objetivo.' }, sub: { en: 'Tab picks the next packet in this lane.', es: 'Tab elige el siguiente paquete de este carril.' } },
  emptyLane: { text: { en: 'Nothing on this lane.', es: 'Nada en este carril.' }, sub: { en: '↑ ↓ to change lanes.', es: '↑ ↓ para cambiar de carril.' } },
  draw: { text: { en: "All right, we'll call it a draw.", es: 'Está bien, lo dejamos en empate.' } },
  usersGone: { text: { en: 'The server is perfectly safe, and perfectly empty.', es: 'El servidor está perfectamente seguro, y perfectamente vacío.' } },
  won: { text: { en: 'None. Shall. Pass.', es: 'Nadie. Pasará.' } },
};

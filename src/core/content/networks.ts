// core
import type { Localized, NetId } from '../types';

// Documentation ASNs (RFC 5398) with a plain-language label.
export const NETWORKS: Record<NetId, Localized> = {
  home: { en: 'AS64500 · home ISP', es: 'AS64500 · ISP residencial' },
  mobile: { en: 'AS64501 · mobile carrier', es: 'AS64501 · operador móvil' },
  ci: { en: 'AS64502 · CI provider', es: 'AS64502 · proveedor de CI' },
  mail: { en: 'AS64503 · mail provider', es: 'AS64503 · proveedor de correo' },
  cloud: { en: 'AS64510 · cloud region', es: 'AS64510 · región de nube' },
  vps: { en: 'AS64511 · VPS host', es: 'AS64511 · hosting VPS' },
  bot: { en: 'AS64500 · home ISP', es: 'AS64500 · ISP residencial' },
};

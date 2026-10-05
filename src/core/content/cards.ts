// core
import type { Localized } from '../types';

export type CardId = 'destrier' | 'squire' | 'lens' | 'obs1' | 'obs2' | 'obs3' | 'lockdown' | 'quote' | 'f2b'
  | 'tarpit' | 'cdn' | 'prepared' | 'sortlist' | 'mfa' | 'csp' | 'backup';
export type Category = 'KNIGHT' | 'FIREWALL' | 'SERVER';
export type Rarity = 'COMMON' | 'RARE' | 'LEGENDARY';
export type IconId = 'horse' | 'squire' | 'lens' | 'eye' | 'lock' | 'grate' | 'hammer' | 'tar' | 'cloud' | 'shield' | 'tape';

export interface Card {
  id: CardId;
  cat: Category;
  rarity: Rarity;
  icon: IconId;
  req?: CardId;
  name: Localized;
  does: Localized;
  irl: Localized;
  catch: Localized;
}

export const STARTING_LOADOUT: CardId[] = ['lockdown'];

export const CARDS: readonly Card[] = [
  { id: 'destrier', cat: 'KNIGHT', rarity: 'LEGENDARY', icon: 'horse',
    name: { en: 'Destrier', es: 'Destrero' },
    does: { en: 'Target a packet and the knight rides out to it. It crawls at 30% speed for 5 s while you read it.', es: 'Apunta a un paquete y el caballero cabalga hasta él. Avanza al 30% de velocidad durante 5 s mientras lo lees.' },
    irl: { en: 'Throttling and step-up checks buy analysts time on suspicious traffic.', es: 'Limitar y pedir verificaciones extra le da tiempo al equipo para analizar tráfico sospechoso.' },
    catch: { en: 'While you ride, your post is empty.', es: 'Mientras cabalgas, tu puesto queda vacío.' } },
  { id: 'obs1', cat: 'KNIGHT', rarity: 'COMMON', icon: 'eye',
    name: { en: 'Observability I · logs', es: 'Observabilidad I · logs' },
    does: { en: 'Obvious attacks crawl with bugs: spiders on SQL injections, worms on XSS, beetles on brute force, flies on scans, gnats on floods.', es: 'Los ataques obvios se llenan de bichos: arañas en inyecciones SQL, gusanos en XSS, escarabajos en fuerza bruta, moscas en escaneos, mosquitos en inundaciones.' },
    irl: { en: "You can't defend what you can't see. Logs turn noise into evidence.", es: 'No puedes defender lo que no ves. Los logs convierten el ruido en evidencia.' },
    catch: { en: 'Logs only catch what you already know to look for. Tricky and sneaky traffic stays clean.', es: 'Los logs solo atrapan lo que ya sabes buscar. El tráfico engañoso y sigiloso se ve limpio.' } },
  { id: 'obs2', cat: 'KNIGHT', rarity: 'RARE', icon: 'eye', req: 'obs1',
    name: { en: 'Observability II · metrics', es: 'Observabilidad II · métricas' },
    does: { en: 'Tricky attacks show their bugs too.', es: 'Los ataques engañosos también muestran sus bichos.' },
    irl: { en: 'Baselines and alerts flag the unusual: a spike in logins, a query that takes five seconds.', es: 'Las líneas base y las alertas señalan lo inusual: un pico de inicios de sesión, una consulta que tarda cinco segundos.' },
    catch: { en: 'Sneaky packets still look clean.', es: 'Los paquetes sigilosos todavía se ven limpios.' } },
  { id: 'obs3', cat: 'KNIGHT', rarity: 'LEGENDARY', icon: 'eye', req: 'obs2',
    name: { en: 'Observability III · tracing', es: 'Observabilidad III · trazas' },
    does: { en: 'Even sneaky attacks crawl with bugs.', es: 'Hasta los ataques sigilosos se llenan de bichos.' },
    irl: { en: 'Tracing follows one request end to end, so you see what even a well-disguised payload actually did.', es: 'Las trazas siguen una petición de punta a punta, así que ves lo que de verdad hizo hasta un payload bien disfrazado.' },
    catch: { en: 'It took three picks to get here.', es: 'Llegar aquí costó tres elecciones.' } },
  { id: 'squire', cat: 'KNIGHT', rarity: 'RARE', icon: 'squire',
    name: { en: 'Squire', es: 'Escudero' },
    does: { en: 'Throws at obvious attacks on his own, one every 3 s.', es: 'Por su cuenta, le lanza a los ataques obvios: uno cada 3 s.' },
    irl: { en: 'Signature detection: automation handles the known-bad so people can hunt the subtle stuff.', es: 'Detección por firmas: la automatización se encarga de lo conocido para que las personas cacen lo sutil.' },
    catch: { en: 'He only knows the obvious tricks. Tricky and sneaky packets walk past him.', es: 'Solo conoce los trucos obvios. Los paquetes engañosos y sigilosos le pasan por el lado.' } },
  { id: 'lens', cat: 'KNIGHT', rarity: 'COMMON', icon: 'lens',
    name: { en: 'Decoding lens', es: 'Lente decodificador' },
    does: { en: 'Packet cards and the inspector show URL-decoded payloads.', es: 'Las tarjetas de paquetes y el inspector muestran los payloads decodificados.' },
    irl: { en: 'Inspect traffic after decoding: %27 is still a quote.', es: 'Inspecciona el tráfico después de decodificarlo: %27 sigue siendo una comilla.' },
    catch: { en: 'None.', es: 'Ninguna.' } },
  { id: 'lockdown', cat: 'FIREWALL', rarity: 'COMMON', icon: 'lock',
    name: { en: 'Port lockdown', es: 'Puertos cerrados' },
    does: { en: "Every port you don't use is padlocked. Scans of :23, :445 and :3389 are denied at the door; :25 mail stays open.", es: 'Cada puerto que no usas queda con candado. Los escaneos a :23, :445 y :3389 se niegan en la puerta; el correo en :25 sigue abierto.' },
    irl: { en: 'Default-deny: expose only what must be reachable from outside.', es: 'Denegar por defecto: expón solo lo que de verdad tiene que ser accesible desde afuera.' },
    catch: { en: 'None. Cheap, boring, effective.', es: 'Ninguna. Barato, aburrido, efectivo.' } },
  { id: 'quote', cat: 'FIREWALL', rarity: 'COMMON', icon: 'grate',
    name: { en: 'Quote filter', es: 'Filtro de comillas' },
    does: { en: 'A portcullis on the firewall drops any request that contains a single quote.', es: 'Un rastrillo en el firewall bloquea cualquier petición que contenga una comilla simple.' },
    irl: { en: 'A naive WAF signature.', es: 'Una firma ingenua de WAF.' },
    catch: { en: "Drops O'Reilly fans. Misses %27 and the sort-field trick.", es: "Bloquea a los fans de O'Reilly. No ve %27 ni el truco del campo de orden." } },
  { id: 'f2b', cat: 'FIREWALL', rarity: 'COMMON', icon: 'hammer',
    name: { en: 'fail2ban', es: 'fail2ban' },
    does: { en: 'Bans an IP after two failed logins.', es: 'Bloquea una IP después de dos inicios de sesión fallidos.' },
    irl: { en: 'fail2ban watches logs and firewalls repeat offenders.', es: 'fail2ban vigila los logs y bloquea en el firewall a los reincidentes.' },
    catch: { en: 'Botnets rotate IPs, so every fresh one gets fresh tries.', es: 'Las botnets rotan IPs, así que cada IP nueva tiene intentos nuevos.' } },
  { id: 'tarpit', cat: 'FIREWALL', rarity: 'RARE', icon: 'tar',
    name: { en: 'Tarpit', es: 'Pozo de brea' },
    does: { en: 'Repeat visitors to /login wade through tar at 40% speed.', es: 'Las IPs que insisten en /login avanzan por la brea al 40% de velocidad.' },
    irl: { en: 'Tarpits slow suspected attackers without blocking anyone outright.', es: 'Los tarpits frenan a los atacantes sospechosos sin bloquear a nadie del todo.' },
    catch: { en: 'It only slows them. You still have to act.', es: 'Solo los frena. Todavía tienes que actuar.' } },
  { id: 'cdn', cat: 'FIREWALL', rarity: 'RARE', icon: 'cloud',
    name: { en: 'CDN + rate limit', es: 'CDN + límite de peticiones' },
    does: { en: 'Flood traffic is absorbed at the edge; real browsers pass.', es: 'El tráfico de inundación se absorbe en el borde; los navegadores reales pasan.' },
    irl: { en: 'A CDN spreads the load and rate limits cap how fast one client can ask.', es: 'Una CDN reparte la carga y los límites de peticiones le ponen tope a qué tan rápido puede pedir un cliente.' },
    catch: { en: 'Does nothing against a single clever request.', es: 'No hace nada contra una sola petición astuta.' } },
  { id: 'prepared', cat: 'SERVER', rarity: 'RARE', icon: 'shield',
    name: { en: 'Prepared statements', es: 'Sentencias preparadas' },
    does: { en: 'Values never become SQL. Most injections arrive and do nothing.', es: 'Los valores nunca se vuelven SQL. La mayoría de las inyecciones llegan y no hacen nada.' },
    irl: { en: 'The real fix for SQL injection.', es: 'La solución real para la inyección SQL.' },
    catch: { en: "Column names in ORDER BY can't be parameters; the sort-field trick still lands.", es: 'Los nombres de columna en ORDER BY no pueden ser parámetros; el truco del campo de orden igual entra.' } },
  { id: 'sortlist', cat: 'SERVER', rarity: 'RARE', icon: 'shield',
    name: { en: 'Sort-column allow-list', es: 'Lista de columnas permitidas' },
    does: { en: 'The sort field only accepts price, name or date.', es: 'El campo de orden solo acepta price, name o date.' },
    irl: { en: 'Allow-list anything that ends up as an SQL identifier.', es: 'Usa listas de valores permitidos para todo lo que termine siendo un identificador SQL.' },
    catch: { en: 'Covers the sort field only.', es: 'Solo cubre el campo de orden.' } },
  { id: 'mfa', cat: 'SERVER', rarity: 'RARE', icon: 'shield',
    name: { en: 'MFA + SSH keys only', es: 'MFA + solo llaves SSH' },
    does: { en: 'A guessed or stolen password is no longer enough.', es: 'Una contraseña adivinada o robada ya no basta.' },
    irl: { en: 'Second factors make most stolen-password logins useless.', es: 'Los segundos factores vuelven inútil la mayoría de inicios de sesión con contraseñas robadas.' },
    catch: { en: 'None in the game. In real life: phishing proxies and push fatigue still beat phishable factors; passkeys close that gap.', es: 'Ninguna en el juego. En la vida real: los proxies de phishing y la fatiga de notificaciones aún superan los factores que se pueden suplantar; las passkeys cierran esa brecha.' } },
  { id: 'csp', cat: 'SERVER', rarity: 'RARE', icon: 'shield',
    name: { en: 'Output encoding + CSP', es: 'Codificación de salida + CSP' },
    does: { en: 'Comments render as text and the browser refuses inline scripts.', es: 'Los comentarios se muestran como texto y el navegador rechaza scripts en línea.' },
    irl: { en: 'Encode on output; CSP is the seatbelt.', es: 'Codifica al mostrar; la CSP es el cinturón de seguridad.' },
    catch: { en: 'None in the game.', es: 'Ninguna en el juego.' } },
  { id: 'backup', cat: 'SERVER', rarity: 'COMMON', icon: 'tape',
    name: { en: 'Restore from backup', es: 'Restaurar copia de seguridad' },
    does: { en: 'Instantly restores 30% uptime and puts out part of the fire.', es: 'Restaura de inmediato 30% de disponibilidad y apaga parte del fuego.' },
    irl: { en: 'Tested backups turn a disaster into a bad afternoon.', es: 'Las copias probadas convierten un desastre en una mala tarde.' },
    catch: { en: 'Single shot: it fixes the damage, not the hole.', es: 'Un solo disparo: repara el daño, no la falla.' } },
];

export const cardById = (id: CardId): Card => {
  const c = CARDS.find((x) => x.id === id);
  if (!c) throw new Error(`unknown card ${id}`);
  return c;
};

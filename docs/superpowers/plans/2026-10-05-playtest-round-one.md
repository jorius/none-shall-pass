# None Shall Pass — Play-test Round One (v1.1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the round-one changes on top of v1: protocol-chip packet cards, frame-eating bugs, the levelled Destrier with a charge, a wave recap, the Armory, six knights and four difficulties, sound, animation polish and the locked icon set.

**Architecture:** The pure core in `src/core` grows a difficulty table, a knight table, a lane-wide slow and a charge, queueing, auto-target and per-wave mistakes; every rule change lands there first with unit tests. The Phaser views in `src/game` get a new card renderer, a bug rig, knight variants generated from one grid with palette swaps, and the polish effects. The DOM layer in `src/ui` gains three screens (setup, recap, armory) routed through the existing `App.setScreen` state machine. A new `src/audio` module synthesizes every sound in Web Audio and owns a sequenced music loop. Storage moves to a v2 bests schema with a migration.

**Tech Stack:** Phaser 4.2.1, TypeScript 6 strict, Vite 8, Vitest 5 (jsdom for UI), ESLint 10, Playwright headless smoke (`scripts/smoke.mjs`), Web Audio API.

**Spec:** `docs/superpowers/specs/2026-10-05-playtest-round-one-design.md` (amends `docs/superpowers/specs/2026-10-04-none-shall-pass-design.md`). Art source: `docs/mocks/2026-10-05-art-workbench.js`. Screen mocks: `docs/mocks/2026-10-05-round-one-mocks.html`.

## Global Constraints

- Repo: `/home/jorius/Sources/GitHub/Personal/none-shall-pass`, branch `feature/v1-game`, everything local: no remote, no push, no `gh`.
- Commit subjects start with a verb from `.husky/commit-msg`; every commit ends with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. Never rebase or amend.
- `npm run lint`, `npm test`, `npm run test:coverage` (core ≥ 80% every metric; today ~97%) and `npm run build` stay green after every task; `node scripts/smoke.mjs` (full) before each commit that touches views, UI or smoke. The Phaser ">500 kB chunk" build warning is the only tolerated noise.
- No packet, log, card or share text ever reaches `innerHTML`: `el()`/`textContent`, or `esc()` in `src/ui/inspector.ts`.
- Browsers headless only; never bind port 5190 (the owner's preview) or the brainstorm mockup port.
- EN/ES key parity: every new `t()` key exists in both `src/i18n/en.json` and `src/i18n/es.json`; the parity test in `src/i18n` must pass.
- Logical screen 1280×720, field origin `FIELD_TOP` 56, lanes `LANE_H` 90, fire at `FW_X` 906, 2× render with NEAREST pixel art; text ≥ 13 px.
- Reduced effects (`scene.reduced`, `#ui.reduced`) switch off every new motion the spec lists.
- Chip colours: GET `#2fb6ff`, POST `#d9b44a`, SSH `#5fd38d`, SMTP `#b48cff`, TCP `#a4a197`. Red stays for the target and the hints.
- Difficulties: Intern ×0.5 / 75% speed / 14 rep; Analyst ×1 / 100% / 10; Incident ×1.5 / 125% / 8; Zero-day ×2 / 150% / 5 / no hints.
- Destrier: I lane 70%, II lane 50%, III charge (C, once per wave, 1.2 s, +20 per attack).

## Review Focus

1. A keyboard player on the recap presses Space to continue: the draft must open with no card taken. Pinned in Task 12 (`overlays.test.ts`: the active element is blurred before the draft shows).
2. C pressed with the charge spent, during a charge, while unmounted, or in an empty lane: nothing happens and no line is spoken. Pinned in Task 3 (`knight.test.ts`).
3. A tarpitted packet at the head of /login with three behind it: none overlaps, none moves backwards, and when the head enters the fire the queue moves on. Pinned in Task 4 (`field.test.ts`).
4. A v1 save (`campaign.normal`, `overtime.root`, `won`) loads into the Analyst slots; a pref `difficulty: "nightmare"` falls back to Analyst. Pinned in Task 5 (`storage.test.ts`).
5. No AudioContext, a suspended one, or one whose `resume()` rejects: the game plays silently, nothing throws, and no sound starts before a user gesture. Pinned in Task 15 (`audio.test.ts`).

## File structure

| Area | Files |
|---|---|
| Core | `src/core/difficulty.ts` (new), `src/core/content/knights.ts` (new), `src/core/content/packets.ts` (card parts), `src/core/content/cards.ts` (Destrier tiers, icons), `src/core/constants.ts`, `src/core/state.ts`, `src/core/events.ts`, `src/core/rules.ts`, `src/core/knight.ts`, `src/core/field.ts`, `src/core/outcomes.ts`, `src/core/run.ts`, `src/core/keys.ts`, `src/core/score.ts`, `src/core/testkit.ts` |
| Storage | `src/storage.ts` (v2 bests, prefs) |
| Art | `src/art/pixels.ts` (palette letters, `ell`), `src/art/sprites.ts` (icons, knights, squire, worm, fly), `src/art/textures.ts` (per-sprite palettes), `src/art/dataurl.ts` |
| Game views | `src/game/cards.ts` (renderer v2), `src/game/views/packets.ts`, `src/game/views/bugs.ts` (new), `src/game/views/actors.ts`, `src/game/views/lanes.ts`, `src/game/views/rack.ts`, `src/game/views/effects.ts`, `src/game/views/fireWall.ts` |
| UI | `src/ui/recap.ts` (new), `src/ui/setup.ts` (new), `src/ui/armory.ts` (new), `src/ui/overlays.ts`, `src/ui/title.ts`, `src/ui/pausePanel.ts`, `src/ui/draftPanel.ts`, `src/ui/debrief.ts`, `src/ui/hud.ts`, `src/ui/loadout.ts`, `src/ui/uptime.ts`, `src/ui/analyticsView.ts`, `src/styles.css`, `src/i18n/{en,es}.json` |
| Audio | `src/audio/synth.ts`, `src/audio/music.ts`, `src/audio/index.ts` (new) |
| App | `src/app.ts`, `src/main.ts` |
| Checks | `scripts/smoke.mjs`, `README.md`, the spec |

---

### Task 1: Content — card parts, Destrier tiers, the knight table

**Files:**
- Modify: `src/core/types.ts`, `src/core/content/packets.ts`, `src/core/content/cards.ts`, `src/core/content/packets.test.ts`, `src/core/content/cards.test.ts`
- Create: `src/core/content/knights.ts`, `src/core/content/knights.test.ts`

**Interfaces:**
- Consumes: `PacketTemplate`, `Template`, `Card`, `CardId`, `Localized`.
- Produces: `type Chip = 'GET' | 'POST' | 'SSH' | 'SMTP' | 'TCP'`; `cardParts(card: string): { chip: Chip; path: string; payload: string }`; `Template.chip/path/payload`; `CardId` gains `'destrier2' | 'destrier3'`; `type KnightId = 'black' | 'sentinel' | 'raider' | 'warden' | 'ghost' | 'forge'`; `interface KnightLook`; `interface KnightDef`; `KNIGHTS: Record<KnightId, KnightDef>`; `KNIGHT_IDS: readonly KnightId[]`.

- [ ] **Step 1: Failing tests for card parts**

Append to `src/core/content/packets.test.ts`:
```ts
import { cardParts } from './packets';

describe('card parts', () => {
  it('splits the request line into chip, path and payload', () => {
    expect(cardParts("GET /search?q=' OR 1=1--")).toEqual({ chip: 'GET', path: '/search', payload: "q=' OR 1=1--" });
    expect(cardParts('POST /login user=admin pass=123456')).toEqual({ chip: 'POST', path: '/login', payload: 'user=admin pass=123456' });
    expect(cardParts('POST /search {"q":"socks","sort":"price; DROP TABLE orders--"}')).toEqual({ chip: 'POST', path: '/search', payload: '{"q":"socks","sort":"price; DROP TABLE orders--"}' });
    expect(cardParts('SSH-2.0-libssh_0.9.6 root:toor')).toEqual({ chip: 'SSH', path: ':22', payload: 'libssh_0.9.6 root:toor' });
    expect(cardParts('SSH-2.0-OpenSSH_9.6 publickey deploy')).toEqual({ chip: 'SSH', path: ':22', payload: 'OpenSSH_9.6 publickey deploy' });
    expect(cardParts('SYN → :23 telnet')).toEqual({ chip: 'TCP', path: 'SYN :23', payload: '→ telnet' });
    expect(cardParts('SMTP :25 EHLO mail.partner.example')).toEqual({ chip: 'SMTP', path: ':25', payload: 'EHLO mail.partner.example' });
    expect(cardParts('GET /comments?page=2')).toEqual({ chip: 'GET', path: '/comments', payload: 'page=2' });
    expect(cardParts('GET /login')).toEqual({ chip: 'GET', path: '/login', payload: '' });
  });

  it('gives every template its parts, and the payload never repeats the path', () => {
    for (const t of TEMPLATES) {
      expect(['GET', 'POST', 'SSH', 'SMTP', 'TCP']).toContain(t.chip);
      expect(t.path.length).toBeGreaterThan(0);
      expect(t.payload.startsWith(t.path)).toBe(false);
      expect(t.card).toContain(t.payload.slice(0, 8));
    }
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run src/core/content/packets.test.ts` → FAIL (`cardParts` is not exported).

- [ ] **Step 3: Implement the parts**

In `src/core/types.ts` add:
```ts
export type Chip = 'GET' | 'POST' | 'SSH' | 'SMTP' | 'TCP';
```
and extend `Template`:
```ts
export interface Template extends PacketTemplate {
  raw: string;
  decoded?: string;
  chip: Chip;
  path: string;
  payload: string;
}
```

In `src/core/content/packets.ts` add, above the `TEMPLATES` build:
```ts
// The card's request line, split for the chip layout: the method or protocol, the path or port, and only the payload.
export const cardParts = (card: string): { chip: Chip; path: string; payload: string } => {
  let m = /^(GET|POST) (\/[a-z]+)\??(.*)$/.exec(card);
  if (m) return { chip: m[1] as Chip, path: m[2], payload: m[3].trim() };
  m = /^SSH-2\.0-(.*)$/.exec(card);
  if (m) return { chip: 'SSH', path: ':22', payload: m[1] };
  m = /^SYN → (:\d+) (.*)$/.exec(card);
  if (m) return { chip: 'TCP', path: `SYN ${m[1]}`, payload: `→ ${m[2]}` };
  m = /^SMTP (:\d+) (.*)$/.exec(card);
  if (m) return { chip: 'SMTP', path: m[1], payload: m[2] };
  return { chip: 'TCP', path: '', payload: card };
};
```
Find where `TEMPLATES` maps `LIST` into `Template` objects (it adds `raw` and `decoded`) and spread the parts in: `({ ...t, raw, decoded, ...cardParts(t.card) })`. Import `Chip` from `../types`.

Run: `npx vitest run src/core/content/packets.test.ts` → PASS.

- [ ] **Step 4: Failing tests for the Destrier tiers and the knight table**

Append to `src/core/content/cards.test.ts`:
```ts
it('levels the Destrier in three cards that require each other', () => {
  const d1 = cardById('destrier'), d2 = cardById('destrier2'), d3 = cardById('destrier3');
  expect(d1.req).toBeUndefined();
  expect(d2.req).toBe('destrier');
  expect(d3.req).toBe('destrier2');
  expect([d1.rarity, d2.rarity, d3.rarity]).toEqual(['LEGENDARY', 'RARE', 'LEGENDARY']);
  expect(d1.does.en).toMatch(/70%/);
  expect(d2.does.en).toMatch(/50%/);
  expect(d3.does.en).toMatch(/\bC\b/);
  for (const c of [d1, d2, d3]) { expect(c.icon).toBe('horse'); expect(c.cat).toBe('KNIGHT'); }
});
```

Create `src/core/content/knights.test.ts`:
```ts
// packages
import { describe, expect, it } from 'vitest';

// local
import { KNIGHT_IDS, KNIGHTS } from './knights';

describe('knights', () => {
  it('has six knights, three of them women, each with a name, team, motto and description in both languages', () => {
    expect(KNIGHT_IDS).toEqual(['black', 'sentinel', 'raider', 'warden', 'ghost', 'forge']);
    expect(KNIGHT_IDS.filter((id) => KNIGHTS[id].she).length).toBe(3);
    for (const id of KNIGHT_IDS) {
      const k = KNIGHTS[id];
      expect(k.id).toBe(id);
      for (const f of [k.name, k.team, k.motto, k.who]) { expect(f.en.length).toBeGreaterThan(2); expect(f.es.length).toBeGreaterThan(2); }
      expect(k.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(['open', 'closed']).toContain(k.look.face);
    }
  });

  it('keeps the Black Knight on the stock palette so the v1 sprite does not change', () => {
    expect(KNIGHTS.black.pal).toEqual({});
    expect(KNIGHTS.black.look).toEqual({ plume: true, face: 'closed', chest: 'cross', shield: 'cross' });
  });
});
```

Run: `npx vitest run src/core/content` → FAIL.

- [ ] **Step 5: The Destrier cards**

In `src/core/content/cards.ts`: `CardId` gains `'destrier2' | 'destrier3'`. Replace the `destrier` entry's `does`/`catch` and add two cards right after it:
```ts
  { id: 'destrier', cat: 'KNIGHT', rarity: 'LEGENDARY', icon: 'horse',
    name: { en: 'Destrier I', es: 'Destrero I' },
    does: { en: "Every packet in the knight's lane slows to 70%. He gallops between lanes.", es: 'Todos los paquetes del carril del caballero bajan al 70%. Él galopa entre carriles.' },
    irl: { en: "Throttling the path you're watching buys analysts time to read.", es: 'Limitar la ruta que vigilas le da tiempo al equipo para leer.' },
    catch: { en: 'Only the lane you are in.', es: 'Solo el carril en el que estás.' } },
  { id: 'destrier2', cat: 'KNIGHT', rarity: 'RARE', icon: 'horse', req: 'destrier',
    name: { en: 'Destrier II', es: 'Destrero II' },
    does: { en: "The knight's lane slows to 50%.", es: 'El carril del caballero baja al 50%.' },
    irl: { en: 'Heavier throttling on the traffic under investigation.', es: 'Limitación más fuerte sobre el tráfico bajo investigación.' },
    catch: { en: 'Still one lane at a time.', es: 'Sigue siendo un carril a la vez.' } },
  { id: 'destrier3', cat: 'KNIGHT', rarity: 'LEGENDARY', icon: 'horse', req: 'destrier2',
    name: { en: 'Destrier III · charge', es: 'Destrero III · carga' },
    does: { en: 'Press C: the knight gallops down his lane and spears every attack in it. Real users pass untouched. Once per wave.', es: 'Pulsa C: el caballero galopa por su carril y alancea cada ataque. Los usuarios reales pasan intactos. Una vez por oleada.' },
    irl: { en: 'An incident playbook: once you know the pattern, you clear it in one sweep.', es: 'Un playbook de incidentes: cuando conoces el patrón, lo limpias de un barrido.' },
    catch: { en: 'Once per wave, and only your lane. Charge kills pay rule points, not spear points.', es: 'Una vez por oleada y solo tu carril. Las bajas de la carga pagan puntos de regla, no de lanza.' } },
```

- [ ] **Step 6: The knight table**

Create `src/core/content/knights.ts`:
```ts
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
```
(In these palettes `y` is the braid's main colour and `Y` its shade; Task 7 adds `Y` to `PAL`. The Black Knight's belt buckle also uses `y`, which is why only knights with braids override it.)

Run: `npx vitest run src/core/content` → PASS. Run `npm run lint` and `npx tsc --noEmit`: the `Template` change breaks nothing yet because every consumer reads `card`.

- [ ] **Step 7: Commit**

```bash
git add src/core/types.ts src/core/content
git commit -m "Add card parts, the Destrier tiers and the knight table" -m "Every packet now carries its chip, path and payload for the new card layout; the Destrier becomes three levelled cards; six knights with an identity each, as data the art and the setup screen read." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Difficulty in the core

**Files:**
- Create: `src/core/difficulty.ts`, `src/core/difficulty.test.ts`
- Modify: `src/core/state.ts`, `src/core/field.ts`, `src/core/testkit.ts`, `src/core/score.ts`, `src/app.ts` (the two `new Run(...)` sites and the `hints` action), `src/ui/hud.ts` (`MAX_REP` → `repCap`), `src/core/constants.ts` (keep `MAX_REP` as the Analyst value), tests that build a `RunConfig` by hand (grep `root: false, hints`).

**Interfaces:**
- Produces: `type Difficulty = 'intern' | 'analyst' | 'incident' | 'zeroday'`; `DIFFICULTY_IDS`; `DIFFICULTIES: Record<Difficulty, DifficultyDef>` with `{ id, mult, speed, rep, hints, name: Localized, desc: Localized }`; `tierWeight(d, wave, tier): number`; `repCap(cfg: RunConfig): number`; `allowsHints(d): boolean`. `RunConfig` gains `difficulty: Difficulty; knight: KnightId`. `RunResult` gains `difficulty`, `knight`.

- [ ] **Step 1: Failing tests**

Create `src/core/difficulty.test.ts`:
```ts
// packages
import { describe, expect, it } from 'vitest';

// local
import { allowsHints, DIFFICULTIES, DIFFICULTY_IDS, tierWeight } from './difficulty';
import { multiplier, packetSpeed, createState } from './state';
import { cfg } from './testkit';

describe('difficulty', () => {
  it('lists the four difficulties with the spec numbers', () => {
    expect(DIFFICULTY_IDS).toEqual(['intern', 'analyst', 'incident', 'zeroday']);
    expect(DIFFICULTIES.intern).toMatchObject({ mult: 0.5, speed: 0.75, rep: 14, hints: true });
    expect(DIFFICULTIES.analyst).toMatchObject({ mult: 1, speed: 1, rep: 10, hints: true });
    expect(DIFFICULTIES.incident).toMatchObject({ mult: 1.5, speed: 1.25, rep: 8, hints: true });
    expect(DIFFICULTIES.zeroday).toMatchObject({ mult: 2, speed: 1.5, rep: 5, hints: false });
  });

  it('gates the tiers: no tricky packets for an intern before wave 4, more of them for the harder ones', () => {
    expect(tierWeight('intern', 3, 2)).toBe(0);
    expect(tierWeight('intern', 3, 3)).toBe(0);
    expect(tierWeight('intern', 4, 2)).toBe(1);
    expect(tierWeight('analyst', 1, 3)).toBe(1);
    expect(tierWeight('incident', 1, 2)).toBe(1);
    expect(tierWeight('incident', 2, 2)).toBe(2);
    expect(tierWeight('zeroday', 1, 3)).toBe(2.5);
    expect(tierWeight('zeroday', 1, 2)).toBe(1.5);
    for (const d of DIFFICULTY_IDS) expect(tierWeight(d, 1, 1)).toBe(1);
  });

  it('feeds the score multiplier, the packet speed, the reputation and the hint lock', () => {
    const z = createState(cfg({ difficulty: 'zeroday', hints: true }));
    expect(multiplier(z)).toBe(2);
    expect(packetSpeed(z)).toBeCloseTo(72 * 1.5);
    expect(z.rep).toBe(5);
    expect(z.hints).toBe(false);
    expect(allowsHints('zeroday')).toBe(false);
    const i = createState(cfg({ difficulty: 'intern', hints: true, root: true }));
    expect(multiplier(i)).toBeCloseTo(0.5 * 0.75 * 1.5);
    expect(i.rep).toBe(14);
    expect(i.hints).toBe(true);
  });
});
```

Run: `npx vitest run src/core/difficulty.test.ts` → FAIL.

- [ ] **Step 2: The table**

Create `src/core/difficulty.ts`:
```ts
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
    desc: { en: 'Packets at 150%, 5 reputation, sneaky attacks from wave 1, no hints.', es: 'Paquetes al 150%, 5 de reputación, ataques sigilosos desde la oleada 1, sin pistas.' } },
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
```

- [ ] **Step 3: Wire the config**

`src/core/state.ts`:
- `import { allowsHints, DIFFICULTIES, type Difficulty } from './difficulty';` and `import type { KnightId } from './content/knights';`
- `export interface RunConfig { mode: Mode; seed: number; root: boolean; hints: boolean; difficulty: Difficulty; knight: KnightId }`
- `export const repCap = (cfg: RunConfig): number => DIFFICULTIES[cfg.difficulty].rep;`
- in `createState`: `rep: repCap(cfg)`, `hints: cfg.hints && allowsHints(cfg.difficulty)`.
- `multiplier`: `(s.hints ? HINT_MULT : 1) * (s.cfg.root ? ROOT_MULT : 1) * DIFFICULTIES[s.cfg.difficulty].mult`
- `packetSpeed`: multiply by `DIFFICULTIES[s.cfg.difficulty].speed`.

`src/core/testkit.ts`: `cfg()` defaults gain `difficulty: 'analyst', knight: 'black'`.

`src/core/field.ts`: `weightIn(def, t, tierMult)` multiplies by `tierMult(t.tier ?? 1)`; `pickTemplate(rng, def, tierMult: (tier: Tier) => number = () => 1)`; `spawn` passes `(tier) => tierWeight(s.cfg.difficulty, s.wave, tier)`. Add a test in `src/core/field.test.ts`: 500 spawns at `difficulty: 'intern'`, wave 3, on the `sqli` wave def never produce `tier > 1` (set `s.wave = 3` and call `spawn` with a seeded rng, clearing `s.packets` each time).

`src/core/score.ts`: `RunResult` gains `difficulty: Difficulty; knight: KnightId`; `resultOf` copies them from `s.cfg`.

`src/app.ts`: both `new Run({...})` calls add `difficulty: 'analyst', knight: 'black'` for now (Task 13 replaces them); the `hints` action also breaks when `!allowsHints(run.state.cfg.difficulty)`.

`src/ui/hud.ts`: replace `MAX_REP` with `repCap(run.state.cfg)` when drawing the pips.

Fix every test that builds a `RunConfig` literal (grep `hints: false }` / `hints: true }` in `src/**/*.test.ts`) to go through `cfg()` from `testkit` or to add the two fields.

Run: `npx vitest run` → PASS; `npx tsc --noEmit` and `npm run lint` clean.

- [ ] **Step 4: Commit**

```bash
git add -A src
git commit -m "Add the four difficulties to the core" -m "A difficulty table drives the score multiplier, packet speed, reputation cap, hint lock and the tier weights of the deal; the run config carries the difficulty and the chosen knight." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The levelled Destrier — lane slow and charge; the hold goes away

**Files:**
- Modify: `src/core/constants.ts`, `src/core/state.ts`, `src/core/events.ts`, `src/core/rules.ts`, `src/core/knight.ts`, `src/core/field.ts`, `src/core/outcomes.ts`, `src/core/run.ts`, `src/core/testkit.ts`, `src/core/knight.test.ts`, `src/core/rules.test.ts`, `src/core/outcomes.test.ts`, `src/game/cards.ts` (drop the `held` state), `src/game/views/packets.ts` (drop the hold bar and `held`), `src/ui/inspector.ts` (drop the HELD tag), `src/i18n/{en,es}.json` (`log.charge`)

**Interfaces:**
- Consumes: `destrierLevel`, `mounted`, `kill`, `untarget`, `packetSpeed`.
- Produces: `DESTRIER_SLOW: Record<1 | 2 | 3, number>`, `CHARGE_SECS = 1.2`, `CHARGE_X = LANE_X0 + 40`; `destrierLevel(owned): 0 | 1 | 2 | 3` (rules.ts); `laneSlow(s, lane): number` (state.ts); `KnightState.charge: { t: number; used: boolean }` (no `hold`); `Packet` without `held`/`heldOnce`; events `{ type: 'chargeStarted'; lane }`, `{ type: 'chargeEnded' }`, `shattered.by: Thrower | 'rule' | 'charge'`; `Outcome` gains `'charge'`; `Stats.chargeHits`; `Run.charge(): RunEvent[]`; `startCharge(s, ev)`.

- [ ] **Step 1: Failing tests**

Replace the Destrier hold tests in `src/core/knight.test.ts` (grep `held`, `hold`, `HOLD`) with:
```ts
import { CHARGE_SECS, KN_X, LANE_X0, PKT_W } from './constants';
import { startCharge, stepKnight, throwSpear, setLane } from './knight';
import { laneSlow } from './state';
import { stepPackets } from './field';

describe('destrier levels', () => {
  it('slows the whole lane the knight is in, by level, and no other lane', () => {
    const s = freshState();
    s.knight.lane = 2;
    expect(laneSlow(s, 2)).toBe(1);
    s.owned.push('destrier');
    expect(laneSlow(s, 2)).toBe(0.7);
    expect(laneSlow(s, 1)).toBe(1);
    s.owned.push('destrier2');
    expect(laneSlow(s, 2)).toBe(0.5);
    s.owned.push('destrier3');
    expect(laneSlow(s, 2)).toBe(0.5);
  });

  it('moves packets in the slowed lane at the lane factor', () => {
    const s = freshState();
    s.owned.push('destrier');
    s.knight.lane = 2;
    const slow = place(s, 'sqli-tautology', 300), fast = place(s, 'legit-login', 300);
    stepPackets(s, 1, []);
    expect(fast.x - 300).toBeCloseTo((slow.x - 300) / 0.7, 5);
  });
});

describe('charge', () => {
  const ready = () => { const s = freshState(); s.owned.push('destrier', 'destrier2', 'destrier3'); s.knight.lane = 2; return s; };

  it('needs Destrier III, a fresh wave, and no charge in flight; otherwise it is a silent no-op', () => {
    const s = freshState(); s.owned.push('destrier');
    const ev: RunEvent[] = [];
    startCharge(s, ev);
    expect(ev).toEqual([]);
    const r = ready();
    startCharge(r, ev);
    expect(ev).toContainEqual({ type: 'chargeStarted', lane: 2 });
    const again: RunEvent[] = [];
    startCharge(r, again);
    expect(again).toEqual([]);
    r.knight.charge = { t: 0, used: true };
    startCharge(r, again);
    expect(again).toEqual([]);
  });

  it('gallops to the lane head and back in CHARGE_SECS, spearing every attack it passes and no real user', () => {
    const s = ready();
    const a = place(s, 'sqli-tautology', 400), u = place(s, 'legit-socks', 600), b = place(s, 'sqli-union', 250);
    place(s, 'brute-admin', 500); // lane 1: untouched
    const ev: RunEvent[] = [];
    startCharge(s, ev);
    for (let i = 0; i < 80; i++) { stepKnight(s, 1 / 60, ev); stepPackets(s, 1 / 60, ev); }
    expect(s.knight.charge.t).toBe(0);
    expect(s.knight.x).toBe(KN_X);
    expect(ev).toContainEqual({ type: 'chargeEnded' });
    const killed = ev.filter((e): e is Extract<RunEvent, { type: 'shattered' }> => e.type === 'shattered').map((e) => [e.packet.id, e.by]);
    expect(killed).toEqual(expect.arrayContaining([[a.id, 'charge'], [b.id, 'charge']]));
    expect(killed.some(([id]) => id === u.id)).toBe(false);
    expect(s.packets.filter((p) => p.lane === 1).every((p) => !p.dead)).toBe(true);
    expect(s.stats.chargeHits).toBe(2);
    expect(s.score).toBe(40);
  });

  it('reaches at least the lane head and blocks throws and lane changes while galloping', () => {
    const s = ready();
    const ev: RunEvent[] = [];
    startCharge(s, ev);
    let minX = KN_X;
    for (let i = 0; i < Math.round((CHARGE_SECS / 2) * 60) + 1; i++) { stepKnight(s, 1 / 60, ev); minX = Math.min(minX, s.knight.x); }
    expect(minX).toBeLessThanOrEqual(LANE_X0 + 40 + 2);
    place(s, 'sqli-tautology', 700);
    s.locked = s.packets[0].id;
    const before = ev.length;
    throwSpear(s, ev);
    setLane(s, 1, ev);
    expect(ev.length).toBe(before);
    expect(s.knight.lane).toBe(2);
  });

  it('resets with the next wave', () => {
    const run = new Run(cfg());
    run.state.owned.push('destrier', 'destrier2', 'destrier3');
    run.charge();
    expect(run.state.knight.charge.used).toBe(true);
    run.state.phase = 'draft'; run.state.draft = { picks: [], free: true, taken: [] };
    run.nextWave();
    expect(run.state.knight.charge).toEqual({ t: 0, used: false });
  });
});
```
(`Run` and `cfg` are already imported in that file; add what is missing.) In `src/core/outcomes.test.ts` add a case: `kill(s, attack, 'charge', ev)` earns `POINTS.rule`, bumps `stats.chargeHits`, logs outcome `'charge'`, and a legit packet killed by a charge is impossible (the charge never calls it), so assert `kill(s, legit, 'charge', ev)` still counts a false positive (defensive, same branch as rules).

Run: `npx vitest run src/core/knight.test.ts src/core/outcomes.test.ts` → FAIL.

- [ ] **Step 2: Constants, state and rules**

`src/core/constants.ts`: delete `HOLD_SECS` and `HOLD_MULT`; add
```ts
export const DESTRIER_SLOW: Record<1 | 2 | 3, number> = { 1: 0.7, 2: 0.5, 3: 0.5 };
export const CHARGE_SECS = 1.2;
export const CHARGE_X = LANE_X0 + 40;
```
(`LANE_X0` is defined above it; keep the order.)

`src/core/rules.ts`:
```ts
export const destrierLevel = (owned: readonly CardId[]): 0 | 1 | 2 | 3 =>
  owns(owned, 'destrier3') ? 3 : owns(owned, 'destrier2') ? 2 : owns(owned, 'destrier') ? 1 : 0;
```

`src/core/state.ts`: `Packet` loses `held` and `heldOnce`; `KnightState` loses `hold` and gains `charge: { t: number; used: boolean }` (`createState`: `charge: { t: 0, used: false }`); `Stats` gains `chargeHits: number` (0 in `emptyStats`); add
```ts
import { DESTRIER_SLOW } from './constants';
import { destrierLevel } from './rules';
// The Destrier slows every packet in the knight's own lane; nothing elsewhere.
export const laneSlow = (s: RunState, lane: number): number => {
  const lvl = destrierLevel(s.owned);
  return lvl && lane === s.knight.lane ? DESTRIER_SLOW[lvl] : 1;
};
```
(`rules.ts` imports only types from `state.ts`? It imports nothing from it today; check for a cycle: `state.ts` → `rules.ts` → `constants`/`content` only. Fine.)

`src/core/testkit.ts`: drop `held: false, heldOnce: false` from `place`.

`src/core/events.ts`: `Outcome` gains `'charge'`; `shattered.by: Thrower | 'rule' | 'charge'`; add `| { type: 'chargeStarted'; lane: LaneIndex } | { type: 'chargeEnded' }`.

`src/core/outcomes.ts`: `kill(s, p, by: Thrower | 'rule' | 'charge', ev, ruleId?)`: the `by === 'charge'` branch (before the rule branch): `earn(s, POINTS.rule); s.stats.chargeHits++; floatAtPacket(ev, p, 'points', POINTS.rule); log(s, ev, { outcome: 'charge', packet: p, points: POINTS.rule });`. `untarget` no longer touches `held`/`hold`. `LogEntry.fpBy` type gains `'charge'`.

- [ ] **Step 3: The knight**

`src/core/knight.ts`:
- `target()` loses the hold line. `launch()` uses `packetSpeed(s) * laneSlow(s, p.lane) * (p.slowed ? TAR_MULT : 1)`.
- `throwSpear`: first line `if (s.knight.cooldown > 0 || s.knight.charge.t > 0) return;`.
- `setLane`: first line `if (s.knight.charge.t > 0) return;` (Task 4 adds auto-target here).
- Add:
```ts
export const startCharge = (s: RunState, ev: RunEvent[]): void => {
  const k = s.knight;
  if (destrierLevel(s.owned) < 3 || k.charge.used || k.charge.t > 0) return;
  untarget(s, ev);
  k.charge = { t: CHARGE_SECS, used: true };
  k.moving = true;
  ev.push({ type: 'chargeStarted', lane: k.lane });
};

// Out to the lane head and back; every attack the knight's x crosses on the way is speared.
const stepCharge = (s: RunState, dt: number, ev: RunEvent[]): void => {
  const k = s.knight;
  const u0 = 1 - k.charge.t / CHARGE_SECS;
  k.charge.t = Math.max(0, k.charge.t - dt);
  const u = 1 - k.charge.t / CHARGE_SECS;
  const at = (v: number): number => (v < 0.5 ? KN_X - (KN_X - CHARGE_X) * (v / 0.5) : CHARGE_X + (KN_X - CHARGE_X) * ((v - 0.5) / 0.5));
  const x0 = at(u0), x1 = at(u);
  k.x = x1; k.y = knightY(k.lane, true); k.moving = k.charge.t > 0; k.facing = u < 0.5 ? 'left' : 'right';
  const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
  for (const p of s.packets) {
    if (p.dead || p.entering || p.lane !== k.lane || p.t.kind === 'legit') continue;
    if (p.x + PKT_W >= lo && p.x <= hi) kill(s, p, 'charge', ev);
    if (s.phase !== 'playing') return;
  }
  if (k.charge.t === 0) { k.x = KN_X; k.moving = false; k.facing = 'left'; ev.push({ type: 'chargeEnded' }); }
};
```
- `stepKnight`: after the cooldown/throwT lines, `if (k.charge.t > 0) { stepCharge(s, dt, ev); return; }`; delete the `ride`/`hold` block: `const tx = KN_X, ty = knightY(k.lane, isMounted);` and keep the move-toward code.
- `stepSquire`: the filter loses `!p.held`.
- Imports: drop `HOLD_MULT`, `HOLD_SECS`; add `CHARGE_SECS`, `CHARGE_X`; import `destrierLevel` from `./rules`, `laneSlow` from `./state`, `kill` is already imported.

`src/core/field.ts` `stepPackets`: replace `if (p.held) v *= HOLD_MULT;` with `v *= laneSlow(s, p.lane);` (import from `./state`; drop `HOLD_MULT`).

`src/core/run.ts`: add `charge(): RunEvent[] { return this.act((ev) => startCharge(this.state, ev)); }`; in `nextWave()` reset `s.knight.charge = { t: 0, used: false };`; `cheat('skip')` also resets it. Import `startCharge`.

- [ ] **Step 4: Views and strings that referenced the hold**

- `src/game/cards.ts`: `CardState` loses `'held'`; drop its `BG`/`BORDER` entries.
- `src/game/views/packets.ts`: the `paint` state line becomes `s.locked === p.id ? 'locked' : p.doomed ? 'locked' : this.hovered === p.id ? 'hover' : p.slowed ? 'slowed' : 'idle'`; delete the `if (locked.held) { … hold bar … }` block and the `HOLD_SECS` import.
- `src/ui/inspector.ts`: remove the HELD tag (`t('inspector.held')`) and any `p.held` read.
- `src/i18n/en.json`: under `log` add `"charge": "CHARGE"`; `es.json`: `"charge": "CARGA"`. Keep `inspector.held` keys (harmless) or delete them in both files.
- `src/ui/eventLog.ts` and `src/ui/inspector.ts` switch on `outcome`: a `'charge'` entry renders like `'hit'` (same class `ok`), label `t('log.charge')`.

Run: `npx vitest run` → PASS; `npx tsc --noEmit`; `npm run lint`; `node scripts/smoke.mjs packets loop` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "Replace the Destrier hold with a lane-wide slow and a charge" -m "Destrier I and II slow every packet in the knight's lane; III adds a once-per-wave charge that gallops the lane and spears every attack it crosses, paid as rule points. The per-packet hold and its bar are gone." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Queueing, auto-target on lane change, per-wave mistakes

**Files:**
- Modify: `src/core/field.ts`, `src/core/knight.ts`, `src/core/outcomes.ts`, `src/core/state.ts`, `src/core/run.ts`, `src/core/constants.ts` (`MISTAKES_MAX`), `src/core/field.test.ts`, `src/core/knight.test.ts`, `src/core/run.test.ts`

**Interfaces:**
- Produces: `RunState.waveMistakes: LogEntry[]` (this wave, oldest first) and `RunState.mistakes: LogEntry[]` (whole run, newest first, capped at `MISTAKES_MAX = 200`); `setLane` auto-targets; `stepPackets` queues.

- [ ] **Step 1: Failing tests**

`src/core/field.test.ts`:
```ts
describe('queueing', () => {
  it('never lets a packet overtake or overlap the one ahead, and never moves one backwards', () => {
    const s = freshState();
    s.owned.push('tarpit');
    s.seen['198.51.100.77'] = 3; // a repeat visitor: the tar slows it on /login
    const head = place(s, 'brute-stuffing', 600, '198.51.100.77');
    const a = place(s, 'legit-login', 230), b = place(s, 'legit-login', -140), c = place(s, 'legit-login', -510);
    for (let i = 0; i < 240; i++) {
      const before = [head, a, b, c].map((p) => p.x);
      stepPackets(s, 1 / 60, []);
      [head, a, b, c].forEach((p, j) => expect(p.x).toBeGreaterThanOrEqual(before[j]));
      expect(a.x).toBeLessThanOrEqual(head.x - PKT_W - SPAWN_GAP + 1e-6);
      expect(b.x).toBeLessThanOrEqual(a.x - PKT_W - SPAWN_GAP + 1e-6);
      expect(c.x).toBeLessThanOrEqual(b.x - PKT_W - SPAWN_GAP + 1e-6);
    }
    expect(head.slowed).toBe(true);
  });

  it('releases the queue once the head enters the fire', () => {
    const s = freshState();
    const head = place(s, 'legit-login', 560), next = place(s, 'legit-login', 560 - PKT_W - SPAWN_GAP);
    for (let i = 0; i < 90 && !head.entering; i++) stepPackets(s, 1 / 60, []);
    expect(head.entering).toBe(true);
    const x = next.x;
    stepPackets(s, 1 / 60, []);
    expect(next.x - x).toBeCloseTo(72 / 60, 3);
  });
});
```

`src/core/knight.test.ts`:
```ts
describe('auto-target on lane change', () => {
  it('targets the packet nearest the fire in the new lane, and clears when the lane is empty', () => {
    const s = freshState();
    s.knight.lane = 2;
    const far = place(s, 'brute-admin', 200), near = place(s, 'legit-login', 500);
    place(s, 'brute-admin', 650).entering = true;
    const ev: RunEvent[] = [];
    setLane(s, 1, ev);
    expect(s.locked).toBe(near.id);
    expect(ev.map((e) => e.type)).toEqual(['laneChanged', 'targeted']);
    setLane(s, 0, ev);
    expect(s.locked).toBeNull();
    setLane(s, 1, ev);
    expect(s.locked).toBe(near.id);
    expect(far.dead).toBe(false);
  });
});
```

`src/core/run.test.ts`:
```ts
it('keeps this wave\'s mistakes apart from the run\'s, and clears them with the next wave', () => {
  const run = new Run(cfg());
  const s = run.state;
  const legit = place(s, 'legit-socks', 400);
  s.locked = legit.id;
  run.throwSpear();
  for (let i = 0; i < 60; i++) run.step(1 / 60);
  expect(s.waveMistakes.map((e) => e.outcome)).toEqual(['fp']);
  expect(s.mistakes.map((e) => e.outcome)).toEqual(['fp']);
  run.cheat('skip');
  run.nextWave();
  expect(s.waveMistakes).toEqual([]);
  expect(s.mistakes.length).toBe(1);
});
```

Run: `npx vitest run src/core` → FAIL.

- [ ] **Step 2: Queueing**

`src/core/field.ts` `stepPackets`: iterate lane by lane from the front so the packet ahead has already moved:
```ts
export const stepPackets = (s: RunState, dt: number, ev: RunEvent[]): void => {
  const base = packetSpeed(s);
  // Front to back within each lane: a packet can only be as far along as the one ahead allows.
  const order = s.packets.filter((p) => !p.dead).sort((a, b) => a.lane - b.lane || b.x - a.x);
  let ahead: Packet | null = null;
  for (const p of order) {
    if (s.phase !== 'playing') return;
    if (ahead && ahead.lane !== p.lane) ahead = null;
    let v = base;
    if (p.entering) v *= ENTER_MULT;
    else {
      v *= laneSlow(s, p.lane);
      p.slowed = tarpitSlows(p, s.owned, s.seen);
      if (p.slowed) v *= TAR_MULT;
    }
    const x0 = p.x;
    p.x += v * dt;
    if (ahead && !ahead.entering && !p.entering) p.x = Math.max(x0, Math.min(p.x, ahead.x - PKT_W - SPAWN_GAP));
    ahead = p;
    … (the lockdown / firewall / entering / consumed checks as today, unchanged)
  }
};
```
(A dead `ahead` from a `kill` inside the loop still bounds the next packet for that one step; acceptable, it is one frame.)

- [ ] **Step 3: Auto-target**

`src/core/knight.ts` `setLane`, after `ev.push({ type: 'laneChanged', lane: l })`:
```ts
  // The packet nearest the fire in the new lane is the one to read first: it becomes the target at once.
  const front = s.packets.filter((p) => !p.dead && !p.doomed && !p.entering && p.lane === l && p.x + PKT_W > LANE_X0 + 10).sort((a, b) => b.x - a.x)[0];
  if (front) target(s, front.id, ev);
```
(`target` is declared below `setLane` as a `const`; move `setLane` below `target`, or hoist by making both `function` declarations. Keep the order: `target`, then `setLane`.)

- [ ] **Step 4: Mistakes**

`src/core/constants.ts`: `export const MISTAKES_MAX = 200;`. `src/core/state.ts`: `waveMistakes: LogEntry[]`, `mistakes: LogEntry[]` (both `[]` in `createState`). `src/core/outcomes.ts` `log()`: after pushing the entry, `if (entry.outcome === 'breach' || entry.outcome === 'fp') { s.waveMistakes.push(full); s.mistakes.unshift(full); if (s.mistakes.length > MISTAKES_MAX) s.mistakes.pop(); }`. `src/core/run.ts` `nextWave()`: `s.waveMistakes = [];`.

Run: `npx vitest run` → PASS; lint; tsc; `node scripts/smoke.mjs loop packets overlap`.

- [ ] **Step 5: Commit**

```bash
git add -A src
git commit -m "Add lane queueing, auto-target on lane change and per-wave mistakes" -m "A packet keeps the spawn gap behind the one ahead, so a tarpitted attacker backs the lane up instead of being overtaken and hidden; moving into a lane targets its front packet at once; breaches and false positives are kept per wave for the recap." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Storage v2 — bests per difficulty, new prefs, migration

**Files:**
- Modify: `src/storage.ts`, `src/storage.test.ts`, `src/ui/title.ts` (slot lookup), `src/ui/overlays.ts` (`onEnd` slot), `src/ui/analyticsView.ts` (difficulty/knight on `game-start`)

**Interfaces:**
- Produces: `type Slot = \`${Difficulty}-${'normal' | 'root'}\``; `slotOf(r: Pick<RunResult, 'difficulty' | 'root'>): Slot`; `Bests.campaign/overtime` keyed by `Slot`; `Prefs` gains `knight?: KnightId; difficulty?: Difficulty; sound?: boolean; music?: boolean; volume?: 0 | 1 | 2 | 3`.

- [ ] **Step 1: Failing tests**

Append to `src/storage.test.ts` (the file has a `fakeStorage()` helper; reuse it):
```ts
describe('v2 bests', () => {
  it('keys the bests by difficulty and root', () => {
    const st = createStore(fakeStorage());
    st.recordResult(result({ difficulty: 'intern', score: 500, won: true }));
    st.recordResult(result({ difficulty: 'zeroday', root: true, score: 900, won: false }));
    expect(st.bests().campaign['intern-normal']).toEqual({ score: 500, grade: expect.any(String) });
    expect(st.bests().campaign['zeroday-root']).toEqual({ score: 900, grade: 'F' });
    expect(st.bests().campaign['analyst-normal']).toBeUndefined();
    expect(slotOf({ difficulty: 'incident', root: false })).toBe('incident-normal');
  });

  it('migrates a v1 save into the Analyst slots and keeps the win', () => {
    const backend = fakeStorage();
    backend.setItem('nsp.v1', JSON.stringify({ bests: { campaign: { normal: { score: 15000, grade: 'S' }, root: { score: 200, grade: 'F' } }, overtime: { root: { wave: 7, score: 9000 } }, won: true }, prefs: { lang: 'es', hints: true } }));
    const st = createStore(backend);
    expect(st.bests().campaign['analyst-normal']).toEqual({ score: 15000, grade: 'S' });
    expect(st.bests().campaign['analyst-root']).toEqual({ score: 200, grade: 'F' });
    expect(st.bests().overtime['analyst-root']).toEqual({ wave: 7, score: 9000 });
    expect(st.bests().won).toBe(true);
    expect(st.prefs()).toEqual({ lang: 'es', hints: true });
    st.setPrefs({ difficulty: 'incident' });
    expect(JSON.parse(backend.getItem('nsp.v1')!).version).toBe(2);
  });

  it('keeps only valid knight, difficulty and volume prefs', () => {
    const backend = fakeStorage();
    backend.setItem('nsp.v1', JSON.stringify({ version: 2, bests: { campaign: {}, overtime: {}, won: false }, prefs: { knight: 'ghost', difficulty: 'nightmare', volume: 7, sound: false, music: 'yes' } }));
    const st = createStore(backend);
    expect(st.prefs()).toEqual({ knight: 'ghost', sound: false });
    st.setPrefs({ volume: 2, difficulty: 'intern' });
    expect(createStore(backend).prefs()).toMatchObject({ volume: 2, difficulty: 'intern' });
  });
});
```
(`result()` is the file's `RunResult` builder; give it `difficulty: 'analyst', knight: 'black'` defaults.)

Run: `npx vitest run src/storage.test.ts` → FAIL.

- [ ] **Step 2: Implement**

`src/storage.ts`:
```ts
import { DIFFICULTY_IDS, type Difficulty } from './core/difficulty';
import { KNIGHT_IDS, type KnightId } from './core/content/knights';

export type Slot = `${Difficulty}-${'normal' | 'root'}`;
export const slotOf = (r: { difficulty: Difficulty; root: boolean }): Slot => `${r.difficulty}-${r.root ? 'root' : 'normal'}`;

export interface Bests {
  campaign: Partial<Record<Slot, { score: number; grade: Grade }>>;
  overtime: Partial<Record<Slot, { wave: number; score: number }>>;
  won: boolean;
}
export interface Prefs { lang?: Lang; hints?: boolean; reducedFx?: boolean; coached?: boolean; knight?: KnightId; difficulty?: Difficulty; sound?: boolean; music?: boolean; volume?: 0 | 1 | 2 | 3 }
interface Saved { version: 2; bests: Bests; prefs: Prefs }

const SLOTS: readonly Slot[] = DIFFICULTY_IDS.flatMap((d) => [`${d}-normal`, `${d}-root`] as Slot[]);
const empty = (): Saved => ({ version: 2, bests: { campaign: {}, overtime: {}, won: false }, prefs: {} });
```
In `parse`: read `version`; when it is not 2, treat `campaign.normal` as `analyst-normal` and `campaign.root` as `analyst-root` (same for overtime) — simplest: build `const rename = (k: string) => (v.version === 2 ? k : k === 'normal' ? 'analyst-normal' : k === 'root' ? 'analyst-root' : k);` and iterate `Object.entries(camp)` mapping keys through `rename`, keeping only those in `SLOTS` with the right shape. Prefs: keep `lang` (en/es), booleans, `knight` when `KNIGHT_IDS.includes`, `difficulty` when `DIFFICULTY_IDS.includes`, `volume` when an integer 0..3. `recordResult`: `const slot = slotOf(r);` everywhere `slot` was used. `save()` writes `data` (which carries `version: 2`).

`src/ui/title.ts`: `TitleDeps` gains `difficulty: Difficulty`; `const slot = slotOf({ difficulty: d.difficulty, root: d.root })`. `src/ui/overlays.ts` `onEnd`: `const slot = slotOf(r)`. Overlays passes `difficulty: a.store.prefs().difficulty ?? 'analyst'` to `renderTitle` (Task 13 wires the real choice). `src/ui/analyticsView.ts`: `game-start` adds `difficulty: run.state.cfg.difficulty, knight: run.state.cfg.knight` (update its test and the smoke `analytics` expectation).

Run: `npx vitest run` → PASS; lint; tsc; `node scripts/smoke.mjs title debrief analytics`.

- [ ] **Step 3: Commit**

```bash
git add -A src scripts
git commit -m "Add the v2 bests schema with difficulty slots and the new prefs" -m "Bests are kept per difficulty and root; a v1 save migrates into the Analyst slots; prefs gain the knight, the difficulty and the sound settings, validated like the rest." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Art — the locked icon set

**Files:**
- Modify: `src/art/pixels.ts` (palette letters, `ell`), `src/art/sprites.ts` (`ICONS`, `iconGrid`), `src/core/content/cards.ts` (`IconId`, each card's `icon`), `src/art/sprites.test.ts`, `src/core/content/cards.test.ts`
- Source: `docs/mocks/2026-10-05-art-workbench.js` (functions `ICON.eye`, `ICON.lens`, `ICON.ban`, `ICON.snail`, `ICON.puzzle`, `ICON.shieldTick`, `ICON.key`, `ICON.bubble`, `ICON.db`, and the `ell` helper). Copy each one verbatim; the only letter change is noted below.

**Interfaces:**
- Produces: `PAL` gains `u` `#b48cff`, `q` `#6e4bb5`, `a` `#c8a46a`, `A` `#8f6f3e`, `p` `#e2b48c`, `P` `#b9825c`, `e` `#c9d4e2`, `Y` `#b8963e`; `ell(g, cx, cy, rx, ry, c, keep?)` in `pixels.ts`; `IconId = 'horse' | 'squire' | 'eye' | 'lens' | 'ban' | 'snail' | 'puzzle' | 'shieldTick' | 'key' | 'bubble' | 'db' | 'lock' | 'grate' | 'cloud'`; `ICONS` has an entry for every non-actor `IconId` plus the field-object grids `hammer`, `lockShut`, `lockOpen`, `grate`.

- [ ] **Step 1: Failing tests**

Append to `src/art/sprites.test.ts`:
```ts
import { PAL } from './pixels';
import { CARDS } from '../core/content/cards';

describe('icon set', () => {
  it('draws every card icon with palette letters only, inside a 16×14 box', () => {
    for (const c of CARDS) {
      const g = iconGrid(c.icon);
      expect(g.length).toBeGreaterThan(0);
      for (const row of g) for (const ch of row) if (ch) expect(PAL[ch], `${c.icon} uses ${ch}`).toBeDefined();
      if (c.icon !== 'horse' && c.icon !== 'squire') { expect(g[0].length).toBe(16); expect(g.length).toBe(14); }
    }
  });

  it('maps the locked set', () => {
    const icon = (id: string) => CARDS.find((c) => c.id === id)!.icon;
    expect(icon('obs1')).toBe('eye'); expect(icon('lens')).toBe('lens'); expect(icon('f2b')).toBe('ban'); expect(icon('tarpit')).toBe('snail');
    expect(icon('prepared')).toBe('puzzle'); expect(icon('sortlist')).toBe('shieldTick'); expect(icon('mfa')).toBe('key'); expect(icon('csp')).toBe('bubble');
    expect(icon('backup')).toBe('db'); expect(icon('lockdown')).toBe('lock'); expect(icon('quote')).toBe('grate'); expect(icon('cdn')).toBe('cloud');
    expect(new Set(CARDS.map((c) => c.icon)).size).toBe(13);
  });

  it('keeps the puzzle piece violet and flat', () => {
    const cells = iconGrid('puzzle').flat().filter(Boolean);
    expect(cells.every((c) => c === 'u' || c === 'o')).toBe(true);
  });

  it('keeps every sprite def on palette letters', () => {
    for (const d of SPRITE_DEFS) for (const row of d.grid()) for (const ch of row) if (ch) expect(PAL[ch], `${d.key} uses ${ch}`).toBeDefined();
  });
});
```
(`iconGrid`, `SPRITE_DEFS` are exported from `./sprites`; import them.) Run: `npx vitest run src/art` → FAIL (`ban`, `snail`, … missing; `ell` missing).

- [ ] **Step 2: Palette and the ellipse helper**

`src/art/pixels.ts`: add the eight letters to `PAL` (`Y` is the braid shade; `y` stays the gold); add after `line`:
```ts
// Fills the cells whose centre lies inside the ellipse (rx, ry) around (cx, cy); keep(x, y, d) narrows it,
// where d is the normalised distance (1 at the edge), so a ring is `d >= 0.6`.
export const ell = (g: Grid, cx: number, cy: number, rx: number, ry: number, c: string, keep?: (x: number, y: number, d: number) => boolean): void => {
  g.forEach((row, y) => row.forEach((_, x) => {
    const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, d = u * u + v * v;
    if (d < 1 && (!keep || keep(x, y, d))) g[y][x] = c;
  }));
};
export const disc = (g: Grid, cx: number, cy: number, r0: number, r1: number, c: string, keep?: (x: number, y: number, d: number) => boolean): void => {
  g.forEach((row, y) => row.forEach((_, x) => {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d >= r0 && d < r1 && (!keep || keep(x, y, d))) g[y][x] = c;
  }));
};
```
The workbench's `set(g, x, y, c)` is `if (g[y] && x >= 0 && x < g[0].length) g[y][x] = c`; add it as `export const set`.

- [ ] **Step 3: The icons**

In `src/art/sprites.ts` `ICONS`: delete `tar`, `lens` (old), `shield`, `tape`, `eye` (old); keep `grate`, `hammer`, `lockShut`, `lockOpen`, `lock`, `cloud`. Flatten `lock` (replace its `rRRRRRRRRRRr` / `rrrrrrrrrrrr` bottom rows with `RRRRRRRRRRRR`) and `cloud` (replace the `j` row with `i`). Then add, copied from the workbench with these substitutions: in `ICON.snail` keep `a`/`A` (now in `PAL`); in `ICON.puzzle` use `u`; nothing in these nine grids uses the workbench's `E`:
`eye`, `lens`, `ban`, `snail`, `puzzle`, `shieldTick`, `key`, `bubble`, `db` — each `(): Grid`, each `outline(...)`d, each 16×14, exactly as the workbench defines them (its `grid`/`draw`/`disc`/`ell`/`set`/`outline`/`rowsToGrid` map 1:1 onto `pixels.ts`; add `rowsToGrid = (rows: string[]): Grid => rows.map((r) => [...r].map((c) => (c === '.' ? null : c)))` to `pixels.ts`).

`iconGrid`: `icon === 'horse' ? knightHorse(KNIGHTS.black.look, 0, false) : icon === 'squire' ? squire(false) : ICONS[icon]()` — until Task 7 lands keep today's `knightHorse(0, false)` / `knightFoot(false)` calls and switch in Task 7.

`src/core/content/cards.ts`: `IconId` as in Interfaces; set each card's `icon` per the mapping test.

Run: `npx vitest run src/art src/core/content` → PASS. `node scripts/smoke.mjs loadout draft objects` → PASS; look at `smoke-out/loadout.png` and `draft.png`: the new icons, crisp.

- [ ] **Step 4: Commit**

```bash
git add -A src
git commit -m "Draw the locked icon set" -m "Flat icons for every upgrade: the eye, the circular lens, the ban sign, the snail, the violet puzzle piece, the tick shield, the key, the comment bubble and the database with its restore arrow; the padlock and the cloud lose their shading." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Art — six knights, new gear, the squire, down and cheer, worm and housefly

**Files:**
- Modify: `src/art/sprites.ts`, `src/art/textures.ts`, `src/art/pixels.ts` (`paintGrid` palette parameter), `src/art/dataurl.ts`, `src/art/sprites.test.ts`
- Source: `docs/mocks/2026-10-05-art-workbench.js` (`SHIELD_NEW`, `EMBLEM`, `SPEAR_NEW`, `HELM`, `CHEST`, `knight`, `squire`).

**Interfaces:**
- Produces: `knightFoot(look: KnightLook, throwing: boolean)`, `knightHorse(look, frame, throwing)`, `knightDown(look)`, `knightCheer(look)`, `squire(throwing)`, `critter('fly' | 'gnat' | 'spider' | 'beetle', f)`, `wormPart(part: 'head' | 'body' | 'tail')`; `SPRITE_DEFS` entries carry `pal?: Record<string, string>`; texture keys `knight-${KnightId}-${'foot-idle' | 'foot-throw' | 'horse-0' | 'horse-1' | 'horse-throw' | 'down' | 'cheer'}`, `squire-idle`, `squire-throw`, `worm-head`, `worm-body`, `worm-tail`, `bug-fly-0/1` (housefly), `bug-fly-wing`; `knightKey(id: KnightId, pose: KnightPose): string`; `paintGrid(ctx, g, scale, pal = PAL)`.

- [ ] **Step 1: Failing tests**

Append to `src/art/sprites.test.ts`:
```ts
import { KNIGHT_IDS, KNIGHTS } from '../core/content/knights';
import { knightKey } from './sprites';

describe('knights and the squire', () => {
  it('registers seven textures per knight, on that knight\'s palette', () => {
    for (const id of KNIGHT_IDS) {
      for (const pose of ['foot-idle', 'foot-throw', 'horse-0', 'horse-1', 'horse-throw', 'down', 'cheer'] as const) {
        const def = SPRITE_DEFS.find((d) => d.key === knightKey(id, pose));
        expect(def, `${id} ${pose}`).toBeDefined();
        expect(def!.pal ?? {}).toEqual(KNIGHTS[id].pal);
        const g = def!.grid();
        expect(g.length).toBeGreaterThanOrEqual(30);
      }
    }
  });

  it('draws the Black Knight\'s body as before: only the shield and spear columns changed', () => {
    const now = knightFoot(KNIGHTS.black.look, false);
    // The helmet, chest and legs occupy the same cells as the v1 sprite (columns 10..12, rows 1..27).
    for (let y = 1; y <= 27; y++) for (let x = 10; x <= 12; x++) expect(now[y][x] !== null).toBe(V1_FOOT[y][x] !== null);
  });

  it('gives the squire his own body, not the knight\'s', () => {
    const sq = squire(false), kn = knightFoot(KNIGHTS.black.look, false);
    expect(sq.length).toBe(30);
    expect(sq.flat().filter((c) => c === 'a').length).toBeGreaterThan(30);
    expect(sq.flat().join('')).not.toBe(kn.flat().join(''));
  });

  it('has a segmented worm and a housefly with wings', () => {
    expect(wormPart('head')[0].length).toBeGreaterThan(wormPart('body')[0].length);
    expect(wormPart('tail')[0].length).toBeLessThan(wormPart('body')[0].length);
    expect(critter('fly', 0).flat().filter((c) => c === 'e').length).toBeGreaterThan(0);
    expect(critter('fly', 1).flat().join('')).not.toBe(critter('fly', 0).flat().join(''));
  });
});
```
`V1_FOOT` is the current `knightFoot(false)` output captured once: before changing anything, run `npx vitest run src/art --reporter=verbose` after temporarily adding `console.log(JSON.stringify(knightFoot(false)))` to a test, paste the JSON as `const V1_FOOT: Grid = …` at the top of the test file (it is 30 rows × 21 cells), then remove the log.

Run: `npx vitest run src/art` → FAIL.

- [ ] **Step 2: Palettes per sprite**

`src/art/pixels.ts`: `paintGrid(ctx, g, scale, pal: Record<string, string> = PAL)` uses `pal[c] ?? PAL[c]`. `src/art/textures.ts`: `addGrid(scene, key, g, scale, pal?)` passes it on; `registerTextures` passes `d.pal`. `SPRITE_DEFS` type: `{ key: string; grid: () => Grid; scale: number; pal?: Record<string, string> }`. `src/art/dataurl.ts` `gridUrl(g, scale, pal?)` likewise.

- [ ] **Step 3: The knight builder**

Replace `SHIELD` and `HELM` in `src/art/sprites.ts` with the workbench's `SHIELD_NEW` (renamed `SHIELD`), `EMBLEM`, `SPEAR_NEW` (renamed `SPEAR`, parametrised: `SPEAR(dx = 0, dy = 0)` adds `dx`/`dy` to every cell — write it as the workbench's rows mapped through `([y, x, s]) => [y + dy, x + dx, s]`), `HELM(x, y, look)` and `CHEST`, with these edits:
- the workbench's braid colours `Y`/`y` are `y` (main) and `Y` (shade) here, and the fringe letter `E` becomes `e`; the Ghost's hood branches (`hood`, `hood2`) are dropped (Ghost is a closed-visor knight now);
- `beard: 'red'` draws `[y + 6, x + 1, 'XXXXdd'], [y + 7, x + 2, 'xXXx']`, `'brown'` the v1 brown rows;
- `goggles` draws `[y - 2, x + 1, 'yjy.yjy'], [y - 1, x + 1, 'yjyyyjy']`.

`knightFoot(look, throwing)`: the workbench's `knight(o, 'new')` with `throwing` handled as v1 did (no spear rows and the thrown-arm rows `[13, 14, 'dm'], [12, 15, 'mm'], [11, 15, 'lm'], [10, 15, 'ml']` when throwing; the gauntlet rows `[15, 15, 'mlld'], [16, 15, 'dmmd']` when not).

`knightHorse(look, frame, throwing)`: v1's body with `draw(g, HELM(14, 4, look))`, `draw(g, CHEST[look.chest].map(([y, x, s]) => [y - 2, x + 7, s]))` in place of the three chest rows, `draw(g, SHIELD(12, 10, look.shield))`, and when not throwing `draw(g, SPEAR(7, 0))` in place of the old spear head and `line(g, 25, 6, 25, 26, 'T')`.

`knightDown(look)`: the knight on one knee, spear planted:
```ts
export const knightDown = (look: KnightLook): Grid => {
  const rows: Rows = [...SPEAR(0, 2)];
  rows.push(...HELM(5, 9, look));
  rows.push([17, 4, 'llmdmmmdmmd'], [18, 3, 'lwlmdmmmdmmmd']);
  rows.push(...CHEST[look.chest].map(([y, x, s]): Rows[number] => [y + 4, x, s]));
  rows.push([24, 7, 'ttttyttt'], [25, 5, 'mmmmmmdd'], [26, 4, 'lmmmmmmmd'], [27, 3, 'llmmd'], [27, 11, 'mmmd'], [28, 10, 'mmmd'], [28, 3, 'ldd']);
  rows.push([19, 15, 'mlld'], [20, 15, 'dmmd']);
  rows.push(...SHIELD(0, 18, look.shield));
  return outline(draw(grid(21, 30), rows));
};
```
`knightCheer(look)`: `knightFoot` with the spear lifted five rows (`SPEAR(0, -5)` instead of `SPEAR()`) and the gauntlet at rows 10–11 (`[10, 15, 'mlld'], [11, 15, 'dmmd']`).

`squire(throwing)`: the workbench's `squire` verbatim (letters `a A p P s S t T n H k l w m d y R r` all exist).

Worm and housefly:
```ts
export const wormPart = (part: 'head' | 'body' | 'tail'): Grid => {
  if (part === 'head') return outline(draw(grid(8, 7), [[1, 2, 'yyyy'], [2, 1, 'yTTTTy'], [3, 0, 'yTTkTTTy'], [4, 1, 'yTTTTy'], [5, 2, 'yyyy']]));
  if (part === 'body') return outline(draw(grid(6, 6), [[0, 2, 'yy'], [1, 1, 'yTTy'], [2, 0, 'yTTTTy'], [3, 0, 'yTTTTy'], [4, 1, 'yTTy'], [5, 2, 'yy']]));
  return outline(draw(grid(4, 4), [[0, 1, 'yy'], [1, 0, 'yTTy'], [2, 0, 'yTTy'], [3, 1, 'yy']]));
};
```
In `critter`, replace the `fly` branch with the housefly (dark body, red eyes, platinum wings; frame 1 lifts the wings):
```ts
  if (kind === 'fly') {
    const g = grid(10, 8);
    draw(g, f ? [[0, 4, 'eeee'], [1, 3, 'ee']] : [[1, 4, 'eeee'], [2, 5, 'ee']]);
    draw(g, [[2, 1, 'RR'], [3, 0, 'RRkk'], [3, 4, 'cccc'], [4, 1, 'kkkcCcCc'], [5, 2, 'kkcccc'], [6, 2, 'k.k.k']]);
    return outline(g);
  }
```
Keep `worm` in `critter` for the rack's crawling bugs (the rack still uses `bug-worm-0/1`).

`SPRITE_DEFS`: replace the five knight entries and the two squire entries with
```ts
export type KnightPose = 'foot-idle' | 'foot-throw' | 'horse-0' | 'horse-1' | 'horse-throw' | 'down' | 'cheer';
export const knightKey = (id: KnightId, pose: KnightPose): string => `knight-${id}-${pose}`;
const knightDefs = (id: KnightId) => {
  const k = KNIGHTS[id], L = k.look;
  const poses: Record<KnightPose, () => Grid> = {
    'foot-idle': () => knightFoot(L, false), 'foot-throw': () => knightFoot(L, true), 'horse-0': () => knightHorse(L, 0, false),
    'horse-1': () => knightHorse(L, 1, false), 'horse-throw': () => knightHorse(L, 0, true), down: () => knightDown(L), cheer: () => knightCheer(L),
  };
  return (Object.keys(poses) as KnightPose[]).map((pose) => ({ key: knightKey(id, pose), grid: poses[pose], scale: 3, pal: k.pal }));
};
… SPRITE_DEFS = [
  ...KNIGHT_IDS.flatMap(knightDefs),
  { key: 'squire-idle', grid: () => squire(false), scale: 2 },
  { key: 'squire-throw', grid: () => squire(true), scale: 2 },
  { key: 'worm-head', grid: () => wormPart('head'), scale: 2 }, { key: 'worm-body', grid: () => wormPart('body'), scale: 2 }, { key: 'worm-tail', grid: () => wormPart('tail'), scale: 2 },
  … (spear, spear-small, hammer, lock-shut, lock-open and the bug defs as today)
];
```
`iconGrid`: `'horse'` → `knightHorse(KNIGHTS.black.look, 0, false)`, `'squire'` → `squire(false)`.

Every v1 consumer of `knight-foot-idle` etc. breaks until Task 10 rewires `actors.ts`; for this task, `src/game/views/actors.ts` uses `knightKey('black', …)` in place of the literal keys (a four-line edit) so the game keeps running.

Run: `npx vitest run src/art` → PASS; `node scripts/smoke.mjs boot loop packets` → PASS. Write a throwaway script (in the scratchpad, not the repo) that paints every `SPRITE_DEFS` grid to one PNG sheet via `gridUrl` in a headless page, and look at it: six knights with the new shield and spear, the squire, down and cheer, worm parts, the housefly.

- [ ] **Step 4: Commit**

```bash
git add -A src
git commit -m "Draw the six knights, the new gear, the squire and the new bugs" -m "One knight builder with palette swaps and look options makes every knight's seven poses, including the kneel and the cheer; the squire is a man-at-arms in training; the worm is segmented and the fly is a housefly." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Packet cards v2 — protocol chips, payload line, free encoding highlight

**Files:**
- Modify: `src/core/constants.ts` (`PKT_W` 340, `PKT_H` 54, `PKT_Y` 18), `src/game/cards.ts`, `src/game/cards.test.ts`, `src/game/views/packets.ts`, `scripts/smoke.mjs` (`packets`, `resizeAndClick`, `overlap` offsets), `src/core/constants.test.ts` if it pins the old sizes

**Interfaces:**
- Produces: `CARD_TEX_W = 680`, `CARD_TEX_H = 108`; `CHIP_COLOR: Record<Chip, string>`; `encodedSpans(text: string): [number, number][]` (half-open index ranges of `%XX` and `+`); `drawCard(ctx, o: { chip: Chip; path: string; src: string; payload: string; hints: string[]; hintsOn: boolean; decodedTag: string | null; state: CardState; root: boolean })`.

- [ ] **Step 1: Failing tests**

Append to `src/game/cards.test.ts`:
```ts
import { CARD_TEX_H, CARD_TEX_W, CHIP_COLOR, encodedSpans } from './cards';
import { PKT_H, PKT_W, PKT_Y, LANE_H } from '../core/constants';

describe('card v2', () => {
  it('is 340×54 at 2× and still fits the lane', () => {
    expect([PKT_W, PKT_H, PKT_Y]).toEqual([340, 54, 18]);
    expect([CARD_TEX_W, CARD_TEX_H]).toEqual([680, 108]);
    expect(PKT_Y + PKT_H).toBeLessThanOrEqual(LANE_H - 10);
  });

  it('colours chips by protocol only', () => {
    expect(CHIP_COLOR).toEqual({ GET: '#2fb6ff', POST: '#d9b44a', SSH: '#5fd38d', SMTP: '#b48cff', TCP: '#a4a197' });
  });

  it('finds every percent-escape and plus, and nothing else', () => {
    expect(encodedSpans('q=%27%20OR%201%3D1--')).toEqual([[2, 5], [5, 8], [10, 13], [14, 17]]);
    expect(encodedSpans('q=blue+wool+socks')).toEqual([[6, 7], [11, 12]]);
    expect(encodedSpans("q=' OR 1=1--")).toEqual([]);
    expect(encodedSpans('100% sure, %zz')).toEqual([]);
  });

  it('draws the chip, the path, the source and the payload without touching the tells', () => {
    const calls: string[] = [];
    const ctx = fakeCtx(calls);
    drawCard(ctx, { chip: 'GET', path: '/search', src: '203.0.113.121', payload: 'q=%27%20OR%201%3D1--', hints: ["' OR 1=1--"], hintsOn: false, decodedTag: null, state: 'idle', root: false });
    expect(calls).toContain('fillText:GET');
    expect(calls).toContain('fillText:/search');
    expect(calls).toContain('fillText:203.0.113.121');
    expect(calls.some((c) => c.startsWith('fillText:q=%27'))).toBe(true);
    expect(calls.filter((c) => c.startsWith('fillText:%27')).length).toBe(1); // the cyan overdraw of one span
  });
});
```
The file already has a `fakeCtx`-style stub for the hint test from the v1 fix wave (it records `fillText` calls); extend it to record `fillText:${text}` and to make `measureText` return `{ width: text.length * 8 }`.

Run: `npx vitest run src/game/cards.test.ts` → FAIL.

- [ ] **Step 2: Constants and the renderer**

`src/core/constants.ts`: `PKT_W = 340`, `PKT_H = 54`, `PKT_Y = 18`.

`src/game/cards.ts`:
```ts
import type { Chip } from '../core/types';
export type CardState = 'idle' | 'hover' | 'locked' | 'slowed';
export const CARD_TEX_W = 680;
export const CARD_TEX_H = 108;
const S = 2;
export const CHIP_COLOR: Record<Chip, string> = { GET: '#2fb6ff', POST: '#d9b44a', SSH: '#5fd38d', SMTP: '#b48cff', TCP: '#a4a197' };
const ENCODED = '#8fdcff';

// %XX escapes and the + that stands for a space: what the decoding lens would turn back into text.
export const encodedSpans = (text: string): [number, number][] => {
  const out: [number, number][] = [];
  const re = /%[0-9A-Fa-f]{2}|\+/g;
  for (let m = re.exec(text); m; m = re.exec(text)) out.push([m.index, m.index + m[0].length]);
  return out;
};

export const drawCard = (ctx: CanvasRenderingContext2D, o: { chip: Chip; path: string; src: string; payload: string; hints: string[]; hintsOn: boolean; decodedTag: string | null; state: CardState; root: boolean }): void => {
  ctx.clearRect(0, 0, CARD_TEX_W, CARD_TEX_H);
  ctx.fillStyle = BG[o.state]; ctx.fillRect(0, 0, CARD_TEX_W, CARD_TEX_H);
  ctx.strokeStyle = o.state === 'locked' ? targetColor(o.root) : BORDER[o.state]; ctx.lineWidth = 2; ctx.strokeRect(1, 1, CARD_TEX_W - 2, CARD_TEX_H - 2);
  if (o.state === 'locked') { ctx.fillStyle = CSS.red; ctx.fillRect(0, 0, 6, CARD_TEX_H); ctx.fillStyle = CSS.blue; ctx.fillRect(CARD_TEX_W - 6, 0, 6, CARD_TEX_H); }
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  // Top row: the chip, the path, and the source on the right.
  ctx.font = `700 ${12 * S}px "Space Mono"`;
  const chipW = ctx.measureText(o.chip).width + 10 * S;
  ctx.fillStyle = CHIP_COLOR[o.chip]; ctx.fillRect(9 * S, 6 * S, chipW, 16 * S);
  ctx.fillStyle = CSS.paper; ctx.fillText(o.chip, 9 * S + 5 * S, 18 * S);
  ctx.font = `${13 * S}px "Space Mono"`;
  ctx.fillStyle = CSS.ink; ctx.fillText(o.path, 9 * S + chipW + 6 * S, 18 * S);
  ctx.textAlign = 'right'; ctx.fillStyle = CSS.dim; ctx.fillText(o.src, CARD_TEX_W - 9 * S, 18 * S);
  ctx.textAlign = 'left';
  // Bottom row: the payload only, with the decoded tag in front when the lens is on.
  let x = 9 * S;
  if (o.decodedTag) {
    ctx.font = `700 ${12 * S}px "Space Mono"`;
    const w = ctx.measureText(o.decodedTag).width + 8 * S;
    ctx.fillStyle = CSS.blue; ctx.fillRect(x, 30 * S, w, 16 * S); ctx.fillStyle = CSS.paper; ctx.fillText(o.decodedTag, x + 4 * S, 42 * S);
    x += w + 5 * S;
  }
  ctx.font = `${15 * S}px "IBM Plex Mono"`;
  const shown = fit(ctx, o.payload, CARD_TEX_W - 9 * S - x);
  ctx.fillStyle = CSS.ink; ctx.fillText(shown, x, 44 * S);
  // Encoding, always on and free: the same glyphs drawn again in cyan, with a dotted underline.
  ctx.fillStyle = ENCODED; ctx.strokeStyle = ENCODED; ctx.lineWidth = 2; ctx.setLineDash([2 * S, 2 * S]);
  for (const [a, b] of encodedSpans(shown)) {
    const x0 = x + ctx.measureText(shown.slice(0, a)).width, w = ctx.measureText(shown.slice(a, b)).width;
    ctx.fillText(shown.slice(a, b), x0, 44 * S);
    ctx.beginPath(); ctx.moveTo(x0, 48 * S); ctx.lineTo(x0 + w, 48 * S); ctx.stroke();
  }
  ctx.setLineDash([]);
  if (!o.hintsOn) return;
  … (the red wavy hint underline loop as today, with the baseline at 49 * S)
};
```
(`BG`/`BORDER` lose `held`; `fit` and `targetColor` stay.)

- [ ] **Step 3: The view and the smoke offsets**

`src/game/views/packets.ts` `paint`: pass `chip: p.t.chip, path: p.t.path, src: p.src, payload: lens ? p.t.decoded! : p.t.payload` (when the lens is on and `decoded` exists, the decoded text is the whole request line; strip the method and path with `cardParts(p.t.decoded).payload`). Drop `PORT_LABEL`. The hover/hit test already uses `PKT_W`/`PKT_H`.

`scripts/smoke.mjs`: the click offsets `p.x + 145` and `19 + 26` become `p.x + 170` and `PKT_Y + 27`; `overlap`'s expectations use `PKT_W` 340 (read the constants in-page from `window.__nsp` if the harness exposes them, otherwise update the literal 290s to 340).

Run: `npx vitest run`; `node scripts/smoke.mjs packets resizeAndClick overlap hud log` → PASS; look at `packets-target.png`: chip, path, IP, payload, dotted cyan on any `%XX`/`+`.

- [ ] **Step 4: Commit**

```bash
git add -A src scripts
git commit -m "Draw the packet cards with protocol chips and a payload line" -m "Cards widen to 340 px: a coloured chip, the path and the source on top, the payload alone below at 15 px, with every percent-escape and plus highlighted for free." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Bugs that eat the frame

**Files:**
- Create: `src/game/views/bugs.ts`, `src/game/views/bugs.test.ts`
- Modify: `src/game/views/packets.ts`, `src/game/views/effects.ts` (a `crumb` texture and emitter), `scripts/smoke.mjs` (`bugs` check)

**Interfaces:**
- Produces: `bugPath(kind: BugKind, u: number, w: number, h: number): { x: number; y: number; rot: number }` (pure, a lap of the card edge at progress `u` in [0,1)); `flyPlan(seed: number, w: number, h: number): { x: number; y: number; stay: number }[]` (five landing spots); `class BugRig { constructor(scene, box: Container, kind: BugKind, w, h, seed: number); frame(time, dt, reduced: boolean): void; bites: number; destroy(): void }`; `EffectsView.crumbs(x, y, n)`.

- [ ] **Step 1: Failing tests for the pure parts**

`src/game/views/bugs.test.ts`:
```ts
// packages
import { describe, expect, it } from 'vitest';

// local
import { bugPath, flyPlan, LAP_SECS } from './bugs';

describe('bug paths', () => {
  it('laps the edge of a 340×54 card: top edge left to right, then down the right side, back along the bottom, up the left', () => {
    expect(bugPath('spider', 0, 340, 54)).toMatchObject({ x: 0, y: 0 });
    expect(bugPath('spider', 0.4, 340, 54).x).toBeGreaterThan(300);
    expect(bugPath('spider', 0.5, 340, 54)).toMatchObject({ x: 340, y: 54 });
    const p = bugPath('spider', 0.99, 340, 54);
    expect(p.x).toBe(0); expect(p.y).toBeGreaterThan(0); expect(p.y).toBeLessThan(10);
  });

  it('turns the sprite along the edge', () => {
    expect(bugPath('beetle', 0.1, 340, 54).rot).toBe(0);
    expect(bugPath('beetle', 0.45, 340, 54).rot).toBeCloseTo(Math.PI / 2);
    expect(bugPath('beetle', 0.6, 340, 54).rot).toBeCloseTo(Math.PI);
  });

  it('gives each species its lap time', () => {
    expect(LAP_SECS).toEqual({ spider: 7, beetle: 9, worm: 16, fly: 0, gnat: 0 });
  });

  it('plans five landing spots for a fly, inside or just outside the card, deterministically', () => {
    const a = flyPlan(3, 340, 54), b = flyPlan(3, 340, 54);
    expect(a).toEqual(b);
    expect(a.length).toBe(5);
    for (const s of a) { expect(s.x).toBeGreaterThan(-20); expect(s.x).toBeLessThan(360); expect(s.stay).toBeGreaterThanOrEqual(1); expect(s.stay).toBeLessThanOrEqual(2); }
    expect(a.some((s) => s.y > 10 && s.y < 44)).toBe(true); // at least one lands across the payload
  });
});
```
Run → FAIL.

- [ ] **Step 2: The rig**

`src/game/views/bugs.ts`:
```ts
// packages
import Phaser from 'phaser';

// core
import { HEX } from '../../core/palette';
import { mulberry32 } from '../../core/rng';

// art
import type { BugKind } from '../../art/sprites';

// game
import type { FieldScene } from '../FieldScene';

export const LAP_SECS: Record<BugKind, number> = { spider: 7, beetle: 9, worm: 16, fly: 0, gnat: 0 };
const MAX_BITES = 6, SEGMENTS = 9, BITE_W = 7, BITE_H = 5;

// One lap of the card's edge, clockwise from the top-left corner.
export const bugPath = (_kind: BugKind, u: number, w: number, h: number): { x: number; y: number; rot: number } => {
  const per = 2 * (w + h), d = ((u % 1) + 1) % 1 * per;
  if (d < w) return { x: d, y: 0, rot: 0 };
  if (d < w + h) return { x: w, y: d - w, rot: Math.PI / 2 };
  if (d < 2 * w + h) return { x: w - (d - w - h), y: h, rot: Math.PI };
  return { x: 0, y: h - (d - 2 * w - h), rot: -Math.PI / 2 };
};

// Five spots a fly lands on: around the frame and across the payload, with a stay of 1–2 s each.
export const flyPlan = (seed: number, w: number, h: number): { x: number; y: number; stay: number }[] => {
  const rng = mulberry32(seed);
  const spots = [{ x: rng() * w, y: -10 }, { x: w + 8, y: rng() * h }, { x: rng() * w, y: h + 6 }, { x: -10, y: rng() * h }, { x: 40 + rng() * (w - 80), y: 14 + rng() * (h - 28) }];
  return spots.map((s) => ({ ...s, stay: 1 + rng() }));
};

export class BugRig {
  bites = 0;
  private readonly parts: Phaser.GameObjects.Image[] = [];
  private readonly marks: Phaser.GameObjects.Rectangle[] = [];
  private readonly plan: { x: number; y: number; stay: number }[];
  private readonly phase: number;
  private lastBite = 0;
  private flyAt = 0; private flyFrom = { x: 0, y: 0 }; private flyT = 0; private flyIdx = 0;

  constructor(private readonly scene: FieldScene, private readonly box: Phaser.GameObjects.Container, private readonly kind: BugKind,
    private readonly w: number, private readonly h: number, seed: number, private readonly onBite: (x: number, y: number) => void) {
    this.phase = (seed % 1000) / 1000;
    this.plan = flyPlan(seed, w, h);
    const n = kind === 'worm' ? SEGMENTS : 1;
    for (let i = 0; i < n; i++) {
      const key = kind === 'worm' ? (i === 0 ? 'worm-head' : i === n - 1 ? 'worm-tail' : 'worm-body') : `bug-${kind}-0`;
      const img = scene.add.image(0, 0, key);
      box.add(img);
      this.parts.push(img);
    }
  }

  // The bites stay on the frame: paper-coloured notches that read as missing card.
  private bite(x: number, y: number): void {
    if (this.bites >= MAX_BITES) return;
    const vertical = x <= 0 || x >= this.w;
    const m = this.scene.add.rectangle(x, y, vertical ? BITE_H : BITE_W, vertical ? BITE_W : BITE_H, HEX.paper).setOrigin(0.5, 0.5);
    this.box.addAt(m, this.box.length);
    this.marks.push(m);
    this.bites++;
    this.onBite(x, y);
  }

  frame(time: number, dt: number, reduced: boolean): void {
    if (this.kind === 'fly' || this.kind === 'gnat') { this.flyFrame(time, dt, reduced); return; }
    const lap = LAP_SECS[this.kind], u = time / lap + this.phase;
    const lead = bugPath(this.kind, u, this.w, this.h);
    this.parts.forEach((img, i) => {
      // Segments trail the head along the same path and slither sideways.
      const p = i === 0 ? lead : bugPath(this.kind, u - i * 0.012, this.w, this.h);
      const sway = this.kind === 'worm' ? Math.sin(time * 7 - i * 0.9) * 2.5 : 0;
      const nx = Math.cos(p.rot + Math.PI / 2), ny = Math.sin(p.rot + Math.PI / 2);
      img.setPosition(p.x + nx * sway, p.y + ny * sway).setRotation(p.rot);
      if (this.kind !== 'worm') img.setTexture(`bug-${this.kind}-${Math.floor(time / 0.12) % 2}`);
    });
    // A bite per lap, at the spot the head is on, after the first quarter so a fresh card is clean for a moment.
    const lapNo = Math.floor(u), limit = reduced ? 2 : MAX_BITES;
    if (lapNo > this.lastBite && u % 1 > 0.25 && this.bites < limit) { this.lastBite = lapNo; this.bite(lead.x, lead.y); }
  }

  private flyFrame(time: number, dt: number, reduced: boolean): void {
    const img = this.parts[0];
    const spot = this.plan[this.flyIdx % this.plan.length];
    if (reduced) { img.setPosition(spot.x, spot.y).setTexture(`bug-${this.kind}-0`); return; }
    this.flyT += dt;
    const dart = 0.3, total = dart + spot.stay * (this.kind === 'gnat' ? 0.4 : 1);
    if (this.flyT >= total) { this.flyT = 0; this.flyFrom = { x: spot.x, y: spot.y }; this.flyIdx++; return; }
    const k = Math.min(1, this.flyT / dart), ease = 1 - (1 - k) * (1 - k);
    const x = this.flyFrom.x + (spot.x - this.flyFrom.x) * ease, y = this.flyFrom.y + (spot.y - this.flyFrom.y) * ease;
    const twitch = k >= 1 ? Math.sin(time * 40) * 0.6 : 0;
    img.setPosition(x + twitch, y).setTexture(`bug-${this.kind}-${k < 1 || Math.floor(time / 0.08) % 2 ? 1 : 0}`);
  }

  destroy(): void { for (const o of [...this.parts, ...this.marks]) o.destroy(); }
}
```

`src/game/views/effects.ts`: build a 3×3 `crumb` texture (dim colour) next to the glyph atlas and an emitter `this.crumbs` (lifespan 300–500 ms, speed 20–60, gravityY 200, alpha 1→0); `crumbs(x, y, n)` → `emitParticleAt(x, y, n)`; paused with the others.

`src/game/views/packets.ts`: `Visual.bugs` becomes `rig: BugRig | null`; in `create`, when `isBugged`, `rig = new BugRig(scene, box, kind, PKT_W, PKT_H, p.id * 7919, (x, y) => this.effects?.crumbs(snap(p.x) + x, packetY(p) + y, reduced ? 0 : 2))`; the view gets `effects: EffectsView | null` through a setter `PacketsView.effects = effects` set in `main.ts`; in `frame`, `v.rig?.frame(time, dt, this.scene.reduced)` and hide the rig's parts past the fire (`box.each` or compare `snap(p.x) + PKT_W` with `FW_X` as today); `drop` calls `rig?.destroy()` before `box.destroy()`. Delete `bugPose`.

Smoke: add `async bugs(page)`: `play`, give the run `obs3` (`state.owned.push('obs3')` + `dispatch owned`), `stepUntil` a bugged packet exists with `x > 200` (`isBugged` is not in the page; check `p.t.kind !== 'legit'`), freeze, screenshot `bugs.png`, assert `document.querySelector` is not usable for Phaser: instead read `window.__nsp.app` → expose the rig count through `window.__nsp.packets.rigs()` (a debug getter on PacketsView returning `{ id, kind, bites }[]`), and assert at least one rig exists; then unfreeze, advance the view clock by stepping real time (`waitForTimeout(8000)` is too slow; instead call `window.__nsp.packets.debugTick(9)` which advances the rig frames by 9 s in 60 Hz steps) and assert `bites >= 1`.

Run: `npx vitest run`; `node scripts/smoke.mjs bugs packets overlap reduced` → PASS; look at `bugs.png`: a bug on the edge, a notch or two.

- [ ] **Step 3: Commit**

```bash
git add -A src scripts
git commit -m "Add bugs that crawl the card edge and bite the frame" -m "Spiders and beetles lap the frame, the worm's segments follow its head and slither, the housefly darts, lands and twitches; each lap leaves a bite that stays, with crumbs, until the packet dies." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: Field views — knight variants, lane tint, charge, down and cheer, burnt rack, flatline

**Files:**
- Modify: `src/game/views/actors.ts`, `src/game/views/lanes.ts`, `src/game/views/rack.ts`, `src/game/views/effects.ts`, `src/ui/uptime.ts`, `src/styles.css`, `scripts/smoke.mjs` (`charge` check)

**Interfaces:**
- Consumes: `knightKey`, `KnightPose`, `destrierLevel`, `laneSlow`, events `chargeStarted`/`chargeEnded`/`runEnded`.
- Produces: `EffectsView.rain()`; `PALETTES.charge`.

- [ ] **Step 1: Actors**

`src/game/views/actors.ts`:
- Keep `id: KnightId = 'black'`; `start(run)` sets `this.id = run.state.cfg.knight`.
- Pose selection in `frame`:
```ts
const s = run?.state;
const k = s?.knight ?? { x: KN_X, y: knightY(2, false), moving: false, throwT: 0, facing: 'left' as const, charge: { t: 0, used: false } };
const ended = s?.phase === 'ended';
const pose: KnightPose = ended ? (s!.endReason === 'won' ? 'cheer' : 'down')
  : horse ? (k.throwT > 0 ? 'horse-throw' : k.moving ? (Math.floor(time / (k.charge.t > 0 ? 0.07 : 0.11)) % 2 ? 'horse-1' : 'horse-0') : 'horse-0')
  : k.throwT > 0 ? 'foot-throw' : 'foot-idle';
const bob = ended && s!.endReason === 'won' ? -Math.abs(Math.sin(time * 6)) * 10 : !k.moving && k.throwT === 0 ? (Math.floor(time / 0.5) % 2 ? -3 : 0) : 0;
this.knight.setTexture(knightKey(this.id, pose)).setPosition(k.x, k.y + bob).setFlipX(k.moving && k.facing === 'right');
```
- Charge dust: on `chargeStarted` start a small particle burst behind the horse every 80 ms until `chargeEnded` (reuse the crumbs emitter through `scene.events` or hold a reference to `EffectsView` passed in the constructor; prefer the constructor).

- [ ] **Step 2: Lane tint**

`src/game/views/lanes.ts`: add `this.slow = scene.add.rectangle(LANE_X0, 0, FW_X - LANE_X0, LANE_H, HEX.gold, 0.06).setOrigin(0, 0).setVisible(false)` in `back`; in `frame`: `const lvl = run ? destrierLevel(run.state.owned) : 0; this.slow.setVisible(lvl > 0).setY((run?.state.knight.lane ?? 2) * LANE_H).setAlpha(lvl >= 2 ? 0.1 : 0.06)`.

- [ ] **Step 3: Rack, uptime strip, effects**

`src/game/views/rack.ts`: on `runEnded` with `reason !== 'won'` set `this.burnt = true` (tint `0x2a2a2a`, LEDs off, the fire keeps burning at `uptime` 0 on its own); on `runEnded` won, set LEDs to steady green; `start()` resets both.

`src/ui/uptime.ts`: on `runEnded` with `reason === 'serverDown'` add class `flat` to the strip: CSS `.hpstrip.flat .segs i { background: var(--mute) }` and `.hpstrip.flat b::after { content: ' ▁▁▁▁' ; color: var(--r); animation: blink 1s steps(1) infinite }`; `start()` removes it.

`src/game/views/effects.ts`: `PALETTES.charge = ['gold', 'ink', 'red']`; `shattered` picks `'charge'` when `ev.by === 'charge'`; `rain()`: an emitter of ink `0`/`1` glyph frames from `y = -20` across `x ∈ [LANE_X0, FW_X]`, `gravityY 180`, lifespan 2000, `explode(reduced ? 0 : 160)`; called on `runEnded` won.

Smoke `charge`: `play`, give `destrier, destrier2, destrier3`, `stepUntil` an attack sits in the knight's lane between x 300 and 600, press `c`, assert `state.knight.charge.t > 0`, `freeze`, screenshot `charge.png` (the horse mid-gallop with the lane tint), unfreeze, `stepUntil (s) => s.knight.charge.t === 0`, assert `stats.chargeHits >= 1` and the HUD float appeared (`#ui .float` count grew).

Run: `npx vitest run`; `node scripts/smoke.mjs charge debrief loop reduced` → PASS; look at `charge.png` and `debrief.png` (the knight kneeling behind a lost debrief; run the `debrief` check twice if it only produces one outcome, or add a `won` variant through the console's cheats).

- [ ] **Step 4: Commit**

```bash
git add -A src scripts
git commit -m "Show the chosen knight, the lane slow, the charge and the run's end on the field" -m "The field draws whichever knight was picked, tints the Destrier's lane, gallops the charge with dust, kneels the knight on a loss and raises his spear on a win while the rack goes dark or stays green." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: HUD colour, level pips and the level-up flash

**Files:**
- Modify: `src/ui/hud.ts`, `src/ui/loadout.ts`, `src/ui/loadout.test.ts`, `src/ui/hud.test.ts`, `src/styles.css`, `src/i18n/{en,es}.json`

**Interfaces:**
- Produces: `levelOf(owned: CardId[], family: 'destrier' | 'obs'): 0 | 1 | 2 | 3`; `familyOf(id: CardId): 'destrier' | 'obs' | null`; CSS `--green: #5fd38d`; `.pips.good/.mid/.low`; `.ltile .lvl i.on`; `.ltile.flash`; `.float.gold` reused for the level-up.

- [ ] **Step 1: Failing tests**

`src/ui/loadout.test.ts`:
```ts
it('shows level pips on the Destrier and Observability tiles and flashes a level-up with a float', () => {
  const ui = document.createElement('div'); document.body.append(ui);
  const tiles = new LoadoutTiles(ui, fakeInspector());
  const run = new Run(cfg());
  run.state.owned.push('destrier', 'obs1');
  tiles.start(run);
  const pips = [...ui.querySelectorAll('.ltile .lvl')].map((l) => l.querySelectorAll('i.on').length);
  expect(pips).toEqual([1, 1]); // lockdown has no pips; destrier I and obs I show 1 of 3
  run.state.owned.push('obs2');
  tiles.event({ type: 'owned', owned: [...run.state.owned] }, run);
  const obs = [...ui.querySelectorAll('.ltile')].find((t) => t.classList.contains('flash'))!;
  expect(obs.querySelectorAll('.lvl i.on').length).toBe(2);
  expect(ui.querySelector('.float.gold')?.textContent).toBe('Observability II');
});
```
`src/ui/hud.test.ts`:
```ts
it('colours the reputation pips by how many are left', () => {
  const { hud, ui, run } = mountHud();
  run.state.rep = 8; hud.event({ type: 'reputation', value: 8 }, run);
  expect(ui.querySelector('.pips')!.className).toBe('pips good');
  run.state.rep = 5; hud.event({ type: 'reputation', value: 5 }, run);
  expect(ui.querySelector('.pips')!.className).toBe('pips mid');
  run.state.rep = 2; hud.event({ type: 'reputation', value: 2 }, run);
  expect(ui.querySelector('.pips')!.className).toBe('pips low');
});
```
(`mountHud` is the existing helper in that file, or add one.) Run → FAIL.

- [ ] **Step 2: Implement**

`src/ui/loadout.ts`:
```ts
export const familyOf = (id: CardId): 'destrier' | 'obs' | null => (id.startsWith('destrier') ? 'destrier' : id.startsWith('obs') ? 'obs' : null);
export const levelOf = (owned: readonly CardId[], family: 'destrier' | 'obs'): 0 | 1 | 2 | 3 => (family === 'destrier' ? destrierLevel(owned) : obsLevel(owned));
```
`shown()` collapses `destrier2/3` into `destrier` as it does for `obs`. `render(owned, flash?: 'destrier' | 'obs')`: for a tile whose family is not null, add `<div class="lvl"><i class="on"/><i/><i/></div>` with `levelOf` pips `on`; if `flash === family`, add class `flash` (CSS: `@keyframes tileflash { 0% { background: var(--ink) } 100% { background: var(--soft) } }`, `.ltile.flash { animation: tileflash .6s steps(4) }`) and append a float to `ui`: `el('div', 'float gold', ui, loc(cardById(topId).name).split(' ·')[0])` positioned at the tile (`left: 1076 - 80px`, `top` from the tile's offset), removed on `animationend`. `event('owned')`: compute each family's level before and after; flash the one that rose.

`src/ui/hud.ts`: `this.pips.className = \`pips ${s.rep >= 7 ? 'good' : s.rep >= 4 ? 'mid' : 'low'}\`` before filling; the thresholds scale with `repCap`: `good` ≥ 70%, `mid` ≥ 40%.

`src/styles.css`: `:root` gains `--green: #5fd38d`; root mode overrides it to `#ffd27a`; `.hud .stat[data-key="hud.score"] b { color: var(--gold) }`, `.hud .stat[data-key="hud.credits"] b { color: var(--green) }`, `.pips.good i { background: var(--green) } .pips.mid i { background: var(--gold) } .pips.low i { background: var(--r) }` (the `.off` rule stays after them), `.ltile .lvl { position: absolute; bottom: 4px; display: flex; gap: 2px } .ltile .lvl i { width: 6px; height: 3px; background: var(--mute) } .ltile .lvl i.on { background: var(--gold) }` (`.ltile` gets `position: relative`).

Run: `npx vitest run src/ui`; `node scripts/smoke.mjs hud loadout` → PASS.

- [ ] **Step 3: Commit**

```bash
git add -A src
git commit -m "Colour the HUD and show upgrade levels on the loadout" -m "Score in gold, credits in green, reputation pips that turn gold then red; levelled tiles carry pips, flash when a level is bought and float its name." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: The wave recap

**Files:**
- Create: `src/ui/recap.ts`
- Modify: `src/core/keys.ts` (`Screen` + 'recap', action `continue`), `src/app.ts`, `src/ui/overlays.ts`, `src/ui/draftPanel.ts` (clean-wave note), `src/ui/debrief.ts` (reuse the mistake list, "+N more"), `src/styles.css`, `src/i18n/{en,es}.json`, `src/ui/overlays.test.ts`, `src/app.test.ts`, `scripts/smoke.mjs` (`recap` check; the `draft` check now passes through the recap)

**Interfaces:**
- Produces: `renderRecap(box, run: Run, cont: () => void)`; `renderMistakes(parent: HTMLElement, entries: LogEntry[], max: number)` shared with the debrief; `Screen` gains `'recap'`; `Action` gains `'continue'`; `App.act('continue')`.

- [ ] **Step 1: Failing tests**

`src/app.test.ts`:
```ts
it('opens the recap before the draft when the wave had mistakes, and the draft straight away when it was clean', () => {
  const { app, run } = mountApp();           // the file's helper that builds an App with a fake scene and a started run
  run.state.waveMistakes = [fakeEntry('fp')];
  app.dispatch([{ type: 'draftOpened', draft: { picks: [], free: true, taken: [] } }]);
  expect(app.screen).toBe('recap');
  app.act('continue');
  expect(app.screen).toBe('draft');
  run.state.waveMistakes = [];
  app.dispatch([{ type: 'draftOpened', draft: { picks: [], free: true, taken: [] } }]);
  expect(app.screen).toBe('draft');
});
```
`src/ui/overlays.test.ts`:
```ts
it('continues from the recap with Space without taking a card', () => {
  const { app, ui, run } = mountOverlays();   // existing helper
  run.state.owned = ['lockdown'];
  run.state.waveMistakes = [fakeEntry('breach')];
  run.state.phase = 'draft';
  run.state.draft = { picks: [cardById('squire'), cardById('lens'), cardById('quote')], free: true, taken: [] };
  app.dispatch([{ type: 'draftOpened', draft: run.state.draft }]);
  expect(ui.querySelector('.ov-recap')).not.toBeNull();
  expect(document.activeElement).toBe(ui.querySelector('.ov-recap .btn'));
  window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
  expect(app.screen).toBe('draft');
  expect(document.activeElement).toBe(document.body);
  expect(run.state.draft.taken).toEqual([]);
});
```
Run → FAIL.

- [ ] **Step 2: Keys and the App**

`src/core/keys.ts`: `Screen` adds `'recap'`; `Action` adds `'continue'`; in `route`, before the `paused` branch: `if (screen === 'recap') return k.key === ' ' || k.key === 'Enter' ? 'continue' : null;`; `NO_REPEAT` adds `'continue'`.

`src/app.ts`: in `dispatch`, `if (ev.type === 'draftOpened') this.setScreen(run.state.waveMistakes.length ? 'recap' : 'draft');`; in `act`, before the `if (!run || !a) return;` guard handle the run-less actions (none yet) and inside the switch: `case 'continue': if (this.screen === 'recap') { (document.activeElement as HTMLElement | null)?.blur?.(); this.setScreen('draft'); } break;`.

- [ ] **Step 3: The screen**

`src/ui/recap.ts`:
```ts
// core
import type { LogEntry } from '../core/events';
import type { Run } from '../core/run';

// i18n
import { loc, t } from '../i18n';

// local
import { button, el } from './dom';

// Breaches and false positives as a list: family, the payload with its tells underlined, and why.
export const renderMistakes = (parent: HTMLElement, entries: LogEntry[], max: number): void => {
  const list = el('div', 'mistakes', parent);
  if (!entries.length) { el('p', '', list, t('recap.clean')); return; }
  for (const e of entries.slice(0, max)) {
    const m = el('div', `mistake ${e.outcome}`, list);
    const head = el('div', 'mhead', m);
    el('span', 'tag', head, t(`log.${e.outcome}`));
    el('span', 'fam', head, t(`family.${e.packet.t.kind}`));
    el('span', 'wv', head, `W${e.wave}`);
    const pre = el('pre', 'req', m);
    // The tells are underlined here for free: this is the lesson, not the test.
    const text = e.packet.t.card, tells = (e.packet.t.hints ?? []).filter((h) => h.length);
    let i = 0;
    while (i < text.length) {
      let best: string | null = null, at = Infinity;
      for (const h of tells) { const j = text.indexOf(h, i); if (j >= 0 && j < at) { at = j; best = h; } }
      if (!best) { pre.append(text.slice(i)); break; }
      pre.append(text.slice(i, at), el('mark', '', undefined, best));
      i = at + best.length;
    }
    el('p', 'why', m, loc(e.packet.t.why));
  }
  if (entries.length > max) el('p', 'more', list, t('recap.more', { n: entries.length - max }));
};

export const renderRecap = (box: HTMLElement, run: Run, cont: () => void): void => {
  box.innerHTML = '';
  const s = run.state, m = s.waveMistakes;
  el('h2', '', box, t('recap.title', { n: s.wave }));
  const br = m.filter((e) => e.outcome === 'breach').length, fp = m.length - br;
  el('p', 'note', box, `${t('recap.breaches', { n: br })} · ${t('recap.fps', { n: fp })}`);
  el('div', 'draft-h', box, t('recap.what'));
  renderMistakes(box, m, 8);
  const b = button(el('div', 'row-btns', box), 'btn', t('recap.continue'), cont);
  b.focus();
};
```
(Text nodes only: `pre.append(string)` and `el(..., text)` never touch `innerHTML`.)

`src/ui/overlays.ts`: `Kind` adds `'recap'`; `onScreen('recap')` → `show('recap')`; `render` case `'recap'`: `if (a.run) renderRecap(this.box, a.run, () => a.act('continue'));`. `show()` must not override the recap's own focus: skip `focusFrom(0)` when `kind === 'recap'`.

`src/ui/draftPanel.ts`: when `s.waveMistakes.length === 0` add `el('p', 'note', box, t('draft.clean'))` under the stats line.

`src/ui/debrief.ts`: replace its mistake loop with `renderMistakes(right, s.mistakes, 30)`.

Strings (`en.json` / `es.json`):
```json
"recap": { "title": "WAVE {n} CLEARED", "breaches": "{n} breaches", "fps": "{n} false alarms", "what": "WHAT GOT THROUGH", "clean": "Clean wave. Nothing got past you.", "more": "+{n} more", "continue": "CONTINUE ▸" }
"recap": { "title": "OLEADA {n} SUPERADA", "breaches": "{n} brechas", "fps": "{n} falsas alarmas", "what": "LO QUE PASÓ", "clean": "Oleada limpia. No se te escapó nada.", "more": "+{n} más", "continue": "CONTINUAR ▸" }
```
plus `draft.clean`: "Clean wave" / "Oleada limpia".

`src/styles.css`: `.ov.ov-recap { top: 0; height: 720px; background: rgba(22,22,22,.97) }`, `.mistakes { width: 760px; max-height: 420px; overflow-y: auto; text-align: left }`, `.mistake { border-left: 3px solid var(--r); padding: 6px 10px; margin-bottom: 8px }`, `.mistake.fp { border-left-color: var(--ink) }`, `.mhead { font-size: 13px; color: var(--dim); display: flex; gap: 10px }`, `.mhead .tag { color: var(--paper); background: var(--r); padding: 0 6px }`, `.mistake.fp .tag { background: var(--ink) }`, `.mistake pre { font-family: var(--code); font-size: 14px; margin: 4px 0; white-space: pre-wrap; word-break: break-all }`, `.mistake mark { background: none; color: inherit; text-decoration: underline wavy var(--r) }`, `.mistake .why { font-family: var(--body); font-size: 15px; color: var(--ink) }`.

Smoke: `recap` check: `play`, `stepUntil` a false positive exists (target a legit packet via `app.run.target(id)` then `throwSpear` and step), `cheat('skip')` through the console or `app.run.cheat('skip')` from the page, assert `app.screen === 'recap'`, `fits(page, 'recap')`, screenshot `recap.png`, press Space, assert `'draft'` and `taken` empty. The `draft` check: after `skip` assert `screen === 'draft'` only when `waveMistakes` is empty; otherwise continue through the recap first.

Run: `npx vitest run`; `node scripts/smoke.mjs recap draft debrief` → PASS; look at `recap.png` in both languages (`spanish(page)` variant).

- [ ] **Step 4: Commit**

```bash
git add -A src scripts
git commit -m "Add the wave recap between a wave and its draft" -m "Every breach and false alarm of the wave, with the payload's tells underlined and the reason, before the draft; a clean wave skips it. The debrief reuses the same list." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: The setup screen — knight and difficulty

**Files:**
- Create: `src/ui/setup.ts`, `src/ui/setup.test.ts`
- Modify: `src/core/keys.ts` (`Screen` + 'setup', action `back`), `src/app.ts` (`openSetup`, `startRun(mode, choice)`), `src/ui/overlays.ts`, `src/ui/title.ts` (ARMORY button placeholder from Task 14 not yet; bests per difficulty), `src/ui/debrief.ts` (knight · difficulty line), `src/core/score.ts` (`shareText` names them), `src/ui/analyticsView.ts`, `src/styles.css`, `src/i18n/{en,es}.json`, `scripts/smoke.mjs` (`play()` goes through the setup; `setup` check)

**Interfaces:**
- Produces: `renderSetup(box, d: { knight: KnightId; difficulty: Difficulty; root: boolean; pick(k: KnightId): void; level(d: Difficulty): void; start(): void; back(): void })`; `App.openSetup(mode)`; `App.startRun(mode, choice: { knight: KnightId; difficulty: Difficulty })`; `App.pendingMode`.

- [ ] **Step 1: Failing tests**

`src/ui/setup.test.ts`:
```ts
it('shows six knights and four difficulties, marks the current pair, and starts with the focused START', () => {
  const box = document.createElement('div'); document.body.append(box);
  const picked: string[] = [];
  renderSetup(box, { knight: 'ghost', difficulty: 'incident', root: false, pick: (k) => picked.push(k), level: (d) => picked.push(d), start: () => picked.push('start'), back: () => picked.push('back') });
  expect(box.querySelectorAll('.kn').length).toBe(6);
  expect(box.querySelectorAll('.dl').length).toBe(4);
  expect(box.querySelector('.kn.sel .nm')?.textContent).toBe('Ghost');
  expect(box.querySelector('.dl.sel .nm')?.textContent).toBe('Incident');
  expect(document.activeElement?.textContent).toContain('START');
  (box.querySelector('.kn[data-id="forge"]') as HTMLButtonElement).click();
  (box.querySelector('.dl[data-id="zeroday"]') as HTMLButtonElement).click();
  (document.activeElement as HTMLButtonElement).click();
  expect(picked).toEqual(['forge', 'zeroday', 'start']);
});
```
`src/app.test.ts`:
```ts
it('goes title → setup → run with the chosen knight and difficulty, and remembers them', () => {
  const { app, store } = mountApp({ noRun: true });
  app.openSetup('campaign');
  expect(app.screen).toBe('setup');
  app.startRun('campaign', { knight: 'raider', difficulty: 'intern' });
  expect(app.run!.state.cfg).toMatchObject({ knight: 'raider', difficulty: 'intern', mode: 'campaign' });
  expect(store.prefs()).toMatchObject({ knight: 'raider', difficulty: 'intern' });
  app.act('back');
  expect(app.screen).toBe('playing'); // back only works on the setup screen
});
```
Run → FAIL.

- [ ] **Step 2: Implement**

`src/core/keys.ts`: `Screen` adds `'setup'`; `Action` adds `'back'`; `route`: `if (screen === 'setup') return k.key === 'Escape' ? 'back' : null;`.

`src/app.ts`:
```ts
pendingMode: Mode = 'campaign';
openSetup(mode: Mode): void { this.pendingMode = mode; this.setScreen('setup'); }
startRun(mode: Mode, choice?: { knight: KnightId; difficulty: Difficulty }): void {
  this.cancelEnd();
  const prefs = this.store.prefs();
  const knight = choice?.knight ?? prefs.knight ?? 'black', difficulty = choice?.difficulty ?? prefs.difficulty ?? 'analyst';
  this.store.setPrefs({ knight, difficulty });
  const hints = !this.root && !!prefs.hints;
  this.run = new Run({ mode, seed: …, root: this.root, hints, difficulty, knight });
  … (as today)
}
```
The idle run in `quit()` uses `prefs.knight ?? 'black'` so the title's backdrop shows the chosen knight, and `difficulty: 'analyst'`. `act`: run-less branch before the guard: `if (a === 'back') { if (this.screen === 'setup') this.quit(); return; }`.

`src/ui/setup.ts`: the mock's screen (`docs/mocks/2026-10-05-round-one-mocks.html`, section 4) as DOM: `h2` `t('setup.title')`, a `p` `t('setup.sub')`, a `.wrap` with a `.knights` grid of six `button.kn` (`data-id`, class `sel` on the current: a portrait `img.px` from `gridUrl(knightFoot(KNIGHTS[id].look, false), 3, KNIGHTS[id].pal)` cached per id, `.nm` `loc(name)`, `.team` chip with `style.background = color`, `.motto` `loc(motto)`, `.who` `loc(who)`) and a `.diff` column of four `button.dl` (`data-id`, `.rad`, `.nm` `loc(name)`, `.x` `×${mult}`, `.ds` `loc(desc)`, a `.bar` of four `i` with the first `n` coloured green/gold/orange/red by index); a `.foot` with START (`t('setup.start')`, focused) and BACK (`t('setup.back')`), and a note `${knight name} · ${difficulty name} · ×mult`. Every button through `button()` from `dom.ts`; clicks call `pick`/`level` and the caller re-renders.

`src/ui/overlays.ts`: `Kind` + `'setup'`; `onScreen('setup')` → `show('setup')`; render: `renderSetup(this.box, { knight: a.store.prefs().knight ?? 'black', difficulty: a.store.prefs().difficulty ?? 'analyst', root: a.root, pick: (k) => { a.store.setPrefs({ knight: k }); this.redraw(); }, level: (d) => { a.store.setPrefs({ difficulty: d }); this.redraw(); }, start: () => a.startRun(a.pendingMode, { knight: a.store.prefs().knight ?? 'black', difficulty: a.store.prefs().difficulty ?? 'analyst' }), back: () => a.quit() })`; the title's `play`/`overtime` call `a.openSetup(mode)`; the debrief's `again` calls `a.startRun(s.cfg.mode, { knight: s.cfg.knight, difficulty: s.cfg.difficulty })`. `show('setup')` keeps the screen's own focus (START), like the recap.

`src/ui/title.ts`: bests for `slotOf({ difficulty: d.difficulty, root: d.root })` plus a line `t('title.asKnight', { k: loc(KNIGHTS[prefs.knight].name), d: loc(DIFFICULTIES[prefs.difficulty].name) })`.

`src/ui/debrief.ts`: under the head, `el('p', 'note', box, \`${loc(KNIGHTS[r.knight].name)} · ${loc(KNIGHTS[r.knight].motto)} · ${loc(DIFFICULTIES[r.difficulty].name)}\`)`. `src/core/score.ts` `shareText`: append ` · ${KNIGHTS[r.knight].name[lang]} · ${DIFFICULTIES[r.difficulty].name[lang]}` before the tags; update `score.test.ts`.

`src/ui/analyticsView.ts`: already sends difficulty/knight (Task 5).

Strings: `setup`: title "CHOOSE YOUR KNIGHT"/"ELIGE A TU CABALLERO", sub "Every one of them holds the same gate. They just hold it differently."/"Todos sostienen la misma puerta. Solo que cada uno a su manera.", knights "KNIGHTS"/"CABALLEROS", difficulty "DIFFICULTY"/"DIFICULTAD", start "START · SPACE"/"EMPEZAR · ESPACIO", back "BACK · ESC"/"VOLVER · ESC"; `title.asKnight`: "Playing as {k} · {d}"/"Jugando como {k} · {d}".

`src/styles.css`: port the mock's `.v2s` rules under `.ov-setup` (grid of 3×2 `.kn` cards 300 px wide, `.dl` list 300 px, `.sel` highlight with the red/blue shadow, `.team` chip), all buttons `text-align: left`.

Smoke: `play(page, mode)` clicks PLAY, waits for `.ov-setup`, clicks START (`#ui .ov-setup .foot .btn:first-child`), then waits for `'playing'`. New `setup` check: on the setup, click `.kn[data-id="warden"]` and `.dl[data-id="incident"]`, `fits(page, 'setup')`, screenshot `setup.png`, START, assert `cfg.knight === 'warden' && cfg.difficulty === 'incident'` and the HUD pips count 8; reload, open the setup again and assert the choice is remembered; Spanish variant with `fits`.

Run: `npx vitest run`; `node scripts/smoke.mjs setup title debrief hud` and then the full suite (every check goes through `play`) → PASS.

- [ ] **Step 3: Commit**

```bash
git add -A src scripts
git commit -m "Add the knight and difficulty setup screen" -m "PLAY and OVERTIME open a screen with six knights and four difficulties; the choice starts the run, is remembered, shows on the title, the debrief and the share line, and keys the bests." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14: The Armory

**Files:**
- Create: `src/ui/armory.ts`, `src/ui/armory.test.ts`
- Modify: `src/core/keys.ts` (`Screen` + 'armory', action `armory`), `src/app.ts` (`toggleArmory`, `beforeArmory`, 'armory' pauses), `src/ui/overlays.ts`, `src/ui/title.ts` (ARMORY button), `src/ui/pausePanel.ts` (ARMORY button), `src/ui/draftPanel.ts` (T hint), `src/styles.css`, `src/i18n/{en,es}.json`, `scripts/smoke.mjs` (`armory` check)

**Interfaces:**
- Produces: `renderArmory(box, d: { owned: CardId[]; credits: number; close(): void })`; `armoryEntries(owned): ArmoryEntry[]` (pure) where `ArmoryEntry = { id: CardId; family: 'destrier' | 'obs' | null; levels: { id: CardId; owned: boolean; next: boolean; price: number }[]; state: 'owned' | 'start' | 'draft' | 'locked' | 'oneShot'; needs?: CardId; price: number }`; `App.act('armory')`.

- [ ] **Step 1: Failing tests**

`src/ui/armory.test.ts`:
```ts
it('lists every upgrade once, grouped by level, with its state for this run', () => {
  const e = armoryEntries(['lockdown', 'destrier', 'obs1', 'obs2', 'f2b', 'prepared']);
  expect(e.map((x) => x.id)).toEqual(['destrier', 'obs1', 'squire', 'lens', 'lockdown', 'quote', 'f2b', 'tarpit', 'cdn', 'prepared', 'sortlist', 'mfa', 'csp', 'backup']);
  const d = e.find((x) => x.id === 'destrier')!;
  expect(d.levels.map((l) => [l.id, l.owned, l.next])).toEqual([['destrier', true, false], ['destrier2', false, true], ['destrier3', false, false]]);
  expect(e.find((x) => x.id === 'lockdown')!.state).toBe('start');
  expect(e.find((x) => x.id === 'f2b')!.state).toBe('owned');
  expect(e.find((x) => x.id === 'backup')!.state).toBe('oneShot');
  expect(e.find((x) => x.id === 'squire')!.state).toBe('draft');
  const o = e.find((x) => x.id === 'obs1')!;
  expect(o.levels.map((l) => l.owned)).toEqual([true, true, false]);
});

it('renders three columns with a detail panel that follows the focus', () => {
  const box = document.createElement('div'); document.body.append(box);
  renderArmory(box, { owned: ['lockdown'], credits: 820, close: () => {} });
  expect(box.querySelectorAll('.ar-col').length).toBe(3);
  expect(box.querySelectorAll('.cx').length).toBe(14);
  (box.querySelector('.cx[data-id="tarpit"]') as HTMLElement).dispatchEvent(new Event('mouseenter'));
  expect(box.querySelector('.ar-detail h6')?.textContent).toBe('Tarpit');
  expect(box.querySelector('.ar-detail .stat')?.textContent).toContain('600');
});
```
`src/app.test.ts`:
```ts
it('toggles the armory from the title, the pause and play, pausing play, and returns where it came from', () => {
  const { app } = mountApp({ noRun: true });
  app.act('armory'); expect(app.screen).toBe('armory');
  app.act('armory'); expect(app.screen).toBe('title');
  app.startRun('campaign', { knight: 'black', difficulty: 'analyst' });
  app.act('armory'); expect(app.screen).toBe('armory');
  expect(app.lastPause).toBe(true);           // the test helper records pause(true/false) calls on a fake view
  app.act('armory'); expect(app.screen).toBe('playing');
  app.act('pause'); app.act('armory'); app.act('armory'); expect(app.screen).toBe('paused');
});
```
Run → FAIL.

- [ ] **Step 2: Implement**

`src/core/keys.ts`: `Screen` + `'armory'`; `Action` + `'armory'`; `const isT = (k: KeyInput) => k.key === 't' || k.key === 'T';` in `route` after the console/inField lines: `if (screen === 'armory') return k.key === 'Escape' || isT(k) ? 'armory' : null; if (isT(k) && (screen === 'title' || screen === 'paused' || screen === 'draft' || screen === 'playing')) return 'armory';`; `NO_REPEAT` + `'armory'`.

`src/app.ts`: `private beforeArmory: Screen = 'title';` `setScreen`: `const paused = s === 'paused' || s === 'console' || s === 'armory';` `act` run-less branch: `if (a === 'armory') { this.toggleArmory(); return; }` with
```ts
private toggleArmory(): void {
  if (this.screen === 'armory') { this.setScreen(this.beforeArmory); return; }
  if (this.screen === 'title' || this.screen === 'paused' || this.screen === 'draft' || this.screen === 'playing') { this.beforeArmory = this.screen; this.setScreen('armory'); }
}
```

`src/ui/armory.ts`: `armoryEntries(owned)`: walk `CARDS` in order, fold `destrier2/3` into `destrier` and `obs2/3` into `obs1` as `levels`; state: `backup` → `oneShot`; `STARTING_LOADOUT.includes(id)` → `start`; owned (any level) → `owned`; `req` not owned → `locked` with `needs`; else `draft`; `price = PRICE[rarity]` of the top-level card (or of the next level for families). `renderArmory`: `h4`/head row (`t('armory.title')`, `t('armory.owned', { n, total })`, credits in green, `kbd` T), three `.ar-col` (`KNIGHT`, `FIREWALL`, `SERVER` with the branch intros `t('armory.knightIntro')`…), one `.cx` per entry (`data-id`, `img.px` icon via `iconUrl(icon, 'tile')`, `.nm` with pips for families, `.ds` short `loc(does)` of the top owned or first level, `.st` state line, `.tiers` rows for families with `on`/`next` classes), a sticky `.ar-detail` filled on `mouseenter`/`focus` of a card (category · rarity · level, name, does, IN REAL LIFE, THE CATCH, state), and a CLOSE button (`t('armory.close')`) focused on open. Cards are `button.cx` so Tab walks them and focus fills the detail.

`src/ui/overlays.ts`: `Kind` + `'armory'`; `onScreen('armory')` → `show('armory')`; render: `renderArmory(this.box, { owned: a.run?.state.owned ?? [...STARTING_LOADOUT], credits: a.run?.state.credits ?? 0, close: () => a.act('armory') })`. `src/ui/title.ts`: an ARMORY button (`t('title.armory')`) calling `d.armory`; `src/ui/pausePanel.ts`: an ARMORY button; `src/ui/draftPanel.ts`: a `.note` `t('draft.armoryHint')`.

Strings: `armory`: title "ARMORY"/"ARMERÍA", owned "{n} of {total} owned"/"{n} de {total} en tu poder", stOwned "OWNED"/"TUYO", stStart "OWNED · START"/"TUYO · INICIO", stDraft "IN THE DRAFT · {n}"/"EN EL SORTEO · {n}", stLocked "LOCKED · needs {name}"/"BLOQUEADO · requiere {name}", stOneShot "ONE SHOT · {n}"/"UN SOLO USO · {n}", level "LEVEL {l} OF {n}"/"NIVEL {l} DE {n}", knightIntro "read & act"/"leer y actuar", firewallIntro "rules at the door"/"reglas en la puerta", serverIntro "fix the code"/"arreglar el código", close "CLOSE · T"/"CERRAR · T"; `title.armory` "ARMORY"/"ARMERÍA"; `pause.armory` "ARMORY · T"/"ARMERÍA · T"; `draft.armoryHint` "T · see every upgrade in the Armory"/"T · mira todas las mejoras en la Armería".

`src/styles.css`: port the mock's `.ar`, `.ar-head`, `.ar-body`, `.ar-col`, `.cx`, `.tiers`, `.ar-detail`, `.ar-where` rules under `.ov-armory` (1060 px wide, cards as buttons: `font: inherit; text-align: left; cursor: pointer`).

Smoke `armory`: on the title press `t`, assert `.ov-armory`, `fits`, screenshot; Esc back to the title; `play`, press `t`, assert `screen === 'armory'` and `run.state.phase === 'playing'` with the HUD clock frozen (compare `timeLeft` across 300 ms), Tab to the third card, assert the detail `h6` changed, `t` back to playing; Spanish `fits`.

Run: `npx vitest run`; `node scripts/smoke.mjs armory title pause draft` → PASS.

- [ ] **Step 3: Commit**

```bash
git add -A src scripts
git commit -m "Add the Armory" -m "A read-only codex of every upgrade in three branches, with levels, states and a detail panel, from the title, the pause menu, the draft and play (T)." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 15: Sound — synthesized effects, a sequenced loop, mute and the pause toggles

**Files:**
- Create: `src/audio/synth.ts`, `src/audio/music.ts`, `src/audio/index.ts`, `src/audio/audio.test.ts`
- Modify: `src/core/keys.ts` (action `mute`), `src/app.ts` (`onMute`), `src/main.ts` (register `AudioView`), `src/ui/pausePanel.ts` (MUSIC / SOUND / VOLUME), `src/ui/overlays.ts`, `src/ui/hud.ts` (speaker glyph), `src/styles.css`, `src/i18n/{en,es}.json`, `README.md` (credits), `scripts/smoke.mjs` (`sound` check)

**Interfaces:**
- Produces: `type SfxName = 'throw' | 'hit' | 'miss' | 'swallow' | 'breach' | 'pick' | 'levelUp' | 'button' | 'pause' | 'waveStart' | 'charge' | 'recap'`; `createSynth(ctx: AudioContext, out: GainNode): { play(name: SfxName): void }`; `createMusic(ctx: AudioContext, out: GainNode): { start(): void; stop(): void; running: boolean }`; `PATTERN` (the loop's note table, exported for the test); `class AudioView implements View` with `toggleMute()`, `set(prefs: { sound; music; volume })`; `App.onMute: (() => void) | null`.

- [ ] **Step 1: Failing tests**

`src/audio/audio.test.ts` (node environment; a fake `AudioContext`):
```ts
// packages
import { describe, expect, it, vi } from 'vitest';

// local
import { createMusic, PATTERN } from './music';
import { createSynth } from './synth';
import { AudioView } from './index';

const fakeCtx = () => {
  const started: string[] = [];
  const node = () => ({ connect: vi.fn().mockReturnThis(), disconnect: vi.fn(), start: vi.fn((t) => started.push(String(t))), stop: vi.fn(), frequency: { value: 440, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() }, gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, type: 'square', buffer: null });
  const ctx = { currentTime: 0, state: 'suspended', destination: {}, createOscillator: node, createGain: node, createBufferSource: node, createBuffer: () => ({ getChannelData: () => new Float32Array(2205) }), resume: vi.fn().mockResolvedValue(undefined) };
  return { ctx: ctx as unknown as AudioContext, started };
};

describe('audio', () => {
  it('plays every effect without throwing and schedules at least one voice each', () => {
    const { ctx, started } = fakeCtx();
    const s = createSynth(ctx, ctx.createGain());
    for (const n of ['throw', 'hit', 'miss', 'swallow', 'breach', 'pick', 'levelUp', 'button', 'pause', 'waveStart', 'charge', 'recap'] as const) {
      const before = started.length;
      s.play(n);
      expect(started.length).toBeGreaterThan(before);
    }
  });

  it('loops a 16-step pattern of bass, lead and hat within the chiptune range', () => {
    expect(PATTERN.bass.length).toBe(16); expect(PATTERN.lead.length).toBe(16); expect(PATTERN.hat.length).toBe(16);
    for (const n of [...PATTERN.bass, ...PATTERN.lead]) if (n) { expect(n).toBeGreaterThan(50); expect(n).toBeLessThan(2000); }
    const { ctx, started } = fakeCtx();
    const m = createMusic(ctx, ctx.createGain());
    m.start(); expect(m.running).toBe(true); expect(started.length).toBeGreaterThan(0);
    m.stop(); expect(m.running).toBe(false);
  });

  it('is silent and safe without an AudioContext, and never starts before a gesture', () => {
    const view = new AudioView(() => null, { sound: true, music: true, volume: 2 });
    expect(() => { view.start(); view.event({ type: 'waveStarted', wave: 1 }); view.screen('playing'); view.toggleMute(); }).not.toThrow();
    const { ctx } = fakeCtx();
    const v2 = new AudioView(() => ctx, { sound: true, music: true, volume: 2 });
    v2.screen('title');
    expect(v2.unlocked).toBe(false);
    v2.unlock();
    expect(v2.unlocked).toBe(true);
  });

  it('survives a resume that rejects', async () => {
    const { ctx } = fakeCtx();
    (ctx.resume as unknown as { mockRejectedValue(v: unknown): void }).mockRejectedValue(new Error('blocked'));
    const v = new AudioView(() => ctx, { sound: true, music: true, volume: 2 });
    v.unlock();
    await Promise.resolve();
    expect(() => v.event({ type: 'thrown', packetId: 1, by: 'knight', from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, duration: 0.2 })).not.toThrow();
  });
});
```
Run → FAIL.

- [ ] **Step 2: The synth**

`src/audio/synth.ts`: each effect is a short envelope on one or two oscillators or a noise burst:
```ts
export type SfxName = 'throw' | 'hit' | 'miss' | 'swallow' | 'breach' | 'pick' | 'levelUp' | 'button' | 'pause' | 'waveStart' | 'charge' | 'recap';

const tone = (ctx: AudioContext, out: AudioNode, type: OscillatorType, f0: number, f1: number, dur: number, gain = 0.25, at = 0): void => {
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);
};
const noise = (ctx: AudioContext, out: AudioNode, dur: number, gain = 0.2, at = 0): void => {
  const t = ctx.currentTime + at, n = Math.ceil(ctx.sampleRate * dur) || 2205, buf = ctx.createBuffer(1, n, ctx.sampleRate || 44100), d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const s = ctx.createBufferSource(), g = ctx.createGain();
  s.buffer = buf; g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  s.connect(g).connect(out); s.start(t);
};

export const createSynth = (ctx: AudioContext, out: GainNode) => ({
  play(name: SfxName): void {
    switch (name) {
      case 'throw': tone(ctx, out, 'triangle', 900, 300, 0.12, 0.2); noise(ctx, out, 0.08, 0.08); break;
      case 'hit': noise(ctx, out, 0.18, 0.3); tone(ctx, out, 'square', 220, 60, 0.18, 0.2); break;
      case 'miss': tone(ctx, out, 'sine', 300, 120, 0.2, 0.12); break;
      case 'swallow': noise(ctx, out, 0.35, 0.12); tone(ctx, out, 'sawtooth', 140, 40, 0.35, 0.1); break;
      case 'breach': tone(ctx, out, 'square', 110, 55, 0.5, 0.3); noise(ctx, out, 0.4, 0.25, 0.05); break;
      case 'pick': tone(ctx, out, 'square', 523, 659, 0.08, 0.15); tone(ctx, out, 'square', 784, 1046, 0.12, 0.15, 0.08); break;
      case 'levelUp': [523, 659, 784, 1046].forEach((f, i) => tone(ctx, out, 'square', f, f, 0.1, 0.15, i * 0.07)); break;
      case 'button': tone(ctx, out, 'square', 660, 660, 0.05, 0.1); break;
      case 'pause': tone(ctx, out, 'triangle', 440, 220, 0.15, 0.12); break;
      case 'waveStart': [392, 523, 659].forEach((f, i) => tone(ctx, out, 'triangle', f, f, 0.14, 0.18, i * 0.1)); break;
      case 'charge': noise(ctx, out, 0.5, 0.15); [0, 0.12, 0.24, 0.36].forEach((at) => tone(ctx, out, 'square', 160, 90, 0.1, 0.18, at)); break;
      case 'recap': tone(ctx, out, 'sine', 330, 330, 0.25, 0.12); tone(ctx, out, 'sine', 415, 415, 0.3, 0.1, 0.12); break;
    }
  },
});
```

- [ ] **Step 3: The loop**

`src/audio/music.ts`: a 16-step sequencer at 120 BPM (step = 0.125 s), scheduling one bar ahead on a 100 ms timer; `PATTERN = { bass: [110, 0, 110, 0, 131, 0, 110, 0, 98, 0, 98, 0, 131, 0, 147, 0], lead: [440, 0, 523, 440, 0, 659, 0, 587, 523, 0, 440, 0, 392, 0, 440, 0], hat: [1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1] }` (A minor; `0` is a rest); bass `square` at gain 0.08 for 0.11 s, lead `triangle` at 0.07 for 0.1 s, hat = `noise` 0.03 s at 0.03; `start()` resumes from step 0, `stop()` clears the timer and sets `running = false`; a `setLevel(0..1)` on its own gain.

- [ ] **Step 4: The view**

`src/audio/index.ts`:
```ts
export class AudioView implements View {
  unlocked = false;
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null; private sfxGain: GainNode | null = null; private musicGain: GainNode | null = null;
  private synth: ReturnType<typeof createSynth> | null = null; private music: ReturnType<typeof createMusic> | null = null;
  private prefs: { sound: boolean; music: boolean; volume: 0 | 1 | 2 | 3 };
  private screenNow: Screen = 'title';
  constructor(private readonly make: () => AudioContext | null, prefs: Partial<Prefs>, private readonly onChange?: (p: { sound: boolean; music: boolean; volume: 0 | 1 | 2 | 3 }) => void) {
    this.prefs = { sound: prefs.sound ?? true, music: prefs.music ?? true, volume: prefs.volume ?? 2 };
  }
  // Browsers only start audio after a user gesture: the first key or click builds the graph and resumes it.
  unlock(): void {
    if (this.unlocked) return;
    this.unlocked = true;
    try {
      const ctx = this.make();
      if (!ctx) return;
      this.ctx = ctx;
      this.master = ctx.createGain(); this.sfxGain = ctx.createGain(); this.musicGain = ctx.createGain();
      this.sfxGain.connect(this.master); this.musicGain.connect(this.master); this.master.connect(ctx.destination);
      this.synth = createSynth(ctx, this.sfxGain); this.music = createMusic(ctx, this.musicGain);
      this.apply();
      void Promise.resolve(ctx.resume?.()).catch(() => { /* stays silent */ });
      this.screen(this.screenNow);
    } catch { this.ctx = null; }
  }
  private apply(): void {
    const v = [0, 0.35, 0.65, 1][this.prefs.volume];
    if (this.master) this.master.gain.value = v;
    if (this.sfxGain) this.sfxGain.gain.value = this.prefs.sound ? 1 : 0;
    if (this.musicGain) this.musicGain.gain.value = this.prefs.music ? 0.5 : 0;
  }
  set(p: Partial<typeof this.prefs>): void { this.prefs = { ...this.prefs, ...p }; this.apply(); this.onChange?.(this.prefs); }
  get settings() { return { ...this.prefs }; }
  toggleMute(): void { const on = !(this.prefs.sound || this.prefs.music); this.set({ sound: on, music: on }); }
  private sfx(n: SfxName): void { try { if (this.prefs.sound) this.synth?.play(n); } catch { /* a dead context plays nothing */ } }
  event(ev: RunEvent): void {
    if (ev.type === 'thrown') this.sfx('throw');
    if (ev.type === 'shattered') this.sfx('hit');
    if (ev.type === 'missed') this.sfx('miss');
    if (ev.type === 'consumed') this.sfx('swallow');
    if (ev.type === 'resolved' && ev.outcome === 'breach') this.sfx('breach');
    if (ev.type === 'owned') this.sfx('pick');
    if (ev.type === 'waveStarted') this.sfx('waveStart');
    if (ev.type === 'chargeStarted') this.sfx('charge');
  }
  screen(s: Screen): void {
    this.screenNow = s;
    if (!this.music) return;
    try {
      if (s === 'paused' || s === 'armory' || s === 'console') this.music.setLevel(0.4);
      else if (s === 'debrief') this.music.stop();
      else { this.music.setLevel(1); if (!this.music.running) this.music.start(); }
      if (s === 'paused') this.sfx('pause');
      if (s === 'recap') this.sfx('recap');
    } catch { /* silent */ }
  }
}
```
(Add `levelUp` on a family level rising: compare `destrierLevel`/`obsLevel` before and after an `owned` event, like the loadout does; `button` on overlay button clicks via a `document` `click` listener filtered to `.ov button`.)

`src/core/keys.ts`: `Action` + `'mute'`; `route`: after the console/inField lines, `if (k.key === 'm' || k.key === 'M') return 'mute';`; `NO_REPEAT` + `'mute'`. `src/app.ts`: `onMute: (() => void) | null = null;` and the run-less branch `if (a === 'mute') { this.onMute?.(); this.refresh(); return; }`. `src/main.ts`: `const audio = new AudioView(() => (typeof AudioContext === 'function' ? new AudioContext() : null), store.prefs(), (p) => store.setPrefs(p)); app.add(audio); app.onMute = () => audio.toggleMute(); for (const ev of ['keydown', 'pointerdown']) window.addEventListener(ev, () => audio.unlock(), { once: false });` and pass `audio` to `Overlays` opts.

`src/ui/pausePanel.ts`: `d.audio: { sound: boolean; music: boolean; volume: number }`, `toggleSound()`, `toggleMusic()`, `cycleVolume()`; three more ghost buttons (`t('pause.sound', { s })`, `t('pause.music', { s })`, `t('pause.volume', { n })`). `src/ui/hud.ts`: a `span.mute` with `♪` / `♪̸` text (use `t('hud.muted')` "MUTED") shown when both are off, refreshed in `refresh()` from `app`'s audio settings via a getter `app.onMute` sibling `app.audioSettings: (() => {sound,music}) | null`.

Strings: `pause.sound` "SOUND · {s}", `pause.music` "MUSIC · {s}", `pause.volume` "VOLUME · {n}/3", `pause.on` "ON", `pause.off` "OFF", `hud.muted` "MUTED · M"; Spanish "SONIDO · {s}", "MÚSICA · {s}", "VOLUMEN · {n}/3", "SÍ", "NO", "SILENCIO · M". `howto.k11` (Task 17 lists it).

README: a "Sound" section: every effect is synthesized in the browser with the Web Audio API and the loop is a built-in 16-step sequence; no audio files, no licences to carry. (Spec §12 said a CC0 file; this plan ships the sequencer and keeps `public/audio/` free for a CC0 loop later — note it in the spec's §12 in Task 17.)

Smoke `sound`: `play`, assert `window.__nsp.audio.unlocked === true` after the first key, press `m`, assert `#ui .hud .mute` visible and `prefs.sound === false`, press `m` again, open the pause and assert the three buttons exist; no audio assertions beyond state (headless Chromium has no output device).

Run: `npx vitest run`; `node scripts/smoke.mjs sound pause hud` → PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src scripts README.md
git commit -m "Add synthesized sound effects, a sequenced music loop and the sound settings" -m "Every effect is a short Web Audio envelope and the loop is a 16-step chiptune sequence, so nothing is downloaded or licensed; M mutes, the pause menu toggles sound and music and steps the volume, and audio waits for the first key." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 16: Animation polish and the debrief's visuals

**Files:**
- Modify: `src/game/views/effects.ts`, `src/game/views/packets.ts`, `src/game/views/fireWall.ts`, `src/game/views/rack.ts`, `src/ui/draftPanel.ts`, `src/ui/overlays.ts`, `src/ui/debrief.ts`, `src/styles.css`, `scripts/smoke.mjs` (`polish` check)

**Interfaces:**
- Produces: `EffectsView.snap()` (3 px camera shake + 60 ms white flash), `EffectsView.sparks(x, y)`, `EffectsView.rain()` (Task 10); `renderDebrief` counts the score up and stamps the grade.

- [ ] **Step 1: Field polish**

`src/game/views/effects.ts`:
- `snap()`: `if (this.reduced) return; this.scene.cameras.main.shake(60, 0.0015); const f = this.scene.add.rectangle(0, 0, FIELD_W, FIELD_H, 0xffffff, 0.35).setOrigin(0, 0); this.scene.layers.fx.add(f); this.scene.tweens.add({ targets: f, alpha: 0, duration: 60, onComplete: () => f.destroy() });` called on `shattered` when `by === 'knight'` or `'charge'`.
- `sparks(x, y)`: an emitter of 2×2 orange (`#ff8a2f`) and gold squares, `speed 80–220`, `gravityY 300`, lifespan 500, `explode(reduced ? 0 : 24, x, y)`; called from `RackView` on a breach via the `EffectsView` reference (pass it in the constructor like Task 10 did for actors).
- The knight's wind-up: `ActorsView` already shows `foot-throw` while `throwT > 0`; the spear's `thrown` event arrives at the same step, so the wind-up is the 80 ms the core's `throwT` 0.3 s covers; no change needed beyond keeping `throwT`.

`src/game/views/packets.ts`: in `create`, `box.setScale(0.9); this.scene.tweens.add({ targets: box, scale: 1, duration: 120, ease: 'Back.easeOut' })` unless reduced (then `setScale(1)`); in `frame`, `v.box.setPosition(x, packetY(p) + (this.scene.reduced ? 0 : Math.round(Math.sin(time * 3.9 + p.id) * 1)))` (the hit test uses `packetY`, unchanged).

`src/game/views/fireWall.ts`: on `entered`, the flash goes to alpha 0.9 and lasts 200 ms (today 0.6 / 140); under reduced keep 0.6 / 140.

- [ ] **Step 2: Draft and debrief**

`src/ui/draftPanel.ts`: each `.ucard` gets `style.setProperty('--i', String(i))`; CSS `.ucard { animation: flip .24s ease-out both; animation-delay: calc(var(--i) * 120ms) } @keyframes flip { from { transform: rotateY(90deg); opacity: 0 } to { transform: none; opacity: 1 } }` and `#ui.reduced .ucard { animation: none }`. On a pick, `Overlays` (which owns the redraw) clones the card's `img.px`, appends it to `#ui` at the card's rect, and animates it with `element.animate([{ transform: 'translate(0,0)' }, { transform: \`translate(${dx}px, ${dy}px) scale(.6)\` }], { duration: 300, easing: 'ease-in' })` to the loadout column's next tile rect (`#ui .loadout`'s bottom), removing it on finish; skipped under reduced. The tile pulse comes from Task 11's flash class, which `LoadoutTiles` also applies to a newly added tile.

`src/ui/debrief.ts`: the score `b` starts at `0` and counts up to `r.score` over 0.8 s with `requestAnimationFrame` (skip under reduced: set the final value); the grade element gets class `stamp` → CSS `@keyframes stamp { from { transform: scale(2); opacity: 0 } 70% { transform: scale(.95); opacity: 1 } to { transform: none } } .grade.stamp { animation: stamp .3s ease-out both } .ov-debrief.shake { animation: shake .3s steps(6) }` (the overlay gets `shake` for the thud, removed on `animationend`; none under reduced); grade colours `.grade[data-g="S"] { color: var(--gold) } … A green, B blue, C ink, D #ff8a2f, F red`; stat values coloured like the HUD (score gold, breaches red, served/neutralized blue). `renderDebrief` sets `data-g`.

Smoke `polish`: `play`, step until a knight hit, freeze within 60 ms and assert a white `fx` rectangle exists (expose `window.__nsp.effects.debugFlashes()` count), then `reduced` on: the same path shows none; open a draft and assert each `.ucard` has `--i`; on the debrief assert `.grade.stamp` and that the score `b` text equals the final score after 1 s.

Run: `npx vitest run`; `node scripts/smoke.mjs polish reduced packets draft debrief` → PASS; look at `packets-shatter.png` (flash), `draft.png`, `debrief.png`.

- [ ] **Step 3: Commit**

```bash
git add -A src scripts
git commit -m "Polish the field, draft and debrief animations" -m "A hit snaps and flashes the screen, packets pop in and bob, the fire flares and the rack sparks; draft cards flip in and the bought one flies to its tile; the debrief counts the score up and stamps the grade in its colour." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 17: How-to, the leftovers from v1's review, README and the release check

**Files:**
- Modify: `src/ui/title.ts` (how-to rows), `src/i18n/{en,es}.json`, `src/styles.css` (reduced flicker), `.github/workflows/deploy.yml` (PR concurrency group), `scripts/smoke.mjs` (`hud` CLEARING fit), `README.md`, `docs/superpowers/specs/2026-10-05-playtest-round-one-design.md` (§12 note), `docs/superpowers/specs/2026-10-04-none-shall-pass-design.md` (§6 Destrier, §8 cards, status)

- [ ] **Step 1: How-to and strings**

`renderHowto` rows: `['↑ ↓', 'howto.k1'], ['Tab', 'howto.k2'], ['Shift+Tab', 'howto.k8'], [Space, 'howto.k3'], ['Esc', 'howto.k4'], [click, 'howto.k5'], ['H', 'howto.k6'], ['C', 'howto.k9'], ['T', 'howto.k10'], ['M', 'howto.k11'], ['P', 'howto.k7']`; `howto.k2` becomes "next packet in that lane", `k8` "previous packet in that lane", `k9` "charge the lane (Destrier III)", `k10` "the Armory: every upgrade and what you own", `k11` "mute"; Spanish: "paquete anterior en ese carril", "carga por el carril (Destrero III)", "la Armería: todas las mejoras y lo que tienes", "silencio". `fits` on the how-to in both languages.

- [ ] **Step 2: The v1 leftovers**

- `es.json` `hud.clearing`: "DESPEJE" (fits where "DESPEJANDO" overflowed); extend the smoke `hud` check to force `timeLeft = 0` mid-wave (`stepUntil` is not needed: set it in-page and `app.refresh()`), assert the Spanish HUD still fits with the spec's `room ≥ 8` rule.
- `.github/workflows/deploy.yml`: `concurrency: { group: ${{ github.event_name == 'pull_request' && format('pr-{0}', github.ref) || 'pages' }}, cancel-in-progress: false }`.
- `src/styles.css`: under `#ui.reduced`, double the `.segs i.lost` flicker durations (1.3s→2.6s, .7s→1.4s) like the other glitches.

- [ ] **Step 3: README and specs**

README: controls table (add Shift+Tab, C, T, M), a "Knights and difficulties" section (the six names and identities, the four difficulties with their numbers), the Destrier levels in the upgrades table, "Sound" (Task 15), the Armory and the recap in "What it teaches". Round-one spec §12: a note that v1.1 ships a built-in sequenced loop and effects, with `public/audio/` reserved for a CC0 file later. v1 spec: §6 Destrier → "see the round-one spec", status line "v1 + round one implemented (local)".

- [ ] **Step 4: Release check**

```bash
npm run lint
npm run test:coverage
npm run build
node scripts/smoke.mjs
```
All green; open every `smoke-out/*.png` and compare against `docs/mocks/2026-10-05-round-one-mocks.html`. Then `git status` clean.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Document the round-one controls and finish the v1 leftovers" -m "The how-to lists every key, the README covers the knights, difficulties, Armory, recap and sound, the Spanish CLEARING label fits, PR builds get their own concurrency group and reduced effects slow the last flicker." -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Self-review notes (run by the plan author)

- **Spec coverage:** §3 → Tasks 4, 12–15, 17; §4 → Tasks 1, 4, 8; §5 → Tasks 7, 9; §6 → Tasks 1, 3, 10, 11; §7 → Tasks 4, 12; §8 → Tasks 10, 11, 16; §9 → Task 14; §10 → Task 11; §11 → Tasks 1, 2, 5, 7, 13; §12 → Task 15 (sequencer instead of a CC0 file, noted in Task 17); §13 → Tasks 9, 10, 16; §14 → Task 6; §15 → Task 7; §16 defaults → as above; §17/18 → each task's tests and smoke checks.
- **Type consistency:** `KnightLook`/`KnightId` (Task 1) are consumed by Tasks 7, 10, 13; `Difficulty`/`DIFFICULTIES` (Task 2) by Tasks 5, 13; `destrierLevel` (Task 3) by Tasks 10, 11, 14; `waveMistakes`/`mistakes` (Task 4) by Task 12; `Slot`/`slotOf` (Task 5) by Task 13; `knightKey`/`KnightPose` (Task 7) by Task 10; `encodedSpans`/`CHIP_COLOR` (Task 8) stand alone; `BugRig` (Task 9) by Task 8's view; `renderMistakes` (Task 12) by the debrief; `AudioView` (Task 15) by `main.ts` and the pause panel.
- **Review focus pins:** 1 → Task 12 test; 2 → Task 3 test; 3 → Task 4 test; 4 → Task 5 test; 5 → Task 15 tests.

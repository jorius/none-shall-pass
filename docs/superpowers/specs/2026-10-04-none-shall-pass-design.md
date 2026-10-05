# None Shall Pass: design spec

Date: 2026-10-04 · Status: draft for Jose's review · Visual reference: `docs/mocks/2026-10-04-core-loop-v4.html`
(open it in a browser; it is the playable HTML mock this spec was shaped from).

## 1. What it is

A desktop browser game in Jose's site style: you are the Black Knight guarding a server. Network packets
stream down five lanes toward a wall of fire; you read them, spear the malicious ones and let real users
through. Between waves you draft rogue-lite upgrades that teach the real defences (prepared statements,
MFA, fail2ban, observability). The name and the knight's voice come from Monty Python's Black Knight.

**Purpose (Jose: "a little bit of everything").** One game that:

- shows skill: a recruiter or client plays 3 to 6 minutes and leaves thinking "this person knows security";
- teaches: every packet and every upgrade carries a short, accurate explanation;
- is fun: arcade pressure, a playable character, juicy effects, a score worth replaying;
- hides secrets: a hidden console and a Konami code reward the curious.

**Audience tension.** It must be approachable for someone who has never read an HTTP request and still
credible to a security engineer. Hints, decoys, explanations and tiered difficulty resolve that.

**Success criteria for v1.**

1. A first-time visitor finishes the campaign in roughly 5 to 7 minutes and gets a graded debrief.
2. Every packet and card text is technically correct (a security reviewer finds nothing to object to).
3. Runs at a steady 60 fps on a mid-range laptop at 1366×768 and 1920×1080.
4. Published at `https://jorius.github.io/none-shall-pass/`, independent of the main site's deploys.

## 2. Scope

**In v1:** the core loop, 6-wave campaign, Overtime (endless) unlocked by winning, rogue-lite draft with
the card catalogue in §8, Destrier, Squire, Observability I to III with bugs, the burning rack, debrief
with grade and mistakes, local best scores, copy-to-share text, hidden console, Konami root mode,
English and Spanish, desktop-only gate for phones, Umami events, MIT licence, Pages deploy.

**Out of v1:** global leaderboard or any backend, phone/touch play, a light theme (see §16), music,
a `/projects` card or palette command on jorius.github.io (separate small PR on the site afterwards),
save-and-resume of a run in progress.

## 3. Platform, repo and hosting

- Repo `jorius/none-shall-pass` (public, MIT), checkout `/mnt/media/Sources/GitHub/Personal/none-shall-pass`.
- Vite + TypeScript (strict) + **Phaser 4.2.x**; no React. npm only; Node pinned in `.nvmrc` (24.15.0, as the
  Academy).
- GitHub Pages via Actions (`deploy.yml` copied from the Academy: lint, test, build, upload `dist`), Pages
  source "GitHub Actions". Vite `base` is `/none-shall-pass/` (overridable with `BASE_PATH`). There are no
  deep links, so no 404 fallback is needed.
- Desktop only: if the viewport is narrower than 900 px or the primary pointer is coarse, show a styled card
  ("This one needs a keyboard. Send yourself the link.") with a copy-link button instead of the game.
- Supported browsers: current Chrome, Firefox, Safari and Edge.

## 4. Visual identity

- Palette from the site's dark tokens: paper `#292929`, sub `#333333`, ink `#f2efe7`, dim `#a4a197`,
  mute `#3a3a3a`, soft `#1c1c1c`, rule `#e6e2d6`, red `#ff2f2f`, blue `#2fb6ff`, plus gold `#d9b44a` for
  knight upgrades. Dark only in v1.
- Fonts (self-hosted via `@fontsource`, all OFL): Space Mono for HUD, labels and titles; IBM Plex Mono for
  packet payloads and requests; Atkinson Hyperlegible Next for explanations. Minimum text size 13 px at
  1280×720 logical.
- Signature effects: RGB-split glitch on titles and hits, scan-line overlay, binary shatter, the blue wall
  of fire, HP corruption.
- Pixel art at 3× scale (knight, horse, rack, spear, icons, bugs). It is drawn by us: no Monty Python
  imagery, logos or likenesses, only short quotes as the knight's voice. The mock's sprites are the
  starting point; v1 replaces them with hand-polished sprite sheets (idle, walk, throw, gallop frames)
  exported as PNG atlases.

## 5. Screen layout (1280×720 logical, scaled to fit, letterboxed)

| Region | Box (x, y, w, h) | Content |
|---|---|---|
| HUD | 0, 0, 1280, 56 | title glitch, wave n/6 · name · clock, score, credits, reputation pips, hints toggle, pause |
| Lane gutter | 0, 56, 110, 450 | five lane labels; the knight's lane is inverted with a ▶ |
| Lanes | 110, 56, 796, 450 | five lanes of 90 px; packets travel left to right |
| Fire wall | 906, 56, 24, 450 | animated blue pixel fire; the firewall line |
| Knight post | 930, 56, 140, 450 | the knight (and Squire) between fire and rack |
| Server column | 1070, 56, 210, 450 | loadout tiles (left), the full-height rack (right) |
| Uptime strip | 0, 506, 1280, 30 | `UPTIME [50 segments] 100%`, full width |
| Inspector | 0, 536, 760, 184 | full request of the hovered/targeted packet; verdicts; card details |
| Event log | 760, 536, 520, 184 | scrollable history, wave column, ALL / MISTAKES filter |

Lanes: `:22 ssh`, `/login auth`, `/search query`, `/comments user posts`, `:* other ports`.

## 6. Core loop

**Packets.** A card (290×52) shows source IP + lane on line 1 and the payload on line 2. There is **no
colour coding**: reading is the skill. Hovering fills the inspector with the full request (method, path,
headers, body), the network (documentation ASNs) and, where relevant, a context line
(`THIS IP · 41 logins in 60 s · 41 different accounts`).

**Controls (keyboard first).**

| Input | Action |
|---|---|
| ↑ / ↓ | move the knight between lanes |
| Tab / Shift+Tab | target the next / previous packet in the knight's lane, front-most first |
| Space | throw a spear at the target |
| Esc | release the target |
| Click a packet | target it (and switch to its lane); click empty field to release |
| H | hints on/off (wavy red underline on the tells; score ×0.75 while on) |
| P | pause |
| ` | hidden console (§11) |

A target is only highlighted (red corner brackets, `TARGET · SPACE` tag). With no action it passes.

**Spear.** The knight throws on an arc (nose follows the flight); on impact the packet flashes and shatters
into ~50 fragments of 0/1 and its own payload characters, all at once.

**The fire wall.** When a packet's front edge reaches the fire:

1. Firewall rules from the loadout run first (§8). A match shatters the packet in blue at the fire.
2. Otherwise the fire consumes the card from its front edge (at 5× speed) and its bits stream in an arc
   into the rack. The stream looks the same for good and bad traffic.
3. ~0.6 s later the rack resolves it: served, neutralized (a server fix applied) or breach.

**Outcomes and scoring.**

| Event | Score / credits | Other |
|---|---|---|
| Knight hits malicious, tier 1 / 2 / 3 | +50 / +100 / +150 | tier 2-3 show a big glitch label; tier 3 "Have at you!" |
| Squire hits (tier 1 only) | +30 | |
| Rule blocks malicious | +20 | |
| Legit served | +10 | decoy served: +40 "NOT FOOLED" |
| Malicious neutralized by a server fix | +25 | |
| Malicious breach | 0 | uptime − damage (scan 2, brute 6, flood 3, xss 10, sqli 12); its bug infests the rack |
| False positive (knight or a rule; the Squire never targets legit traffic) | 0 | reputation −1 of 10 |

Score only goes up (×0.75 with hints, ×1.5 in root mode). Credits mirror earnings and are spent in drafts.
Run ends at uptime 0 ("SERVER DOWN": "All right, we'll call it a draw.") or reputation 0 ("USERS GONE":
"The server is perfectly safe, and perfectly empty.").

**The rack burns.** Below ~92% uptime a DOOM-style pixel fire starts at the rack's base; each further loss
lights another unit floor from the bottom up, flames grow taller, and the rack chars darker. Under 35% the
LEDs turn red and the uptime strip glitches on its own. Restoring uptime lets the fire die down.

**Uptime strip.** 50 segments. A breach tears the strip with RGB slices, scrambles the number into garbage
glyphs for ~0.45 s, flashes the lost segments red and leaves them as flickering static.

**Event log.** Every outcome appends a row (`W3 ✗ BREACH POST /search {"q"… −12% uptime`), newest first,
up to 300 rows, scrollable; hovering a row shows the verdict, tier and explanation in the inspector;
the MISTAKES filter shows only breaches and false positives. The log persists across waves and feeds the
debrief.

## 7. Content

**Packet template** (data, not code):

```ts
interface PacketTemplate {
  id: string;
  lane: 0 | 1 | 2 | 3 | 4;
  kind: 'legit' | 'sqli' | 'xss' | 'brute' | 'scan' | 'flood';
  tier?: 1 | 2 | 3;            // malicious only: obvious, tricky, sneaky
  decoy?: boolean;             // legit that looks scary
  port?: number;               // scans and :* traffic
  orderBy?: boolean;           // sort-field injection (immune to prepared statements)
  card: string;                // line 2 of the card
  request: string[];           // inspector lines
  hints?: string[];            // substrings underlined with hints on
  decoded?: string;            // derived: URL-decoded card text
  context?: Localized;         // inspector context line
  why: Localized;              // the verdict explanation
  net: NetworkId;              // documentation ASN label
  fixedSrc?: string;           // e.g. the credential-stuffing IP
  weight: number;
}
```

Rules for content: IPs from 192.0.2.0/24, 198.51.100.0/24 and 203.0.113.0/24 only; ASNs 64496 to 64511;
domains under `.example`. Packets are classified by intent. Every `why` is reviewed for accuracy.

**Catalogue for v1** (the mock's 24 templates plus the flood family; at least this set):

- Legit: socks search, `O'Reilly books` search, login, CI deploy over SSH key, comments, SMTP :25, plus
  browser `GET /` traffic for the flood wave. Decoys: `union+jack+t-shirt`, `drop-leaf+table+lamp`,
  `Why does my <script> tag load twice?`.
- SQLi: tautology with sqlmap UA (1), UNION dump (2), `SLEEP(5)` blind (2), URL-encoded tautology (3),
  stacked `DROP TABLE` in a JSON `sort` field (3, `orderBy`).
- Brute: `admin/123456` Hydra (1), SSH `root:toor` (1), password spraying `Spring2026!` (2), credential
  stuffing from one IP with the 41-logins context (3).
- XSS: cookie-stealing `<script>` (1), `<img onerror>` (2), base64 `javascript:` link in a friendly
  comment (3).
- Scan: SYN to :23, :445, :3389 with nmap's window 1024 (1).
- Flood (new): `GET /search?q=a` and `GET /comments` from many IPs with `Go-http-client/1.1` or empty UA,
  no cookies (1, damage 3 each, high volume); teaches that one request is harmless and the volume is the
  attack.

## 8. Upgrades (rogue-lite draft)

After each campaign wave (and every Overtime wave) a draft offers **3 cards**. **The first pick is free**;
the other two can be bought with credits (Common 250, Rare 600, Legendary 1,000); **reroll 150**. Cards
with `req` only appear once their prerequisite is owned. Weights: Common 5, Rare 3, Legendary 1. Every card
shows category, rarity, icon, what it does, **IN REAL LIFE** and **THE CATCH**. Owned cards show as tiles in
the server column; hovering a tile shows the card in the inspector. Every firewall card has a visible object
on the field.

| Card | Cat · rarity | Effect | Field object |
|---|---|---|---|
| Destrier | Knight · L | targeting rides out to the packet; it crawls at 30% for 5 s (gold bar); post empty meanwhile | mounted knight, gallop frames |
| Squire | Knight · R | auto-throws at tier-1 attacks every 3 s | second, smaller knight |
| Decoding lens | Knight · C | cards and inspector show URL-decoded payloads | `DECODED` tag on cards |
| Observability I · logs | Knight · C | tier-1 attacks crawl with bugs | bugs on cards |
| Observability II · metrics | Knight · R, req I | tier 2 too | |
| Observability III · tracing | Knight · L, req II | tier 3 too | |
| Port lockdown | Firewall · C | scans of closed ports denied; :25 stays open | padlock port panel; the probed row flashes DENIED |
| Quote filter | Firewall · C | drops any request with `'` (also O'Reilly; misses `%27` and the sort trick) | portcullis on the fire |
| fail2ban | Firewall · C | bans an IP after 2 failed logins | hammer + BANNED counter |
| Tarpit | Firewall · R | repeat IPs on /login move at 40% through the tar | tar strip on /login |
| CDN + rate limit | Firewall · R | flood packets absorbed at the fire; real browsers pass | a shield glyph over the HTTP lanes |
| Prepared statements | Server · R | SQLi neutralized except `orderBy` | shield tile |
| Sort-column allow-list | Server · R | neutralizes `orderBy` SQLi | shield tile |
| MFA + SSH keys only | Server · R | brute neutralized | shield tile |
| Output encoding + CSP | Server · R | XSS neutralized | shield tile |
| Restore from backup | Server · C | +30% uptime now (repeatable) | heal flash, fire dies down |

**Bugs (Observability).** Attacks at or below the owned level show pixel critters: SQLi = red spider,
XSS = gold worm, brute = green beetle, scan = buzzing fly, flood = swarm of tiny gnats. Tier-1 packets are
"infested" (two bugs). Decoys never have bugs. When a breach lands, its bug crawls onto the rack until the
wave ends (max 6). The inspector shows a `BUGGED · spider` tag on flagged packets.

The campaign starts with **Port lockdown** owned. The first draft always offers Destrier and Observability I.

## 9. Run structure

**Title screen.** Glitching title, the knight idling in front of an unburnt rack, **PLAY CAMPAIGN**,
**OVERTIME** (locked until the campaign is won once), HOW TO PLAY (one screen of the controls table and the
lesson), EN/ES, best scores, ROOT badge when root mode is on.

**Campaign (6 waves, ~60 s each, ~6 min plus drafts).**

| # | Name | Mix (weights boosted) | Teaching moment |
|---|---|---|---|
| 1 | RECON | scans + legit; slow spawn (1.4 s); short controls coach on first play | targeting and the port panel |
| 2 | BRUTE FORCE | brute + legit logins | context lines, fail2ban, MFA |
| 3 | SQL INJECTION | sqli + search decoys | O'Reilly, `%27`, the sort field |
| 4 | XSS | xss + comment decoys | `<script>` is not the only way |
| 5 | BOTNET FLOOD | flood + brute + scans; fast spawn (0.75 s) | volume is the attack; CDN + rate limit |
| 6 | FINALE | everything | |

Packet speed 72 px/s in the campaign. Each wave opens with the knight's line and a one-sentence intro.

**Overtime (endless).** Unlocked by winning the campaign. Mixed families; each wave is 45 s; speed +6% and
spawn interval −5% per wave (floors 150 px/s and 0.45 s); tier-3 share grows. Draft after every wave.
Ends on uptime 0 or reputation 0. Score is points plus 500 per wave survived.

**Debrief.** Shown at campaign end (win or loss) and Overtime end: grade, score, waves, hits by tier,
decoys kept, false positives, breaches by family, uptime left, the MISTAKES list with each packet's `why`,
best-score comparison, **COPY RESULT**, PLAY AGAIN, TITLE.

Grade (campaign): **F** server down or users gone · **S** won with uptime ≥ 90, 0 false positives and ≤ 1
breach · **A** won with uptime ≥ 75 and ≤ 2 false positives · **B** uptime ≥ 50 · **C** uptime ≥ 25 ·
**D** otherwise.

Share text (EN shown; ES too):

```
⚔ NONE SHALL PASS — Grade A · 18,420 pts · 2 breaches · 1 angry user
jorius.github.io/none-shall-pass
```

Root mode adds `· ROOT`; a tampered run adds `· TAMPERED` and saves no best score.

**Persistence (localStorage, wrapped in try/catch, game works without it):** best campaign score + grade,
best Overtime wave + score (each split by normal/root), campaign won flag, language, hints preference,
reduced-effects preference. No run state is saved.

## 10. Characters and voice

- **The Black Knight (you).** Speech bubble above his head (below him on the top lane), tail pointing at
  him, ~2.6 s. Lines: wave start "None shall pass."; first breach "'Tis but a scratch."; uptime < 55
  "It's just a flesh wound."; uptime < 25 "I'm invincible!" / "You are not."; tier-3 hit "Have at you!";
  false positive "Oops." / "That was a customer."; reputation 3 "Your users are getting angry."; server
  down "All right, we'll call it a draw." Spanish lines are our own translations.
- **The Squire.** Smaller knight with a gold tag; throws a shorter spear.

## 11. Secrets

**Hidden console** (backtick; pauses the game; a terminal panel over the lanes, Space Mono, blinking caret):

| Command | Result |
|---|---|
| `help` | lists the documented commands (not the cheats) |
| `whoami` | "the Black Knight. Arms: both, for now." |
| `man sqli` / `xss` / `brute` / `scan` / `flood` | a short man page for the attack family and its real fix |
| `nmap shop.example` | prints which ports answer, given the current loadout |
| `iptables -P INPUT DROP` | "Done. Your server is perfectly secure and has zero users." (no effect) |
| `sudo …` | "Nice try." |
| `sudo rm -rf /` | the screen glitches hard for a second, then "No." |
| `clear`, `exit` | |
| `god`, `credits <n>`, `skip` (cheats) | invulnerable uptime, add credits, end the wave; the run is marked **TAMPERED** |

**Konami code** (↑↑↓↓←→←→ B A on the title screen): toggles **root mode**: amber-phosphor palette swap,
packet speed ×1.25, hints disabled, score ×1.5, separate best scores, `ROOT` badge.

## 12. Languages

English and Spanish for every UI string, card, packet `why` and context line, knight line and console
output; payloads and requests stay as-is. Default from `navigator.language`, toggle on the title screen
and in the pause menu, remembered. JSON locale files per language with a test that both have the same keys.

## 13. Architecture

```
src/
  core/        pure TypeScript, no Phaser, no DOM, fully unit-tested
    content/   packet templates, cards, waves, knight lines (data + Localized text)
    rng.ts     seeded PRNG (mulberry32)
    run.ts     Run state + step(dt) → events; the single source of game rules
    rules.ts   firewall rules, server fixes, bug visibility
    score.ts   points, grade, share text
    draft.ts   card dealing, prices, prerequisites
  game/        Phaser 4 scenes and views (render + input only)
    BootScene, TitleScene, FieldScene
    views/     PacketView, KnightView, SquireView, FireWallView, RackView (+ fire), FieldObjects, Bugs, Effects
  ui/          DOM overlay in plain TS + CSS over the canvas
    hud, inspector, eventLog, uptimeStrip, draft, debrief, pause, console, phoneGate
  i18n/        en.json, es.json, t()
  storage.ts   guarded localStorage
  analytics.ts Umami track() no-op wrapper
  main.ts
```

- **Simulation owns the rules.** `Run.step(dt)` advances packets, timers, the knight's hold, the Squire and
  the wave clock at a fixed 60 Hz timestep and returns events (`spawned`, `targeted`, `thrown`, `hit`,
  `ruleBlocked`, `entered`, `resolved`, `breach`, `falsePositive`, `waveCleared`, `runEnded`). Views
  subscribe to events; they never decide outcomes. Player intents (`setLane`, `cycleTarget`, `target`,
  `throw`, `release`, `pick`, `buy`, `reroll`) go into the Run. Same seed + same inputs = same run, so a
  whole wave can be simulated in a unit test.
- **Phaser renders the field**: lanes, packet cards (Text inside Containers with a mask while entering the
  fire), knight and Squire sprites, spears (tweens on a quadratic path), the shatter and stream particles,
  the fire wall and rack fire (CanvasTexture updated at 30 Hz), field objects and bugs.
- **DOM renders text-heavy UI** (HUD, inspector, event log, uptime strip, draft, debrief, console) in a layer
  that shares the canvas's 1280×720 transform, so typography, i18n and scrolling stay native. Hit-testing
  for packets stays in Phaser.
- The `` ` `` console, pause and draft pause the Run; WAAPI/CSS and Phaser tweens pause with it.
- `prefers-reduced-motion` (and a settings toggle) reduces shatter counts, disables screen shake and
  halves glitch frequency.

## 14. Analytics

Umami tag for website `f182739a-828d-4a63-81ab-07e8fd73945f` (the site's, `data-domains="jorius.github.io"`)
in `index.html` after the module script. Events: `game-start` (mode, root), `wave-cleared` (wave),
`run-ended` (mode, grade or wave, score bucket), `share-copied`, `console-opened`, `root-mode`. No IPs,
no personal data.

## 15. Testing

- **Unit (vitest, coverage gate 80% on `src/core`)**: rules (every card against every relevant packet),
  scoring and grades, share text, draft dealing and prerequisites, spawn spacing per lane, entering and
  resolve timing, hold timer, Squire targeting, deterministic full-wave simulations with scripted inputs,
  locale key parity, content invariants (documentation IPs only, every malicious packet has a tier and a
  `why` in both languages).
- **Smoke (Playwright, headless only)**: boots without console errors, title → campaign → targets and
  throws with the keyboard → draft → debrief; phone gate at 390 px; Konami toggles root mode; console opens.
- **Manual**: Jose plays the build locally before anything is pushed.

## 16. Decisions taken by default (Jose: confirm or change)

1. **Dark only** in v1 (the mock is dark; a light palette would need a second set of sprites and fire colours).
2. **No sound in v1**; a small SFX set with a mute toggle is the first follow-up.
3. The **campaign wave list** in §9, including the new **flood** family and the **CDN + rate limit** card.
4. **Grade thresholds** in §9 and **Overtime** ramp numbers.
5. **Console commands** and the **root mode** effects in §11.
6. The debrief and share text in §9.
7. HOW TO PLAY is a single static screen plus a first-wave coach, not an interactive tutorial.

## 17. Repo conventions

- Commit subjects start with a capitalized infinitive verb (Husky `commit-msg` hook copied from the
  Academy); bodies explain why; signed commits as Jose Rios; Claude co-author trailer allowed.
- `main` is deployable. v1 is built on `feature/v1-game`; never rebase, merge only.
- The GitHub repo is created when the build starts, but **nothing is pushed until Jose has played it and
  says so**; when he asks for a PR, the feature branch is pushed and a PR opened, never merged locally.
- README with the live link, controls, the lesson behind each card, credits (fonts, Monty Python
  reference) and MIT licence.

# None Shall Pass — Play-test round one (v1.1) design

**Status:** approved by Jose on 2026-10-05 (the §16 defaults confirmed); implementation starts · **Date:** 2026-10-05 · **Base:** v1 on `feature/v1-game` after the final fix wave.
**Authority:** this spec amends `2026-10-04-none-shall-pass-design.md`. Where the two disagree, this one wins. Everything it does not mention stays as v1 built it.
**Source:** Jose's play-test feedback of 2026-10-05 (ten items plus follow-ups) and the mock rounds he approved (`docs/mocks/2026-10-05-round-one-mocks.html` for the screens; the art workbench for sprites and icons).

## 1. Intent

Jose's verdict after playing v1: the game works but reads like a technical write-up. This round makes it feel like a game (colour, motion, sound, identity), teaches harder (a recap after every wave, free encoding highlights, a codex of every upgrade) and fixes three feel problems (targeting on lane change, the horse, packet readability).

Success: Jose plays a full campaign on the test server and sees every item below in place, and the v1 bars still hold: every unit test and smoke check green, core coverage ≥ 80%, no packet text ever reaches `innerHTML`, memory bounded over a long Overtime run.

## 2. Scope

**In:** sections 3–15. **Out of this round:** meta-progression between runs, online scores, touch/mobile, new attack families or packets, an orchestral score, publishing (still local only).

## 3. Controls and targeting

- **How to play** lists Shift+Tab as its own row (`previous packet in the lane`), with the same `kbd` styling as the other keys. New rows: `C` charge (shown only once Destrier III exists in the Armory text; the how-to lists it as "C · charge the lane (Destrier III)"), `T` armory, `M` mute.
- **Auto-target on lane change.** When ↑/↓ moves the knight into a lane that holds a targetable packet (not dead, not doomed, not entering the fire), the front-most one (largest `x`) becomes the target at once, with the same `targeted` event and the same brackets. Tab / Shift+Tab still cycle; Esc releases; an empty lane leaves no target. Moving lanes always re-targets, even if the player had released on purpose.
- **Keys:** `C` = Destrier charge (no-op without Destrier III, no line spoken). `T` = Armory (title, pause, draft; during play it opens over a paused field). `M` = mute. All three ignore auto-repeat.

## 4. Packet cards (approved option C)

- **Geometry:** `PKT_W` 290 → 340, `PKT_H` 52 → 54, `PKT_Y` 19 → 18. Lanes, `SPAWN_GAP` (30), `FW_X` (906) and the crop at the fire are unchanged. Spawning still starts off-screen to the left with the same gap test.
- **Layout:** top row, 13 px Space Mono: a protocol **chip**, then the path or port in ink, then the source IP right-aligned in dim. Bottom row, 15 px IBM Plex Mono: the **payload only**, ellipsized.
- **Chips:** protocol only, never maliciousness. GET `#2fb6ff`, POST `#d9b44a`, SSH `#5fd38d`, SMTP `#b48cff`, TCP `#a4a197`; chip text in the paper colour, 12 px bold. Red stays reserved for the target and the hints.
- **Content:** every template gains `chip` and `payload` (derived at content time, tested): `GET /search?q=' OR 1=1--` → chip GET, path `/search`, payload `q=' OR 1=1--`; `SSH-2.0-libssh_0.9.6 root:toor` → SSH, `:22`, `libssh_0.9.6 root:toor`; `SYN → :23 telnet` → TCP, `SYN :23`, `→ telnet`; `SMTP :25 EHLO …` → SMTP, `:25`, `EHLO mail.partner.example`. The lens still swaps the payload for its decoded form.
- **Encoding highlight, always on, free:** `%XX` sequences and `+` inside a query string are drawn in `#8fdcff` with a dotted underline, on every packet, legit or not (so `blue+wool+socks` lights up too and the highlight never gives an attack away). Commas are not highlighted. No score penalty.
- **Hints** are unchanged: H, red wavy underline on the tells, ×0.75.
- **Queueing (fixes the Tarpit overtake from the final review):** a packet never moves within `SPAWN_GAP` of the packet ahead in its lane; if it would, it slows to match. So a tarpitted attacker backs the lane up behind it and no card ever hides another. Core rule, unit-tested; the view keeps "newest on top" only as a fallback.
- Inspector and event log keep their layout; the inspector title shows the chip.

## 5. Bugs that eat the frame

- A bugged packet (Observability tiers gate which, as in v1) carries one bug that laps the card's edge. Each lap it bites the frame at a random spot (a 7×5 notch in the paper colour), up to six bites, with a two-crumb particle drop; bites persist until the packet dies. The payload is never touched.
- **Motion per species:** spider laps in 7 s with two-frame legs; beetle 9 s; **worm** is a head plus eight body segments that follow it along the edge and slither ±2.5 px sideways, 16 s a lap; **fly** (a housefly: dark body, red eyes, wing blur) darts between five landing spots around and across the card, 0.3 s per dart, lands 1–2 s, twitches, then darts again; **gnat** is a smaller, faster fly that never lands for long. Flies and gnats do not bite.
- **Sprites:** spider, beetle and gnat keep their two-frame sprites; worm gets head/body/tail segment sprites; fly gets a new two-frame housefly plus a wing-blur frame.
- **Reduced effects:** at most two bites, no crumbs, flies hover in place with the blur off.

## 6. Destrier as a three-level upgrade

- The per-packet hold is removed (`HOLD_SECS`, `HOLD_MULT`, `held`, `heldOnce` go away). The mounted knight still gallops between lanes with the running animation; he no longer rides out to packets.
- **Destrier I** (LEGENDARY, 1000, the card the first draft guarantees): every packet in the knight's current lane moves at 70%.
- **Destrier II** (RARE, 600, requires I): 50%.
- **Destrier III** (LEGENDARY, 1000, requires II): adds the **charge**. Press C: the knight gallops from his post to the lane's left edge and back over 1.2 s; every attack he passes shatters (`shattered`, `by: 'charge'`, +20 rule points each, bugs included), legit packets are untouched; he cannot throw while charging. Once per wave; the Destrier tile shows CHARGE READY until used.
- The lane under a Destrier slow gets a faint tint so the effect is visible.
- Card text (does / in real life / the catch) in EN and ES for all three. The Armory and the loadout tile show the level pips.

## 7. Wave recap

- After `waveCleared` and before the draft, a **recap** screen: `WAVE N CLEARED`, the wave's numbers (points gained, breaches, false alarms), then every mistake of that wave: breaches and false positives, each with its family tag, the payload with its tells underlined (free here) and the `why` text. CONTINUE (Space / Enter) goes to the draft.
- On a clean wave the recap is skipped; the draft opens directly with a one-line "Clean wave" note.
- The core keeps a per-wave mistakes list taken from the stats, not from the capped log, so Overtime recaps are complete.
- The debrief's mistakes section reuses the same component across all waves, capped at 30 rows with "+N more".

## 8. HUD, debrief and game-over visuals

- **HUD:** SCORE in gold, CREDITS in green, REPUTATION as coloured pips (green ≥ 7, gold 4–6, red ≤ 3).
- **Debrief:** the score counts up over 0.8 s; the grade stamps down (scale 2 → 1 in 0.3 s) with a short shake; grade colours S gold, A green, B blue, C ink, D orange `#ff8a2f`, F red; stat values coloured like the HUD.
- **Game over:** behind the debrief the rack shows fully burnt and dark, the uptime strip flatlines, and the knight kneels (new one-frame `knight-foot-down`). **Win:** the knight raises the spear (`knight-foot-cheer`), the rack is clean, and 0/1 glyphs rain for two seconds.
- All of it respects reduced effects (no count-up, no stamp shake, no rain).

## 9. The Armory

- A read-only codex of every upgrade, in three columns: KNIGHT (gold), FIREWALL (blue), SERVER (ink). Each upgrade is one card: icon tile, name, a one-line `does`, and a state line — `OWNED`, `OWNED · START`, `IN THE DRAFT · price`, `LOCKED · needs X`, `ONE SHOT · price`. Levelled upgrades (Destrier, Observability) list their levels inside the card, owned levels in green, the next one in ink.
- Hover or keyboard focus fills the detail panel on the right: category · rarity · level, name, does, IN REAL LIFE, THE CATCH, state.
- Opens from the title (ARMORY), the pause menu (ARMORY) and the draft (T); during play T pauses and opens it. T or Esc closes back to where it came from. Arrow keys move the focus.
- Never affects the draft: it shows, it does not sell.

## 10. Level-up feedback

- Loadout tiles show level pips (I · II · III) under the icon for Destrier and Observability.
- When a higher level is bought, the tile flashes white for 0.6 s and a float rises from it: `OBSERVABILITY II`, `DESTRIER III`.

## 11. New-run screen: knight and difficulty

- After PLAY or OVERTIME on the title, the **setup** screen: six knights on the left, four difficulties on the right, START (Space / Enter), BACK (Esc). The last choice is remembered in prefs.
- **Knights** (sprites from the approved mocks: palette swap plus options for plume, face, braid, beard, goggles, chest and shield emblem):

  | Knight | Identity | Look |
  |---|---|---|
  | The Black Knight | the classic | steel, red plume, closed visor, cross |
  | Sentinel | blue team | open face, gold braid, blue plume, eye emblem |
  | Raider | red team | dark steel, closed visor, red chevron, sword emblem |
  | Warden | purple team | open face, copper braid, purple plume, split red/blue shield |
  | Ghost | privacy | charcoal, closed visor glowing green, green plume, cloak with clasp, platinum braid, white mask on dark green |
  | Forge | build your own | steel, goggles, red beard, leather apron, `>_` on the shield, cyan pennant |

  Each has a name, a team chip, a motto and a two-line description; the motto also appears on the debrief and in the share line. **Kits are cosmetic in this round** (see §16).
- The chosen knight's sprite set is used on the field: foot idle/throw, horse gallop frames, down and cheer, all generated from the same grids with the palette and options.
- **Difficulties** (score multiplier stacks with hints and root):

  | Difficulty | Score | Packet speed | Reputation | Tier gating | Hints |
  |---|---|---|---|---|---|
  | Intern | ×0.5 | 75% | 14 | tier 1 only until wave 4 | allowed |
  | Analyst | ×1 | 100% | 10 | as v1 | allowed |
  | Incident | ×1.5 | 125% | 8 | tricky from wave 2 | allowed |
  | Zero-day | ×2 | 150% | 5 | sneaky from wave 1 | disabled |

- **Bests** are kept per difficulty and per root/normal (campaign: score + grade with the win-beats-loss rule; Overtime: wave + score). Saved data migrates: v1's `normal`/`root` entries become Analyst. Any campaign win on any difficulty unlocks Overtime. The title shows the bests for the selected difficulty.
- The debrief and the share line name the knight and the difficulty.

## 12. Sound

- **Effects** are synthesized in the browser (Web Audio, short envelopes on oscillators and noise; no files): throw, hit, miss, swallow, breach, draft pick, level up, button, pause, wave start, charge, recap open.
- **Music:** one CC0 chiptune loop from OpenGameArt (chosen at implementation, ≤ 1 MB as OGG with an MP3 fallback, in `public/audio/`, credited in the README with its author and licence), at low volume, looping.
- **Controls:** M toggles mute (the HUD shows a small speaker glyph when muted); the pause menu gets MUSIC and SOUND toggles and a three-step volume; prefs persist; default on. Audio starts on the first key press or click, as browsers require; the title shows a small "♪" hint until then.
- A missing or blocked AudioContext never throws into the game.

## 13. Animation polish

- **Spear:** a wind-up frame 80 ms before release; on a hit, a 3 px screen snap and a 60 ms white flash before the shatter.
- **Packets:** a spawn pop (scale 0.9 → 1 in 120 ms) and a travel bob (±1 px, 1.6 s period) on the card container only; hit-testing unaffected.
- **Fire and rack:** the fire flares brighter for 200 ms when it swallows a packet; the rack throws sparks on a breach.
- **Draft:** cards flip in one by one (120 ms stagger); the bought card flies to its loadout tile in 300 ms and the tile pulses.
- **Debrief:** §8.
- **Reduced effects:** no snap, no flash, no bob, no flips (instant), no sparks.

## 14. Icons (locked set)

Flat style: no highlight edge, no shadow edge, a dark outline. The committed workbench `docs/mocks/2026-10-05-art-workbench.js` holds every grid; the plan transcribes them into `src/art/sprites.ts`.

| Card | Icon |
|---|---|
| Destrier I–III | the horse (actor-derived, unchanged) |
| Observability I–III | the eye (new) |
| Squire | the new squire (take two) |
| Decoding lens | the circular lens (new) |
| Port lockdown | the padlock, flattened |
| Quote filter | the grate, flattened |
| fail2ban | the ban sign (new) |
| Tarpit | the snail (new) |
| CDN + rate limit | the cloud, flattened |
| Prepared statements | the puzzle piece (new), in violet `#b48cff` so it never reads as the tick shield |
| Sort-column allow-list | the tick shield, flat |
| MFA + SSH keys | the key (v3) |
| Output encoding + CSP | the comment bubble with `<>` (new) |
| Restore from backup | the database with the restore arrow (new) |

## 15. Sprites

- Knight: heater shield (9×12, lit rim, dark inner border, emblem) and leaf spear with socket, pennant, wrapped shaft and butt cap, for all six knights; plus `down` and `cheer` frames; horse frames per knight palette.
- Squire take two: kettle hat, mail coif, quilted gambeson with the red cross, buckler, short spear with pennant; idle and throw.
- Worm segments, housefly frames.
- All generated from grids at startup and rendered at 2×, as in v1.

## 16. Decisions taken by default (Jose: confirm or change)

1. Knight kits are **cosmetic only** this round; the "starting edge" idea (Sentinel starts with Observability I, Ghost with the lens, …) is parked until the balance settles.
2. Destrier numbers: 70% / 50% / charge once per wave at +20 per kill.
3. Difficulty numbers as in §11.
4. Bests per difficulty; any campaign win unlocks Overtime; v1 bests migrate to Analyst.
5. The recap is skipped on a clean wave.
6. Chip colours as in §4.
7. Music is one CC0 loop; effects are synthesized.
8. Prepared-statements icon: the puzzle piece, violet (Jose's pick).

## 17. Architecture impact

- **Core (`src/core`):** `RunConfig` gains `difficulty` and `knight`; a `DIFFICULTY` table drives speed, reputation, tier gating and the hint lock; `packetSpeed` takes the lane slow; the charge is a small state machine in `knight.ts` with its own events (`chargeStarted`, `shattered by: 'charge'`, `chargeEnded`); queueing in `field.ts`; `waveMistakes` on the state, reset per wave; the hold code is deleted.
- **Content:** Destrier I/II/III cards with `req`; `chip`/`payload` on templates; recap, armory, setup, audio and how-to strings in EN and ES.
- **Game views (`src/game`):** a new card renderer; a `bugs.ts` module for crawl, bites and crumbs; effects for the snap, flash, bob, flare and sparks; actors for the six knights plus down/cheer; a lane tint for the slow.
- **UI (`src/ui`):** `recap.ts`, `armory.ts`, `setup.ts`; HUD colours; debrief count-up, stamp and backdrop states; audio toggles in the pause menu; level pips and flashes on the loadout.
- **Audio (`src/audio`):** `synth.ts` (effects), `music.ts` (the loop), and an `AudioView` that maps run events to sounds.
- **Storage:** bests schema v2 with migration; prefs gain `knight`, `difficulty`, `sound`, `music`, `volume`.
- **Smoke:** new checks for setup, recap, armory, charge, auto-target, bugs rendering, sound toggles (state only), reduced effects, Spanish fit on every new screen.

## 18. Testing

- **Unit:** lane slow by level; the charge kills only attacks in the knight's lane and only once per wave; queueing never lets a packet overtake; the difficulty table; auto-target picks the front-most packet and re-targets on every lane change; bests per difficulty and the migration; chip/payload derivation for every template; EN/ES key parity including the new runtime keys; the audio module without an AudioContext; recap data per wave; the setup screen's prefs round-trip.
- **Smoke:** every new screen renders and closes by keyboard; a charge is visible mid-gallop; bites appear on a bugged card; reduced effects strips the motion; Spanish fits.
- **Review bar:** as v1 — every task reviewed, one final whole-branch review, then Jose plays it.

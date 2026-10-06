# None Shall Pass

A cybersecurity mini-game. You are the Black Knight (or one of five other knights) guarding a server: packets stream down five lanes toward a wall of fire, and you read them, spear the attacks and let the real users through. Between waves you draft upgrades that teach real defences. Win the six-wave campaign to unlock an endless Overtime.

**Play:** https://jorius.github.io/none-shall-pass/ (desktop, keyboard)

## Controls

| Key | Action |
|---|---|
| ↑ ↓ | move between lanes (the front-most packet of the new lane becomes the target) |
| Tab | next packet in the lane |
| Shift+Tab | previous packet in the lane |
| Space | throw a spear at the target |
| Esc | let the target go |
| click | target a packet (click it again, or the empty field, to let it go) |
| H | hints (underline the tells, score ×0.75) |
| C | charge down the lane: once per wave, spears every attack in it (needs Destrier III) |
| T | the Armory: every upgrade and what you own (also from the title, the pause menu and a draft) |
| M | mute the sound and the music |
| P | pause (P or Esc resumes) |

Between runs: on the new-run screen Enter starts and Esc goes back, and on a wave recap Space or Enter goes on. In the Armory, the arrow keys and Tab move between the upgrades, and T or Esc closes it.

Do nothing and a packet reaches the server: fine for a real user, a breach for any attack your upgrades don't stop. There are a couple of secrets for the curious.

## Knights and difficulties

PLAY and OVERTIME open a screen to choose who holds the gate and how hard it is; the last choice is remembered, and the title shows the best score of that difficulty. The six knights are cosmetic (their own sprites, a motto and a line of character; the rules are the same for all of them):

| Knight | Identity |
|---|---|
| The Black Knight | the classic: the original gatekeeper, holds the line on stubbornness alone |
| Sentinel | blue team: a defender who lives in the SOC, with alerts, baselines and long night shifts |
| Raider | red team: an operator who breaks in for a living, with permission, so the real ones can't |
| Warden | purple team: stands between red and blue, and turns every attack into a lesson for the defence |
| Ghost | privacy: hardened, encrypted, anonymous; treats every connection as hostile |
| Forge | build your own: a sysadmin who compiled their own armour from source and documented every rivet |

The four difficulties change how fast the packets come, how much reputation (the real users' patience) you have, which attacks show up and what the score is worth:

| Difficulty | Score | Packet speed | Reputation | Attacks | Hints |
|---|---|---|---|---|---|
| Intern | ×0.5 | 75% | 14 | only the obvious ones until wave 4 | allowed |
| Analyst | ×1 | 100% | 10 | tricky ones as the waves bring them | allowed |
| Incident | ×1.5 | 125% | 8 | tricky ones twice as common from wave 2 | allowed |
| Zero-day | ×2 | 150% | 5 | sneaky ones from their first wave, and more of them | disabled |

The multiplier stacks with hints (×0.75) and root mode (×1.5). Best scores are kept per difficulty, and winning the campaign on any of them unlocks Overtime.

## What it teaches

Every packet carries a short explanation of what it is, and every upgrade states what it does, why it works in real life and its catch. After a wave with mistakes, a recap shows each breach and false alarm with the request, its tells underlined and the reason (the debrief lists the whole run's the same way). The Armory (T) is a codex of every upgrade, in three branches: what each does, how it works in real life, its catch, and which ones you own; it shows and never sells.

| Upgrade | Lesson |
|---|---|
| Port lockdown (you start with it) | default-deny: expose only what must be reachable from outside |
| Quote filter | a naive WAF signature: it drops O'Reilly fans and misses `%27` |
| fail2ban | banning repeat offenders works until a botnet rotates its IPs |
| Tarpit | slows suspected attackers without blocking anyone outright; you still have to act |
| CDN + rate limit | in a flood the volume is the attack; it does nothing against a single clever request |
| Prepared statements | the real fix for SQL injection, but column names in ORDER BY can't be parameters |
| Sort-column allow-list | allow-list anything that ends up as an SQL identifier |
| MFA + SSH keys only | a stolen password stops being enough; phishing proxies still beat phishable factors, passkeys close that gap |
| Output encoding + CSP | XSS is fixed on output; CSP is the seatbelt |
| Restore from backup | tested backups turn a disaster into a bad afternoon; they fix the damage, not the hole |
| Observability I–III | logs, metrics and tracing reveal progressively subtler attacks |
| Squire | signature detection handles the known-bad so people can hunt the subtle |
| Decoding lens | inspect traffic after decoding: `%27` is still a quote |
| Destrier I | throttling the path you're watching buys analysts time to read: every packet in your lane slows to 70% |
| Destrier II | heavier throttling on the traffic under investigation: 50% |
| Destrier III · charge | an incident playbook: once you know the pattern, you clear it in one sweep; once per wave, and it pays rule points |

Every IP address, network and host in the packets comes from the ranges reserved for documentation: RFC 5737 addresses, RFC 5398 AS numbers and `.example` names (RFC 2606).

## Sound

Every effect is synthesized in the browser with the Web Audio API, and the music is a built-in 16-step loop played by a small sequencer: there are no audio files, so there are no licences to carry. Nothing plays until your first key press or click (browsers start no audio before one), and the title hints at that with a ♪ until then. M mutes the sound and the music together; the pause menu switches each one on its own and steps the volume.

## Privacy

On jorius.github.io the game uses cookieless [Umami](https://umami.is) analytics. Every page load counts as a page view, which records the page path, the referrer, your browser, OS, device type, screen size and language, and a rough location (country, region and city) that Umami derives from your IP address; the address itself is not stored.

On top of the page view the game sends a few events: a run started (mode, root mode, difficulty, knight), a wave cleared (mode, wave, whether the run was tampered with), how a run ended (mode, outcome, grade or wave reached, a coarse score bucket, tampered), the console opened, root mode switched and a result copied to the clipboard. Nothing you type or read in the game is sent, and browsers with Do Not Track send nothing at all.

## Development

Node 24.15.0 (`.nvmrc`).

```bash
npm ci
npm run dev              # Vite dev server
npm run lint
npm test                 # unit tests (vitest)
npm run test:coverage    # fails under 80% coverage of src/core
npm run build
node scripts/smoke.mjs   # builds, serves dist on port 4318 and runs headless checks (needs `npx playwright install chromium-headless-shell`)
```

Architecture: `src/core` is a deterministic, Phaser-free simulation (`Run.step` returns events); `src/game` is a single Phaser 4 scene that renders the field; `src/ui` is a DOM layer for every text-heavy surface. Design: `docs/superpowers/specs/2026-10-04-none-shall-pass-design.md`.

## Credits

- The name and the knight's lines quote Monty Python and the Holy Grail; no imagery from the film is used. All pixel art is original.
- Fonts: Space Mono, IBM Plex Mono and Atkinson Hyperlegible Next (SIL Open Font License), via Fontsource.
- Sound: every effect and the music loop are synthesized in the browser with the Web Audio API; no audio files are used.
- Built with [Phaser](https://phaser.io).

## License

MIT © 2026 Jose Rios

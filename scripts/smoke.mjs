// Builds the game, serves dist with `vite preview` and runs headless checks.
// Usage: node scripts/smoke.mjs <check> [<check> ...]   (no args = every check)
// packages
import { spawn, execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createServer } from 'node:net';
import { chromium } from 'playwright';

const PORT = 4318;
const URL = `http://localhost:${PORT}/none-shall-pass/`;
const OUT = 'smoke-out';

// Steps the run inside the page until `cond(state, arg)` holds, so a check gets its log entries however slow the frame rate.
const stepUntil = async (page, cond, arg) => {
  const ok = await page.evaluate(([src, a]) => {
    const app = window.__nsp.app, test = new Function('s', 'a', `return (${src})(s, a);`);
    for (let i = 0; i < 60 * 120 && !test(app.run.state, a); i++) app.dispatch(app.run.step(1 / 60));
    return test(app.run.state, a);
  }, [cond.toString(), arg]);
  if (!ok) throw new Error(`the run never reached ${cond}`);
};

// From the title into a run, as a player gets there.
const play = async (page, mode = 'campaign') => {
  await page.waitForSelector('#ui .ov-title .btn');
  await page.click(mode === 'campaign' ? '#ui .ov-title .row-btns .btn:nth-child(1)' : '#ui .ov-title .row-btns .btn:nth-child(2)');
  await page.waitForFunction(() => window.__nsp.app.screen === 'playing');
};

// The pause key's freeze (the run, the tweens, the CSS) without its menu over the field and the panels,
// so a shot still shows them and a hover still reaches them.
const freeze = (page, on = true) => page.evaluate((p) => {
  const app = window.__nsp.app, menu = app.onScreen;
  app.onScreen = null;
  try { app.setScreen(p ? 'paused' : 'playing'); } finally { app.onScreen = menu; }
}, on);

// Nothing on the open screen spills out of it, no row of buttons breaks in two, and no label or button wraps.
const ONE_LINE = '.btn, .uhead, .uname, .draft-h, .note, .best > div, .badge-root, .statlist > div, .howto-grid > *';
const fits = async (page, what) => {
  const bad = await page.evaluate((sel) => {
    const box = document.querySelector('#ui .ov.show'), r = box.getBoundingClientRect(), k = r.width / 1280;
    const name = (e) => `${e.tagName.toLowerCase()}.${e.className} "${e.textContent.slice(0, 40)}"`;
    const out = [...box.querySelectorAll('*')].filter((e) => {
      const b = e.getBoundingClientRect();
      return !e.closest('.mistakes') && b.width > 0 && (b.left < r.left - 1 || b.right > r.right + 1 || b.top < r.top - 1 || b.bottom > r.bottom + 1);
    }).map((e) => `out: ${name(e)}`);
    const split = [...box.querySelectorAll('.row-btns, .cards')].filter((row) => new Set([...row.children].map((c) => Math.round(c.getBoundingClientRect().top))).size > 1).map((e) => `split: ${name(e)}`);
    const wrapped = [...box.querySelectorAll(sel)].filter((e) => {
      const cs = getComputedStyle(e), lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
      const inner = e.getBoundingClientRect().height / k - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - parseFloat(cs.borderTopWidth) - parseFloat(cs.borderBottomWidth);
      return inner > lh * 1.5;
    }).map((e) => `wraps: ${name(e)}`);
    return [...out, ...split, ...wrapped];
  }, ONE_LINE);
  if (bad.length) throw new Error(`${what} does not fit:\n${bad.join('\n')}`);
};

// Every upgrade card, three to a hand, in the language on screen: each hand fits the draft screen.
const everyCardFits = async (page, what) => {
  const dealt = await page.evaluate(() => {
    const run = window.__nsp.app.run, s = run.state, d = s.draft, seen = new Map();
    const saved = { owned: s.owned, credits: s.credits, picks: d.picks, taken: d.taken };
    // Observability II and III only deal once the tier below is owned.
    for (const owned of [['obs1'], ['obs2']]) {
      s.owned = owned;
      d.taken = [];
      for (let i = 0; i < 300; i++) { s.credits = 1e6; run.reroll(); d.picks.forEach((c) => seen.set(c.id, c)); }
    }
    Object.assign(s, { owned: saved.owned, credits: saved.credits });
    Object.assign(d, { picks: saved.picks, taken: saved.taken });
    window.__smokeCards = [...seen.values()];
    window.__smokeHand = saved.picks;
    return seen.size;
  });
  if (dealt !== 16) throw new Error(`dealt ${dealt} different cards, expected 16`);
  for (let i = 0; i < 16; i += 3) {
    await page.evaluate((n) => {
      const app = window.__nsp.app, d = app.run.state.draft, all = window.__smokeCards;
      d.picks = [0, 1, 2].map((j) => all[(n + j) % all.length]);
      app.refresh();
    }, i);
    await fits(page, `${what} (cards ${i + 1}-${i + 3})`);
  }
  // Back to the hand the run dealt.
  await page.evaluate(() => { const app = window.__nsp.app; app.run.state.draft.picks = window.__smokeHand; app.refresh(); });
};

const spanish = (page) => page.evaluate(() => localStorage.setItem('nsp.v1', JSON.stringify({ prefs: { lang: 'es', coached: true } })));

const CHECKS = {
  async boot(page) {
    await page.waitForSelector('#stage canvas');
    await page.waitForFunction(() => window.__nsp?.game?.isBooted === true);
    await page.screenshot({ path: `${OUT}/boot.png` });
  },
  async loop(page) {
    await play(page);
    await stepUntil(page, (s) => s.packets.length > 0);
    const before = await page.evaluate(() => window.__nsp.app.run.state.knight.lane);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => window.__nsp.app.run.state.knight);
    if (after.lane !== before - 1) throw new Error(`lane ${before} -> ${after.lane}`);
    await page.screenshot({ path: `${OUT}/loop.png` });
  },
  async packets(page) {
    await play(page);
    await stepUntil(page, (s) => s.packets.some((p) => p.x > 200 && !p.entering && !p.doomed));
    const lane = await page.evaluate(() => window.__nsp.app.run.state.packets.find((p) => p.x > 200 && !p.entering && !p.doomed).lane);
    const here = await page.evaluate(() => window.__nsp.app.run.state.knight.lane);
    for (let i = here; i > lane; i--) await page.keyboard.press('ArrowUp');
    for (let i = here; i < lane; i++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Tab');
    if (await page.evaluate(() => window.__nsp.app.run.state.locked) === null) throw new Error('Tab did not target');
    await page.screenshot({ path: `${OUT}/packets-target.png` });
    await page.keyboard.press('Space');
    await page.waitForTimeout(60);
    // Frozen so the shot catches the spear mid-arc however long the capture takes; stepping then lands it.
    await freeze(page);
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${OUT}/packets-spear.png` });
    await freeze(page, false);
    await stepUntil(page, (s) => s.log.some((e) => e.outcome === 'hit' || e.outcome === 'fp'));
    await page.screenshot({ path: `${OUT}/packets-shatter.png` });
  },
  async resizeAndClick(page) {
    const clickPacket = async () => {
      await stepUntil(page, (s) => s.packets.some((p) => p.x > 250 && p.x < 550 && !p.entering));
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
    await play(page);
    await page.setViewportSize({ width: 1100, height: 700 });
    await page.waitForTimeout(300);
    await clickPacket();
    await page.setViewportSize({ width: 1700, height: 960 });
    await page.waitForTimeout(300);
    await clickPacket();
    // Wider than 16:9, so the canvas is pillarboxed and offset horizontally.
    await page.setViewportSize({ width: 1700, height: 700 });
    await page.waitForTimeout(300);
    await clickPacket();
  },
  async overlap(page) {
    // Two cards forced to overlap in one lane: a click must land on the card drawn on top.
    await play(page);
    await stepUntil(page, (s) => s.packets.filter((p) => !p.entering && !p.doomed).length >= 2);
    const [a, b] = await page.evaluate(() => {
      const [older, newer] = window.__nsp.app.run.state.packets.filter((p) => !p.entering && !p.doomed);
      newer.lane = older.lane;
      older.x = 200;
      newer.x = 80;
      return [older.id, newer.id];
    });
    const top = async () => {
      const [ia, ib] = await page.evaluate((ids) => {
        const names = window.__nsp.game.scene.getScene('field').layers.packets.list.map((o) => o.name);
        return ids.map((id) => names.indexOf(`packet-${id}`));
      }, [a, b]);
      if (ia < 0 || ib < 0) throw new Error(`cards ${a}/${b} not on the packets layer`);
      return ia > ib ? a : b;
    };
    const clickOverlap = async () => {
      const pt = await page.evaluate(([ida, idb]) => {
        const s = window.__nsp.app.run.state;
        const pa = s.packets.find((p) => p.id === ida), pb = s.packets.find((p) => p.id === idb);
        const mid = (Math.max(pa.x, pb.x) + Math.min(pa.x, pb.x) + 290) / 2;
        const r = document.querySelector('#stage canvas').getBoundingClientRect();
        const k = r.width / 1280;
        return { x: r.left + mid * k, y: r.top + (56 + pa.lane * 90 + 19 + 26) * k };
      }, [a, b]);
      await page.mouse.click(pt.x, pt.y);
      return page.evaluate(() => window.__nsp.app.run.state.locked);
    };
    await page.waitForTimeout(100);
    if (await top() !== b) throw new Error('the newer card is not drawn on top');
    let locked = await clickOverlap();
    if (locked !== b) throw new Error(`clicked the top card ${b}, locked ${locked}`);
    await page.keyboard.press('Escape');
    // Lock the older card: it rises above the newer one, and a click on it releases it.
    await page.evaluate((id) => { const app = window.__nsp.app; app.dispatch(app.run.target(id)); }, a);
    await page.waitForTimeout(100);
    if (await top() !== a) throw new Error('the locked card is not drawn on top');
    await page.screenshot({ path: `${OUT}/overlap-locked.png` });
    locked = await clickOverlap();
    if (locked !== null) throw new Error(`clicked the locked top card ${a}, locked ${locked}`);
    await page.waitForTimeout(100);
    if (await top() !== b) throw new Error('the released card did not go back under the newer one');
  },
  async objects(page) {
    await play(page);
    await page.evaluate(() => {
      const app = window.__nsp.app;
      app.run.state.owned.push('quote', 'f2b', 'tarpit', 'cdn');
      app.dispatch([{ type: 'owned', owned: [...app.run.state.owned] }]);
    });
    await stepUntil(page, (s) => s.log.some((e) => e.ruleId === 'lockdown'));
    await page.screenshot({ path: `${OUT}/objects.png` });
  },
  async hud(page) {
    await play(page);
    await page.waitForSelector('#ui .hud .title');
    await page.waitForFunction(() => document.querySelector('#ui .bubble.show'));
    const text = await page.textContent('#ui .hud');
    if (!/NONE SHALL PASS/.test(text)) throw new Error('hud missing title');
    await page.evaluate(() => {
      const app = window.__nsp.app;
      app.dispatch([{ type: 'uptime', before: 100, after: 64 }]);
    });
    await page.waitForTimeout(120);
    // An RGBA shot means holes: Chrome once culled bands of the canvas under the UI layer's animated panels.
    const shot = await page.screenshot({ path: `${OUT}/hud.png` });
    if (shot[25] === 6) throw new Error('part of the canvas did not draw under the UI layer');
    const cur = await page.$$eval('#ui .glabel.cur', (a) => a.length);
    if (cur !== 1) throw new Error('lane highlight missing');
    // Spanish runs about 110px longer: at its widest (wave 5, hints on, five-digit score) the HUD stays on one line.
    await spanish(page);
    await page.reload({ waitUntil: 'networkidle' });
    await play(page);
    const fit = await page.evaluate(() => {
      const app = window.__nsp.app;
      Object.assign(app.run.state, { wave: 5, score: 88888, credits: 8888, hints: true });
      app.refresh();
      const hud = document.querySelector('#ui .hud'), k = hud.getBoundingClientRect().width / 1280;
      const l = hud.querySelector('.hud-l').getBoundingClientRect(), r = hud.querySelector('.hud-r').getBoundingClientRect();
      const tall = [...hud.querySelectorAll('.hud-l > *, .hud-r > *')].filter((e) => e.getBoundingClientRect().height / k > 32).length;
      return { tall, room: Math.round((r.left - l.right) / k), over: Math.round((r.right - hud.getBoundingClientRect().right) / k) };
    });
    if (fit.tall || fit.room < 8 || fit.over > 0) throw new Error(`Spanish HUD does not fit: ${JSON.stringify(fit)}`);
    await page.screenshot({ path: `${OUT}/hud-es.png` });
  },
  async panels(page) {
    // The HUD, gutter and uptime strip are opaque: a click on them must not reach the field behind them.
    await play(page);
    await stepUntil(page, (s) => s.packets.filter((p) => !p.entering && !p.doomed).length >= 2);
    const [a, lane] = await page.evaluate(() => {
      const app = window.__nsp.app;
      const [held, hidden] = app.run.state.packets.filter((p) => !p.entering && !p.doomed);
      held.x = 300;
      hidden.x = -150;
      app.dispatch(app.run.target(held.id));
      return [held.id, hidden.lane];
    });
    const clickAt = async (x, y) => {
      const pt = await page.evaluate(([lx, ly]) => {
        const r = document.querySelector('#stage canvas').getBoundingClientRect(), k = r.width / 1280;
        return { x: r.left + lx * k, y: r.top + ly * k };
      }, [x, y]);
      await page.mouse.click(pt.x, pt.y);
      return page.evaluate(() => window.__nsp.app.run.state.locked);
    };
    const spots = { 'gutter over a hidden card': [60, 56 + lane * 90 + 45], hud: [60, 28], 'uptime strip': [640, 521] };
    for (const [name, [x, y]] of Object.entries(spots)) {
      const locked = await clickAt(x, y);
      if (locked !== a) throw new Error(`a click on the ${name} changed the target from ${a} to ${locked}`);
    }
  },
  async floats(page) {
    // A float freezes with the game: paused mid-rise it stays put, and on resume it finishes and goes away.
    await play(page);
    const top = () => page.evaluate(() => {
      const f = [...document.querySelectorAll('#ui .float')].find((e) => e.textContent === '+777');
      return f ? f.getBoundingClientRect().top : null;
    });
    await page.evaluate(() => window.__nsp.app.dispatch([{ type: 'float', at: 'packet', x: 400, y: 200, kind: 'points', value: 777 }]));
    const start = await top();
    await page.waitForTimeout(300);
    await page.keyboard.press('p');
    const paused = await top();
    await page.waitForTimeout(1500);
    const later = await top();
    if (paused === null || paused === start || later !== paused) throw new Error(`paused float: ${start} -> ${paused} -> ${later}`);
    await page.keyboard.press('p');
    await page.waitForFunction(() => ![...document.querySelectorAll('#ui .float')].some((e) => e.textContent === '+777'), null, { timeout: 3000 });
  },
  async log(page) {
    // Frozen, the run only moves when this check steps it, so a busy CPU cannot time it out.
    await play(page);
    await freeze(page);
    const logLength = () => page.evaluate(() => window.__nsp.app.run.state.log.length);
    await stepUntil(page, (s) => s.log.length >= 8);
    const rows = await page.$$eval('#ui .rows .row', (a) => a.length);
    if (rows < 8) throw new Error(`only ${rows} log rows`);
    // A pointer resting on the top row keeps that row, and its verdict, while new rows arrive above it.
    await page.hover('#ui .rows .row:first-child');
    await page.waitForSelector('#ui .ins .verdict');
    const rest = await page.evaluate(() => {
      window.__smokeRow = document.querySelector('#ui .rows .row');
      return { top: window.__smokeRow.getBoundingClientRect().top, verdict: document.querySelector('#ui .ins').textContent };
    });
    await stepUntil(page, (s, n) => s.log.length > n, await logLength());
    const rested = await page.evaluate(() => ({ top: window.__smokeRow.getBoundingClientRect().top, verdict: document.querySelector('#ui .ins').textContent }));
    if (Math.abs(rested.top - rest.top) > 1 || rested.verdict !== rest.verdict) throw new Error(`a new row moved the row under the pointer: ${JSON.stringify([rest.top, rested.top])}`);
    // The verdict stays up while the pointer crosses into the inspector, and goes when it leaves the panel;
    // the list, held only for the pointer, goes back to the newest row.
    await page.hover('#ui .ins');
    if (!(await page.$('#ui .ins .verdict'))) throw new Error('the verdict went away on the way to the inspector');
    await page.hover('#stage canvas', { position: { x: 700, y: 150 } });
    await page.waitForSelector('#ui .ins .verdict', { state: 'detached' });
    if (await page.$eval('#ui .rows', (e) => e.scrollTop) !== 0) throw new Error('the log did not return to the newest row');
    // Scrolled down to an older row, a new one arriving must not push it away.
    const before = await page.evaluate(() => {
      const box = document.querySelector('#ui .rows');
      box.scrollTop = 30;
      window.__smokeRow = [...box.children].find((r) => r.getBoundingClientRect().top >= box.getBoundingClientRect().top);
      return window.__smokeRow.getBoundingClientRect().top;
    });
    await stepUntil(page, (s, n) => s.log.length > n, await logLength());
    const after = await page.evaluate(() => window.__smokeRow.getBoundingClientRect().top);
    if (Math.abs(after - before) > 1) throw new Error(`a new row moved the row being read by ${after - before}px`);
    // Wave 1's scans all hit the lockdown, so the MISTAKES view starts out empty and says so.
    if (await page.evaluate(() => window.__nsp.app.run.state.log.some((e) => e.outcome === 'breach' || e.outcome === 'fp'))) throw new Error('wave 1 already has a mistake');
    await page.click('#ui .lfilter button:nth-child(2)');
    if ((await page.textContent('#ui .log .none:not([hidden])')) !== 'No mistakes yet.') throw new Error('no empty MISTAKES line');
    await page.click('#ui .lfilter button:nth-child(1)');
    // Then make one: spear a real user.
    await stepUntil(page, (s) => s.packets.some((p) => p.t.kind === 'legit' && !p.entering && !p.doomed));
    await page.evaluate(() => {
      const app = window.__nsp.app, p = app.run.state.packets.find((q) => q.t.kind === 'legit' && !q.entering && !q.doomed);
      app.dispatch(app.run.target(p.id));
      app.dispatch(app.run.throwSpear());
    });
    await stepUntil(page, (s) => s.log.some((e) => e.outcome === 'fp'));
    // An attack's verdict, kept while the pointer goes over to the filter.
    const attack = await page.evaluate(() => Math.max(0, window.__nsp.app.run.state.log.findIndex((e) => e.packet.t.kind !== 'legit')));
    await page.hover(`#ui .rows .row:nth-child(${attack + 1})`);
    await page.click('#ui .lfilter button:nth-child(2)');
    await page.screenshot({ path: `${OUT}/log.png` });
    if (!(await page.$('#ui .ins .verdict'))) throw new Error('no verdict in the inspector');
    if (await page.$('#ui .log .none:not([hidden])')) throw new Error('the empty MISTAKES line shows next to a mistake');
    await stepUntil(page, (s, n) => s.log.length > n, await logLength());
    const filtered = await page.evaluate(() => {
      const box = document.querySelector('#ui .rows');
      const shown = [...box.children].filter((r) => r.offsetHeight > 0);
      return { on: box.classList.contains('mistakes'), shown: shown.length, ok: shown.every((r) => /\b(bad|fp)\b/.test(r.className)) };
    });
    if (!filtered.on || !filtered.shown || !filtered.ok) throw new Error(`the mistakes filter did not survive a new row: ${JSON.stringify(filtered)}`);
    const scrollable = await page.$eval('#ui .rows', (e) => getComputedStyle(e).overflowY);
    if (scrollable !== 'auto') throw new Error('log not scrollable');
    // Spanish, at its longest: a held, bugged attack with the lens on keeps the inspector at 760px and its title inside it.
    await spanish(page);
    await page.reload({ waitUntil: 'networkidle' });
    await play(page);
    // Off the field and the log, so neither a packet nor a row takes the inspector over.
    await page.hover('#ui .hud .title');
    await freeze(page);
    await stepUntil(page, (s) => s.log.length >= 3 && s.packets.some((p) => p.t.kind !== 'legit' && !p.entering));
    await page.evaluate(() => {
      const s = window.__nsp.app.run.state;
      const p = s.packets.find((q) => q.t.kind !== 'legit' && !q.entering);
      s.owned.push('obs3', 'lens');
      s.hints = true;
      s.locked = p.id;
      p.held = true;
    });
    await page.waitForTimeout(100);
    const fit = await page.evaluate(() => {
      const k = document.querySelector('#ui .bottom').getBoundingClientRect().width / 1280;
      const ins = document.querySelector('#ui .ins'), r = ins.getBoundingClientRect();
      const over = Math.max(...[...ins.querySelectorAll('.ptitle > *')].map((c) => c.getBoundingClientRect().right - (r.right - 18 * k))) / k;
      const box = document.querySelector('#ui .rows');
      const tall = [...box.children].filter((row) => row.getBoundingClientRect().height / k > 26).length;
      const head = document.querySelector('#ui .log .ptitle').getBoundingClientRect().height / k;
      return { width: Math.round(r.width / k), over: Math.round(over), tall, wide: box.scrollWidth - box.clientWidth, head: Math.round(head), tags: ins.querySelectorAll('.ptitle .hd, .ptitle .fl').length };
    });
    if (fit.width !== 760 || fit.over > 0 || fit.tall || fit.wide > 0 || fit.head > 22 || fit.tags !== 2) throw new Error(`Spanish panels do not fit: ${JSON.stringify(fit)}`);
    await page.screenshot({ path: `${OUT}/log-es.png` });
  },
  async loadout(page) {
    // The longest loadout a run can own: every card but the one-shot backup, the three observability tiers on one tile.
    await play(page);
    await freeze(page);
    const names = await page.evaluate(() => {
      const app = window.__nsp.app;
      app.run.state.owned.push('destrier', 'squire', 'lens', 'obs1', 'obs2', 'obs3', 'quote', 'f2b', 'tarpit', 'cdn', 'prepared', 'sortlist', 'mfa', 'csp');
      app.dispatch([{ type: 'owned', owned: [...app.run.state.owned] }]);
      return [...document.querySelectorAll('#ui .loadout .ltile')].map((t) => t.title);
    });
    if (names.length !== 13) throw new Error(`${names.length} tiles, expected 13`);
    await page.waitForFunction(() => [...document.querySelectorAll('#ui .loadout .ltile img')].every((i) => i.complete && i.naturalWidth > 0));
    const box = await page.evaluate(() => {
      const k = document.querySelector('#ui .bottom').getBoundingClientRect().width / 1280, top = document.querySelector('#stage canvas').getBoundingClientRect().top;
      const tiles = [...document.querySelectorAll('#ui .loadout .ltile')].map((t) => t.getBoundingClientRect());
      const strip = document.querySelector('#ui .hpstrip').getBoundingClientRect();
      const icons = [...document.querySelectorAll('#ui .loadout .ltile img')].map((i) => i.getBoundingClientRect());
      return {
        bottom: (tiles.at(-1).bottom - top) / k, strip: (strip.top - top) / k,
        left: Math.min(...tiles.map((t) => t.left)) / k, right: Math.max(...tiles.map((t) => t.right)) / k,
        // Each icon stays whole inside its tile, above the 3px category underline.
        clipped: icons.filter((i, n) => i.top < tiles[n].top || i.bottom > tiles[n].bottom - 3 * k || i.width < 1).length,
      };
    });
    const offsetX = await page.evaluate(() => document.querySelector('#stage canvas').getBoundingClientRect().left / (document.querySelector('#ui .bottom').getBoundingClientRect().width / 1280));
    box.left -= offsetX;
    box.right -= offsetX;
    if (box.bottom > box.strip - 2) throw new Error(`the last tile ends at y ${box.bottom}, the uptime strip starts at ${box.strip}`);
    if (box.left < 1070 || box.right > 1124) throw new Error(`the column spans x ${box.left}-${box.right}, into the knight's post or the rack`);
    if (box.clipped) throw new Error(`${box.clipped} tile icons are cut off`);
    await page.hover('#ui .loadout .ltile:last-child');
    const shown = await page.textContent('#ui .ins .cname');
    if (shown !== names.at(-1)) throw new Error(`hovering the last tile shows ${shown}, expected ${names.at(-1)}`);
    await page.screenshot({ path: `${OUT}/loadout.png` });
  },
  async title(page) {
    // A first visit: the title over an idle field, no run behind it, Overtime locked.
    await page.waitForSelector('#ui .ov-title .btn');
    const first = await page.evaluate(() => ({ run: window.__nsp.app.run, overtime: document.querySelector('#ui .ov-title .row-btns .btn:nth-child(2)').disabled }));
    if (first.run !== null || !first.overtime) throw new Error(`first visit: ${JSON.stringify(first)}`);
    await fits(page, 'title');
    await page.screenshot({ path: `${OUT}/title.png` });
    // After a won campaign Overtime opens and the bests show; at their longest, in Spanish too.
    await page.evaluate(() => localStorage.setItem('nsp.v1', JSON.stringify({ bests: { campaign: { normal: { score: 188420, grade: 'A' } }, overtime: { normal: { wave: 14, score: 288888 } }, won: true }, prefs: { lang: 'en', coached: true } })));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#ui .ov-title .best');
    if (await page.$eval('#ui .ov-title .row-btns .btn:nth-child(2)', (b) => b.disabled)) throw new Error('Overtime still locked after a win');
    await fits(page, 'title with bests');
    await page.click('#ui .ov-title .row-btns .btn:nth-child(4)');
    await page.waitForFunction(() => document.documentElement.lang === 'es' && /JUGAR CAMPAÑA/.test(document.querySelector('#ui .ov-title').textContent));
    await fits(page, 'Spanish title');
    // The idle field behind it follows the language too.
    const behind = await page.evaluate(() => [document.querySelector('#ui .hud .wave').textContent, document.querySelector('#ui .bubble.show')]);
    if (!/^OLEADA 1\/6 · RECONOCIMIENTO/.test(behind[0]) || behind[1]) throw new Error(`behind the Spanish title: ${behind[0]}, bubble ${!!behind[1]}`);
    await page.screenshot({ path: `${OUT}/title-es.png` });
    await page.click('#ui .ov-title .row-btns .btn:nth-child(3)');
    await page.waitForSelector('#ui .ov-howto kbd');
    await fits(page, 'Spanish how-to');
    await page.screenshot({ path: `${OUT}/howto-es.png` });
    await page.keyboard.press('Escape');
    // By keyboard: Tab stays on the title's buttons (the layer behind is inert) and Enter plays.
    await page.waitForSelector('#ui .ov-title .btn');
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.textContent);
    if (focused !== 'JUGAR CAMPAÑA') throw new Error(`Tab went to ${focused}`);
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__nsp.app.screen === 'playing');
    if (await page.evaluate(() => document.activeElement !== document.body)) throw new Error('a title button kept the focus into the run');
  },
  async draft(page) {
    await play(page);
    await page.evaluate(() => { const a = window.__nsp.app; a.dispatch(a.run.cheat('skip')); });
    await page.waitForSelector('#ui .ov-draft .ucard');
    await page.waitForFunction(() => [...document.querySelectorAll('#ui .ucard img')].every((i) => i.complete && i.naturalWidth > 0));
    await page.screenshot({ path: `${OUT}/draft.png` });
    const free = await page.$$eval('#ui .ucard .btn', (b) => b.map((x) => x.textContent));
    if (!free.some((x) => /FREE|GRATIS/.test(x))) throw new Error('no free pick');
    await everyCardFits(page, 'draft');
    await page.click('#ui .ucard:first-child .btn');
    await page.waitForFunction(() => window.__nsp.app.run.state.owned.length === 2);
    // By keyboard, with credits for more: Enter buys the last card, and the focus wraps back to the card still for sale,
    // not on to NEXT WAVE.
    await page.evaluate(() => { const a = window.__nsp.app; a.run.state.credits = 5000; a.refresh(); });
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const focusedCard = () => page.evaluate(() => {
      const f = document.activeElement, cards = [...document.querySelectorAll('#ui .ov-draft .ucard')];
      return { card: cards.indexOf(f?.closest('.ucard')), text: f?.textContent };
    });
    const third = await focusedCard();
    if (third.card !== 2 || !/^BUY/.test(third.text)) throw new Error(`Tab went to ${JSON.stringify(third)}`);
    await page.keyboard.press('Enter');
    const back = await focusedCard();
    if (back.card !== 1 || !/^BUY/.test(back.text)) throw new Error(`after buying the last card the focus went to ${JSON.stringify(back)}`);
    // A held Enter is one click: it buys this card, and its repeats neither reroll nor start the wave.
    const hand = () => page.evaluate(() => { const d = window.__nsp.app.run.state.draft; return JSON.stringify({ taken: d.taken, picks: d.picks.map((c) => c.id) }); });
    await page.keyboard.down('Enter');
    const held = await hand();
    await page.keyboard.down('Enter');
    await page.keyboard.down('Enter');
    await page.keyboard.up('Enter');
    const kept = { hand: await hand(), screen: await page.evaluate(() => window.__nsp.app.screen) };
    if (JSON.parse(held).taken.length !== 3 || kept.hand !== held || kept.screen !== 'draft') throw new Error(`a held Enter: ${JSON.stringify({ held, ...kept })}`);
    // Space on NEXT WAVE starts the wave once and throws nothing; the next Space is a spear key again, not the button.
    for (let i = 0; i < 6 && !/NEXT WAVE/.test(await page.evaluate(() => document.activeElement?.textContent)); i++) await page.keyboard.press('Tab');
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__nsp.app.screen === 'playing' && window.__nsp.app.run.state.wave === 2);
    await page.keyboard.press('Space');
    const wave2 = await page.evaluate(() => ({ wave: window.__nsp.app.run.state.wave, screen: window.__nsp.app.screen, body: document.activeElement === document.body }));
    if (wave2.wave !== 2 || wave2.screen !== 'playing' || !wave2.body) throw new Error(`after NEXT WAVE: ${JSON.stringify(wave2)}`);
    // The same hand in Spanish, every card.
    await spanish(page);
    await page.reload({ waitUntil: 'networkidle' });
    await play(page);
    await page.evaluate(() => { const a = window.__nsp.app; a.dispatch(a.run.cheat('skip')); });
    await page.waitForSelector('#ui .ov-draft .ucard');
    await everyCardFits(page, 'Spanish draft');
    await page.evaluate(() => { const a = window.__nsp.app; a.pick(0); });
    await page.waitForFunction(() => [...document.querySelectorAll('#ui .ucard img')].every((i) => i.complete && i.naturalWidth > 0));
    await page.screenshot({ path: `${OUT}/draft-es.png` });
  },
  async pause(page) {
    await play(page);
    await page.keyboard.press('p');
    await page.waitForSelector('#ui .ov-pause .btn');
    // The menu covers the field and the panels: nothing under it takes the pointer.
    const under = await page.evaluate(() => {
      const r = document.querySelector('#stage canvas').getBoundingClientRect(), k = r.width / 1280;
      return [[600, 200], [400, 620], [1098, 100]].map(([x, y]) => !!document.elementFromPoint(r.left + x * k, r.top + y * k)?.closest('.ov'));
    });
    if (under.includes(false)) throw new Error(`the field or a panel shows through the pause menu: ${under}`);
    await fits(page, 'pause');
    await page.screenshot({ path: `${OUT}/pause.png` });
    // Reduced effects switch live (the particles, the CSS glitches) and are remembered.
    await page.click('#ui .ov-pause .btn:nth-child(4)');
    const fx = await page.evaluate(() => ({
      effects: window.__nsp.effects.reduced, css: document.querySelector('#ui').classList.contains('reduced'),
      saved: JSON.parse(localStorage.getItem('nsp.v1')).prefs.reducedFx, label: document.querySelector('#ui .ov-pause .btn:nth-child(4)').textContent,
    }));
    if (!fx.effects || !fx.css || fx.saved !== true || !/· ON$/.test(fx.label)) throw new Error(`reduced effects: ${JSON.stringify(fx)}`);
    await page.click('#ui .ov-pause .btn:nth-child(3)');
    await page.waitForFunction(() => document.documentElement.lang === 'es' && /EN PAUSA/.test(document.querySelector('#ui .ov-pause').textContent));
    await fits(page, 'Spanish pause');
    await page.screenshot({ path: `${OUT}/pause-es.png` });
    // P and Esc both resume; Esc in play only lets the target go.
    await page.keyboard.press('p');
    await page.waitForFunction(() => window.__nsp.app.screen === 'playing' && !document.querySelector('#ui .ov.show'));
    await page.keyboard.press('Escape');
    await page.keyboard.press('p');
    await page.keyboard.press('Escape');
    if (await page.evaluate(() => window.__nsp.app.screen) !== 'playing') throw new Error('Esc did not resume');
    // Quit to the title: no run, the field emptied, the clock running, the HUD back to an idle run.
    await stepUntil(page, (s) => s.packets.length >= 2 && s.score > 0);
    await page.keyboard.press('p');
    await page.click('#ui .ov-pause .btn:nth-child(2)');
    await page.waitForSelector('#ui .ov-title');
    await page.waitForTimeout(150);
    const idle = await page.evaluate(() => ({
      run: window.__nsp.app.run, paused: document.querySelector('#ui').classList.contains('paused'),
      cards: window.__nsp.game.scene.getScene('field').layers.packets.list.filter((o) => /^packet-/.test(o.name)).length,
      score: document.querySelector('#ui .hud .stat b').textContent, coach: getComputedStyle(document.querySelector('#ui .coach')).display,
    }));
    if (idle.run !== null || idle.paused || idle.cards || idle.score !== '0' || idle.coach !== 'none') throw new Error(`after quitting: ${JSON.stringify(idle)}`);
    await page.screenshot({ path: `${OUT}/quit-title.png` });
  },
  async debrief(page) {
    // Without port lockdown the recon scans breach, and at 1% uptime the first breach ends the run.
    const lose = (p) => p.evaluate(() => { const a = window.__nsp.app; a.run.state.owned = []; a.run.state.uptime = 1; });
    // A last wave at its widest numbers.
    const widest = (p) => p.evaluate(() => {
      const s = window.__nsp.app.run.state;
      Object.assign(s.stats, { hits: { 1: 188, 2: 88, 3: 28 }, squireHits: 188, ruleBlocks: 188, served: 1888, decoysKept: 88, neutralized: 88, falsePositives: 18,
        breaches: { sqli: 18, xss: 14, brute: 16, scan: 12, flood: 18 } });
      Object.assign(s, { score: 188888, wave: 6 });
    });
    await play(page);
    await lose(page);
    await stepUntil(page, (s) => s.phase === 'ended');
    await page.waitForSelector('#ui .ov-debrief .grade');
    await page.screenshot({ path: `${OUT}/debrief.png` });
    const shown = await page.evaluate(() => ({
      share: document.querySelector('#ui .share').value, mistakes: document.querySelectorAll('#ui .mistake').length,
      best: JSON.parse(localStorage.getItem('nsp.v1')).bests.campaign.normal, grade: document.querySelector('#ui .grade').textContent,
    }));
    if (!shown.share.includes('jorius.github.io/none-shall-pass')) throw new Error('share text missing link');
    if (!shown.mistakes || shown.grade !== 'F' || !shown.best) throw new Error(`debrief: ${JSON.stringify(shown)}`);
    await fits(page, 'debrief');
    await widest(page);
    await page.evaluate(() => window.__nsp.app.refresh());
    await fits(page, 'debrief at its widest');
    // PLAY AGAIN: a fresh run, nothing carried over.
    await page.click('#ui .ov-debrief .row-btns .btn:nth-child(2)');
    await page.waitForFunction(() => window.__nsp.app.screen === 'playing');
    const fresh = await page.evaluate(() => ({ s: window.__nsp.app.run.state, rows: document.querySelectorAll('#ui .rows .row').length }));
    if (fresh.s.wave !== 1 || fresh.s.uptime !== 100 || fresh.s.log.length || fresh.rows || fresh.s.phase !== 'playing') throw new Error('PLAY AGAIN kept the last run');
    // A quit in the moment before the debrief opens: the next run keeps its screen (the ended run's result is already saved).
    await lose(page);
    await page.evaluate(() => {
      const app = window.__nsp.app;
      for (let i = 0; i < 60 * 120 && app.run.state.phase !== 'ended'; i++) app.dispatch(app.run.step(1 / 60));
      app.quit();
      app.startRun('campaign');
    });
    await page.waitForTimeout(1800);
    const kept = await page.evaluate(() => ({ screen: window.__nsp.app.screen, shown: !!document.querySelector('#ui .ov.show') }));
    if (kept.screen !== 'playing' || kept.shown) throw new Error(`a stale debrief: ${JSON.stringify(kept)}`);
    // In Spanish (switched from the pause menu), then back to the title.
    await page.keyboard.press('p');
    await page.click('#ui .ov-pause .btn:nth-child(3)');
    await page.keyboard.press('p');
    await stepUntil(page, (s) => s.log.length >= 3);
    await widest(page);
    await lose(page);
    await stepUntil(page, (s) => s.phase === 'ended');
    await page.waitForSelector('#ui .ov-debrief .grade');
    await fits(page, 'Spanish debrief');
    // How far the campaign got, the breaches by family and the best it had to beat.
    const es = await page.evaluate(() => ({
      reached: document.querySelector('#ui .statlist > div').textContent, fams: [...document.querySelectorAll('#ui .fams span')].map((e) => e.textContent),
      prev: [...document.querySelectorAll('#ui .ov-debrief .note')].map((e) => e.textContent).find((x) => /^Récord anterior/.test(x)),
    }));
    if (es.reached !== 'Oleada alcanzada6 / 6' || es.fams.length !== 5 || !es.fams[2].startsWith('fuerza bruta ') || !es.prev) throw new Error(`Spanish debrief: ${JSON.stringify(es)}`);
    await page.screenshot({ path: `${OUT}/debrief-es.png` });
    await page.click('#ui .ov-debrief .row-btns .btn:nth-child(3)');
    await page.waitForSelector('#ui .ov-title');
    if (await page.evaluate(() => window.__nsp.app.run) !== null) throw new Error('TITLE kept the run');
  },
  async console(page) {
    await play(page);
    await page.keyboard.press('`');
    await page.waitForSelector('#ui .term.show input');
    await page.waitForFunction(() => document.activeElement?.tagName === 'INPUT');
    await page.keyboard.type('help');
    await page.keyboard.press('Enter');
    // Typed into the prompt, the game's own keys do nothing.
    await page.keyboard.type('h p');
    const typed = await page.evaluate(() => ({ hints: window.__nsp.app.run.state.hints, screen: window.__nsp.app.screen }));
    if (typed.hints || typed.screen !== 'console') throw new Error(`typing in the console reached the game: ${JSON.stringify(typed)}`);
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('nmap shop.example');
    await page.keyboard.press('Enter');
    const out = await page.textContent('#ui .term pre');
    if (!/filtered/.test(out) || !/man <attack>|man <ataque>/.test(out)) throw new Error(out);
    await page.screenshot({ path: `${OUT}/console.png` });
    await page.keyboard.press('Escape');
    if (await page.evaluate(() => window.__nsp.app.screen) !== 'playing') throw new Error('console did not close');
    // Closed, it lets the focus go: the arrows steer the knight again.
    const lane = await page.evaluate(() => (document.activeElement === document.body ? window.__nsp.app.run.state.knight.lane : -1));
    if (lane < 0) throw new Error('the closed console kept the focus');
    await page.keyboard.press(lane > 0 ? 'ArrowUp' : 'ArrowDown');
    await page.waitForFunction((l) => window.__nsp.app.run.state.knight.lane !== l, lane);
    await page.keyboard.press('`');
    await page.waitForSelector('#ui .term.show input');
    await page.waitForFunction(() => document.activeElement?.tagName === 'INPUT');
    await page.keyboard.type('skip');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__nsp.app.screen === 'draft' && window.__nsp.app.run.state.tampered);
  },
  async konami(page) {
    const code = async () => { for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']) await page.keyboard.press(k); };
    const look = () => page.evaluate(() => ({
      body: document.body.classList.contains('root'), ui: document.querySelector('#ui').classList.contains('root'),
      filters: window.__nsp.game.scene.getScene('field').cameras.main.filters.internal.list.length,
      badge: getComputedStyle(document.querySelector('#ui .hud .badge-root')).display, hints: getComputedStyle(document.querySelector('#ui .hud .toggle')).display,
    }));
    await page.waitForSelector('#ui .ov-title .btn');
    await code();
    await page.waitForSelector('#ui .ov-title .badge-root');
    await fits(page, 'root title');
    await play(page);
    await stepUntil(page, (s) => s.packets.filter((p) => !p.entering).length >= 3);
    // Any refresh (a language switch, the hints key) applies the mode again without stacking a second filter.
    await page.evaluate(() => { window.__nsp.app.refresh(); window.__nsp.app.refresh(); });
    await page.waitForTimeout(150);
    await page.screenshot({ path: `${OUT}/root.png` });
    const on = { ...(await look()), run: await page.evaluate(() => window.__nsp.app.run.state.cfg.root) };
    if (!on.body || !on.ui || on.filters !== 1 || on.badge === 'none' || on.hints !== 'none' || !on.run) throw new Error(`root mode: ${JSON.stringify(on)}`);
    // Back on the title, still root; the code again switches everything back.
    await page.keyboard.press('p');
    await page.click('#ui .ov-pause .btn:nth-child(2)');
    await page.waitForSelector('#ui .ov-title .badge-root');
    await code();
    await page.waitForSelector('#ui .ov-title .badge-root', { state: 'detached' });
    const off = await look();
    if (off.body || off.ui || off.filters !== 0 || off.badge !== 'none' || off.hints === 'none') throw new Error(`root mode left on: ${JSON.stringify(off)}`);
  },
  async phone(page) {
    // A real phone: a small touch screen with no fine pointer gets the card, and the game never boots.
    const browser = page.context().browser();
    const device = async (opts) => {
      const ctx = await browser.newContext(opts), p = await ctx.newPage(), errors = [];
      p.on('pageerror', (e) => errors.push(e.stack ?? e.message));
      p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await p.goto(URL, { waitUntil: 'networkidle' });
      return { ctx, p, errors };
    };
    const gated = async (name, opts, shot) => {
      const { ctx, p, errors } = await device(opts);
      try {
        await p.waitForSelector('.gate h2');
        if (shot) await p.screenshot({ path: `${OUT}/${shot}` });
        if (await p.$('#stage canvas')) throw new Error(`the game booted on ${name}`);
        const fit = await p.evaluate(() => { const g = document.querySelector('.gate'); return g.scrollHeight <= g.clientHeight && g.scrollWidth <= g.clientWidth; });
        if (!fit) throw new Error(`the card overflows on ${name}`);
        if (errors.length) throw new Error(errors.join('\n'));
      } finally { await ctx.close(); }
    };
    const touch = { isMobile: true, hasTouch: true, deviceScaleFactor: 3 };
    await gated('a phone', { ...touch, viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 } }, 'phone.png');
    await gated('a phone on its side', { ...touch, viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 } });
    await gated('a touch-only tablet', { ...touch, deviceScaleFactor: 2, viewport: { width: 1366, height: 1024 }, screen: { width: 1366, height: 1024 } });
    // A desktop window snapped narrow still plays: it has a keyboard, and the stage scales down.
    const { ctx, p, errors } = await device({ viewport: { width: 640, height: 720 }, screen: { width: 1920, height: 1080 } });
    try {
      await p.waitForSelector('#ui .ov-title .btn');
      if (await p.$('.gate')) throw new Error('a narrow desktop window got the phone card');
      if (errors.length) throw new Error(errors.join('\n'));
    } finally { await ctx.close(); }
  },
};

// Whatever already listens on the port is not this build: smoke would test a stale server and report on it.
const portFree = () => new Promise((resolve) => {
  const probe = createServer();
  probe.once('error', () => resolve(false));
  probe.once('listening', () => probe.close(() => resolve(true)));
  probe.listen(PORT);
});

// The MEDIA drive can stall vite for a long while, so allow a minute; a server that dies meanwhile fails at once.
const waitForServer = async (server, stderr) => {
  for (let i = 0; i < 240; i++) {
    if (server.exitCode !== null || server.signalCode !== null) {
      throw new Error(`preview server exited (${server.exitCode ?? server.signalCode}) before it was ready\n${stderr()}`);
    }
    try { if ((await fetch(URL)).ok) return; } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('preview server did not start within 60 s');
};

const main = async () => {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(CHECKS);
  if (!(await portFree())) throw new Error(`port ${PORT} is already in use: stop the server on it and run smoke again`);
  mkdirSync(OUT, { recursive: true });
  execSync('npm run build', { stdio: 'inherit' });
  // Run vite's bin through node directly: killing an `npx` wrapper would leave the server orphaned on the port.
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  server.stderr.on('data', (d) => { stderr += d; });
  let failed = 0;
  try {
    await waitForServer(server, () => stderr);
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

main().catch((e) => {
  console.error(`SMOKE ABORTED: ${e.message}`);
  process.exit(1);
});

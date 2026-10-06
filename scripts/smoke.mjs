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

const CHECKS = {
  async boot(page) {
    await page.waitForSelector('#stage canvas');
    await page.waitForFunction(() => window.__nsp?.game?.isBooted === true);
    await page.screenshot({ path: `${OUT}/boot.png` });
  },
  async loop(page) {
    await page.waitForFunction(() => window.__nsp?.app?.run?.state?.packets?.length > 0, null, { timeout: 15000 });
    const before = await page.evaluate(() => window.__nsp.app.run.state.knight.lane);
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(400);
    const after = await page.evaluate(() => window.__nsp.app.run.state.knight);
    if (after.lane !== before - 1) throw new Error(`lane ${before} -> ${after.lane}`);
    await page.screenshot({ path: `${OUT}/loop.png` });
  },
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
    await page.waitForTimeout(60);
    // Pause so the shot catches the spear mid-arc however long the capture takes; resuming lets it land.
    await page.keyboard.press('p');
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${OUT}/packets-spear.png` });
    await page.keyboard.press('p');
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
    // Wider than 16:9, so the canvas is pillarboxed and offset horizontally.
    await page.setViewportSize({ width: 1700, height: 700 });
    await page.waitForTimeout(300);
    await clickPacket();
  },
  async overlap(page) {
    // Two cards forced to overlap in one lane: a click must land on the card drawn on top.
    await page.waitForFunction(() => window.__nsp?.app?.run?.state?.packets?.filter((p) => !p.entering && !p.doomed).length >= 2, null, { timeout: 20000 });
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
    await page.waitForFunction(() => !!window.__nsp?.app?.run);
    await page.evaluate(() => {
      const app = window.__nsp.app;
      app.run.state.owned.push('quote', 'f2b', 'tarpit', 'cdn');
      app.dispatch([{ type: 'owned', owned: [...app.run.state.owned] }]);
    });
    await page.waitForFunction(() => window.__nsp.app.run.state.log.some((e) => e.ruleId === 'lockdown'), null, { timeout: 30000 });
    await page.screenshot({ path: `${OUT}/objects.png` });
  },
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
    // An RGBA shot means holes: Chrome once culled bands of the canvas under the UI layer's animated panels.
    const shot = await page.screenshot({ path: `${OUT}/hud.png` });
    if (shot[25] === 6) throw new Error('part of the canvas did not draw under the UI layer');
    const cur = await page.$$eval('#ui .glabel.cur', (a) => a.length);
    if (cur !== 1) throw new Error('lane highlight missing');
    // Spanish runs about 110px longer: at its widest (wave 5, hints on, five-digit score) the HUD stays on one line.
    await page.evaluate(() => localStorage.setItem('nsp.v1', JSON.stringify({ prefs: { lang: 'es', coached: true } })));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__nsp?.app?.run);
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
    await page.waitForFunction(() => window.__nsp?.app?.run?.state?.packets?.filter((p) => !p.entering && !p.doomed).length >= 2, null, { timeout: 20000 });
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
    await page.waitForFunction(() => window.__nsp?.app?.screen === 'playing');
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
    const grown = async (n) => page.waitForFunction((k) => window.__nsp.app.run.state.log.length > k, n, { timeout: 20000 });
    const logLength = () => page.evaluate(() => window.__nsp.app.run.state.log.length);
    await page.waitForFunction(() => window.__nsp.app.run.state.log.length >= 8, null, { timeout: 40000 });
    const rows = await page.$$eval('#ui .rows .row', (a) => a.length);
    if (rows < 8) throw new Error(`only ${rows} log rows`);
    await page.hover('#ui .rows .row:first-child');
    await page.waitForSelector('#ui .ins .verdict');
    // The verdict stays up while the pointer crosses into the inspector, and goes when it leaves the panel.
    await page.hover('#ui .ins');
    if (!(await page.$('#ui .ins .verdict'))) throw new Error('the verdict went away on the way to the inspector');
    await page.hover('#stage canvas', { position: { x: 700, y: 150 } });
    await page.waitForSelector('#ui .ins .verdict', { state: 'detached' });
    // Scrolled down to an older row, a new one arriving must not push it away.
    const before = await page.evaluate(() => {
      const box = document.querySelector('#ui .rows');
      box.scrollTop = 30;
      window.__smokeRow = [...box.children].find((r) => r.getBoundingClientRect().top >= box.getBoundingClientRect().top);
      return window.__smokeRow.getBoundingClientRect().top;
    });
    await grown(await logLength());
    const after = await page.evaluate(() => window.__smokeRow.getBoundingClientRect().top);
    if (Math.abs(after - before) > 1) throw new Error(`a new row moved the row being read by ${after - before}px`);
    // Wave 1's scans all hit the lockdown, so make one mistake for the MISTAKES view to show: spear a real user.
    await page.waitForFunction(() => window.__nsp.app.run.state.packets.some((p) => p.t.kind === 'legit' && !p.entering && !p.doomed), null, { timeout: 20000 });
    await page.evaluate(() => {
      const app = window.__nsp.app, p = app.run.state.packets.find((q) => q.t.kind === 'legit' && !q.entering && !q.doomed);
      app.dispatch(app.run.target(p.id));
      app.dispatch(app.run.throwSpear());
    });
    await page.waitForFunction(() => window.__nsp.app.run.state.log.some((e) => e.outcome === 'fp'), null, { timeout: 5000 });
    // Paused, so no new row shifts the list: an attack's verdict, kept while the pointer goes over to the filter.
    await page.keyboard.press('p');
    const attack = await page.evaluate(() => Math.max(0, window.__nsp.app.run.state.log.findIndex((e) => e.packet.t.kind !== 'legit')));
    await page.hover(`#ui .rows .row:nth-child(${attack + 1})`);
    await page.click('#ui .lfilter button:nth-child(2)');
    await page.screenshot({ path: `${OUT}/log.png` });
    if (!(await page.$('#ui .ins .verdict'))) throw new Error('no verdict in the inspector');
    await page.keyboard.press('p');
    await grown(await logLength());
    const filtered = await page.evaluate(() => {
      const box = document.querySelector('#ui .rows');
      const shown = [...box.children].filter((r) => r.offsetHeight > 0);
      return { on: box.classList.contains('mistakes'), shown: shown.length, ok: shown.every((r) => /\b(bad|fp)\b/.test(r.className)) };
    });
    if (!filtered.on || !filtered.shown || !filtered.ok) throw new Error(`the mistakes filter did not survive a new row: ${JSON.stringify(filtered)}`);
    const scrollable = await page.$eval('#ui .rows', (e) => getComputedStyle(e).overflowY);
    if (scrollable !== 'auto') throw new Error('log not scrollable');
    // Spanish, at its longest: a held, bugged attack with the lens on keeps the inspector at 760px and its title inside it.
    await page.evaluate(() => localStorage.setItem('nsp.v1', JSON.stringify({ prefs: { lang: 'es', coached: true } })));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.__nsp?.app?.run?.state?.log?.length >= 3, null, { timeout: 40000 });
    await page.waitForFunction(() => window.__nsp.app.run.state.packets.some((p) => p.t.kind !== 'legit' && !p.entering), null, { timeout: 20000 });
    // Off the field and the log, so neither a packet nor a row takes the inspector over.
    await page.hover('#ui .hud .title');
    await page.keyboard.press('p');
    await page.evaluate(() => {
      const app = window.__nsp.app, s = app.run.state;
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

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
  // Run vite's bin through node directly: killing an `npx` wrapper would leave the server orphaned on the port.
  const server = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
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

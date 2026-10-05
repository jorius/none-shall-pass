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

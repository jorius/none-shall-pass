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
// A packet card's size, its offset in the lane and the lane gutter's edge, as src/core/constants.ts has them: the page does not expose them.
const PKT_W = 340, PKT_H = 54, PKT_Y = 18, LANE_X0 = 110;

// Steps the run inside the page until `cond(state, arg)` holds, so a check gets its log entries however slow the frame rate.
const stepUntil = async (page, cond, arg) => {
  const ok = await page.evaluate(([src, a]) => {
    const app = window.__nsp.app, test = new Function('s', 'a', `return (${src})(s, a);`);
    for (let i = 0; i < 60 * 120 && !test(app.run.state, a); i++) app.dispatch(app.run.step(1 / 60));
    return test(app.run.state, a);
  }, [cond.toString(), arg]);
  if (!ok) throw new Error(`the run never reached ${cond}`);
};

// From the title into a run, as a player gets there: PLAY or OVERTIME, then START on the setup screen as it stands.
const play = async (page, mode = 'campaign') => {
  await page.waitForSelector('#ui .ov-title .btn');
  await page.click(mode === 'campaign' ? '#ui .ov-title .row-btns .btn:nth-child(1)' : '#ui .ov-title .row-btns .btn:nth-child(2)');
  await page.waitForSelector('#ui .ov-setup .foot .btn');
  await page.click('#ui .ov-setup .foot .btn:first-child');
  await page.waitForFunction(() => window.__nsp.app.screen === 'playing');
};

// After a skip: a clean wave opens its draft at once, a wave with mistakes shows their recap first and Space goes on.
// Returns whether the wave was clean.
const toDraft = async (page) => {
  await page.waitForFunction(() => window.__nsp.app.screen === 'recap' || window.__nsp.app.screen === 'draft');
  const at = await page.evaluate(() => ({ screen: window.__nsp.app.screen, mistakes: window.__nsp.app.run.state.waveMistakes.length }));
  if ((at.screen === 'recap') !== at.mistakes > 0) throw new Error(`after the wave: ${JSON.stringify(at)}`);
  if (at.screen === 'recap') {
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__nsp.app.screen === 'draft');
  }
  return at.mistakes === 0;
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

// Every page runs with the Umami script blocked: smoke stays off the network, and each check proves the game
// plays without its tracker. The blocked request's console error is the one expected error.
const blockTracker = (target) => target.route('https://cloud.umami.is/**', (r) => r.abort());
const unexpected = (m) => m.type() === 'error' && !m.location().url.startsWith('https://cloud.umami.is/');

const spanish = (page) => page.evaluate(() => localStorage.setItem('nsp.v1', JSON.stringify({ prefs: { lang: 'es', coached: true } })));

// The reduced-effects switch as the pause menu throws it (the `reduced` check drives the menu itself): the views read the scene's flag, the CSS the layer's class.
const setReduced = (page, on) => page.evaluate((v) => { window.__nsp.effects.reduced = v; document.querySelector('#ui').classList.toggle('reduced', v); }, on);

// What the debrief does from the moment it opens: each score its box shows, and each class the screen takes on (the thud is one).
const watchDebrief = (page) => page.evaluate(() => {
  window.__smokeWatch?.disconnect();
  const box = document.querySelector('#ui .ov'), seen = { scores: [], classes: [] };
  window.__smokeDebrief = seen;
  window.__smokeWatch = new MutationObserver(() => {
    if (!box.classList.contains('ov-debrief')) return;
    const score = box.querySelector('.best b')?.textContent;
    if (score && seen.scores.at(-1) !== score) seen.scores.push(score);
    if (seen.classes.at(-1) !== box.className) seen.classes.push(box.className);
  });
  window.__smokeWatch.observe(box, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class'] });
});

// Sets a campaign up to be lost with `score` on it: no lockdown and 1% uptime, so the first scan to land breaches and ends it.
const sink = (page, score) => page.evaluate((n) => { const a = window.__nsp.app; a.run.state.owned = []; a.run.state.uptime = 1; a.run.state.score = n; }, score);

const CHECKS = {
  async boot(page) {
    await page.waitForSelector('#stage canvas');
    await page.waitForFunction(() => window.__nsp?.game?.isBooted === true);
    // The link-preview tags ship in the built page (no og:image yet: there is no PNG to point at).
    const og = await page.$$eval('meta[property^="og:"], meta[name="twitter:card"]', (m) => Object.fromEntries(m.map((e) => [e.getAttribute('property') ?? e.getAttribute('name'), e.content])));
    const want = { 'og:title': 'None Shall Pass', 'og:type': 'website', 'og:url': 'https://jorius.github.io/none-shall-pass/', 'og:locale': 'en_US', 'twitter:card': 'summary' };
    for (const [k, v] of Object.entries(want)) if (og[k] !== v) throw new Error(`${k} is ${JSON.stringify(og[k])}, expected ${v}`);
    if (!og['og:description']) throw new Error('no og:description');
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
    // Stepped to the landing and frozen in one go: the hit's white flash lives 60 ms, which no frame may run out before the shot.
    const landed = await page.evaluate(() => {
      const app = window.__nsp.app, menu = app.onScreen, hit = () => app.run.state.log.some((e) => e.outcome === 'hit' || e.outcome === 'fp');
      for (let i = 0; i < 60 * 120 && !hit(); i++) app.dispatch(app.run.step(1 / 60));
      app.onScreen = null;
      try { app.setScreen('paused'); } finally { app.onScreen = menu; }
      return hit();
    });
    if (!landed) throw new Error('the spear never landed');
    await page.screenshot({ path: `${OUT}/packets-shatter.png` });
    await freeze(page, false);
  },
  async resizeAndClick(page) {
    const clickPacket = async () => {
      await stepUntil(page, (s) => s.packets.some((p) => p.x > 250 && p.x < 550 && !p.entering));
      const target = await page.evaluate(([w, h, y0]) => {
        const s = window.__nsp.app.run.state;
        const p = s.packets.find((q) => q.x > 250 && q.x < 550 && !q.entering);
        const r = document.querySelector('#stage canvas').getBoundingClientRect();
        const k = r.width / 1280;
        return { id: p.id, x: r.left + (p.x + w / 2) * k, y: r.top + (56 + p.lane * 90 + y0 + h / 2) * k };
      }, [PKT_W, PKT_H, PKT_Y]);
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
      const pt = await page.evaluate(([ida, idb, w, h, y0]) => {
        const s = window.__nsp.app.run.state;
        const pa = s.packets.find((p) => p.id === ida), pb = s.packets.find((p) => p.id === idb);
        const mid = (Math.max(pa.x, pb.x) + Math.min(pa.x, pb.x) + w) / 2;
        const r = document.querySelector('#stage canvas').getBoundingClientRect();
        const k = r.width / 1280;
        return { x: r.left + mid * k, y: r.top + (56 + pa.lane * 90 + y0 + h / 2) * k };
      }, [a, b, PKT_W, PKT_H, PKT_Y]);
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
  async bugs(page) {
    // A bugged card carries one bug on its edge. The crawlers bite the frame once a lap and the bites stay until the card dies;
    // the flies never bite. Wave 3 brings the spiders, the quickest biters: nine seconds of rig time guarantee a notch.
    await play(page);
    for (let i = 0; i < 2; i++) {
      await page.evaluate(() => { const a = window.__nsp.app; a.dispatch(a.run.cheat('skip')); });
      await page.waitForFunction(() => window.__nsp.app.screen === 'draft');
      await page.evaluate(() => window.__nsp.app.nextWave());
      await page.waitForFunction(() => window.__nsp.app.screen === 'playing');
    }
    await page.evaluate(() => { const app = window.__nsp.app; app.run.state.owned.push('obs3'); app.dispatch([{ type: 'owned', owned: [...app.run.state.owned] }]); });
    await stepUntil(page, (s) => s.wave === 3 && s.packets.some((p) => p.t.kind === 'sqli' && p.x > 200 && p.x < 500 && !p.entering && !p.doomed));
    const id = await page.evaluate(() => window.__nsp.app.run.state.packets.find((p) => p.t.kind === 'sqli' && p.x > 200 && p.x < 500 && !p.entering && !p.doomed).id);
    const rigs = () => page.evaluate(() => window.__nsp.packets.debugRigs());
    const bugAt = (name) => page.evaluate((n) => { const s = window.__nsp.game.scene.getScene('field').layers.packets.list.find((o) => o.name === n).list.at(-1); return [s.x, s.y]; }, name);
    // Frozen, the card stays put while its rig runs ahead on the debug clock; the crumbs are counted at the effects call.
    await freeze(page);
    const before = await rigs();
    if (before.find((r) => r.id === id)?.kind !== 'spider') throw new Error(`packet ${id} has no spider: ${JSON.stringify(before)}`);
    await page.evaluate(() => { const fx = window.__nsp.effects, real = fx.crumbs.bind(fx); window.__smokeCrumbs = 0; fx.crumbs = (x, y, n) => { window.__smokeCrumbs += n; real(x, y, n); }; });
    await page.evaluate(() => window.__nsp.packets.debugTick(9));
    const after = await rigs(), crumbs = await page.evaluate(() => window.__smokeCrumbs);
    const spider = after.find((r) => r.id === id);
    const newBites = after.reduce((n, r) => n + r.bites - (before.find((b) => b.id === r.id)?.bites ?? 0), 0);
    if (!spider || spider.bites < 1 || spider.bites > 2) throw new Error(`the spider on ${id} took ${spider?.bites} bites in 9 s`);
    if (crumbs !== 2 * newBites) throw new Error(`${newBites} bites dropped ${crumbs} crumbs`);
    if (after.some((r) => (r.kind === 'fly' || r.kind === 'gnat') && r.bites)) throw new Error('a fly bit the frame');
    // The bites sit in the card's box between the card and the bug, and the pause holds the bug where it is.
    const stack = await page.evaluate((n) => {
      const b = window.__nsp.game.scene.getScene('field').layers.packets.list.find((o) => o.name === n);
      return { n: b.list.length, first: b.list[0].texture.key, last: b.list.at(-1).texture.key };
    }, `packet-${id}`);
    if (stack.n !== 2 + spider.bites || !stack.first.startsWith('card-') || !stack.last.startsWith('bug-spider')) throw new Error(`the spider's box: ${JSON.stringify(stack)}`);
    const held = await bugAt(`packet-${id}`);
    await page.waitForTimeout(300);
    if (JSON.stringify(await bugAt(`packet-${id}`)) !== JSON.stringify(held)) throw new Error('the pause did not freeze the bug');
    await page.screenshot({ path: `${OUT}/bugs.png` });
    // Reduced effects: at most two bites a card and no crumbs however long the bug stays, and a fly sits still on its spot.
    await page.evaluate(() => { window.__nsp.effects.reduced = true; window.__smokeCrumbs = 0; window.__nsp.packets.debugTick(30); });
    const less = await rigs(), none = await page.evaluate(() => window.__smokeCrumbs);
    if (less.find((r) => r.id === id).bites !== 2 || less.some((r) => r.bites > 2) || none) throw new Error(`reduced effects: ${JSON.stringify({ rigs: less, crumbs: none })}`);
    const fly = less.find((r) => r.kind === 'fly' || r.kind === 'gnat');
    if (fly) {
      const sat = await bugAt(`packet-${fly.id}`);
      await page.evaluate(() => window.__nsp.packets.debugTick(1));
      if (JSON.stringify(await bugAt(`packet-${fly.id}`)) !== JSON.stringify(sat)) throw new Error('a fly moved with reduced effects on');
    }
    // Full effects again: the bites resume to the cap of six, each at its own spot, two crumbs apiece.
    await page.evaluate(() => { window.__nsp.effects.reduced = false; window.__smokeCrumbs = 0; window.__nsp.packets.debugTick(40); });
    const all = await rigs(), capped = all.find((r) => r.id === id), more = await page.evaluate(() => window.__smokeCrumbs);
    const resumed = all.reduce((n, r) => n + r.bites - (less.find((b) => b.id === r.id)?.bites ?? 0), 0);
    const spots = await page.evaluate((n) => {
      const b = window.__nsp.game.scene.getScene('field').layers.packets.list.find((o) => o.name === n);
      return b.list.slice(1, -1).map((m) => `${m.x.toFixed(1)},${m.y.toFixed(1)}`);
    }, `packet-${id}`);
    if (capped.bites !== 6 || more !== 2 * resumed || spots.length !== 6 || new Set(spots).size < 3) throw new Error(`at the cap: ${JSON.stringify({ capped, resumed, crumbs: more, spots })}`);
    // The bug and its bites go with the card: once it is consumed, its rig is gone and every part of it is destroyed.
    await page.evaluate((n) => {
      window.__smokeBox = window.__nsp.game.scene.getScene('field').layers.packets.list.find((o) => o.name === n);
      window.__smokeParts = window.__smokeBox.list.slice(1);
    }, `packet-${id}`);
    await freeze(page, false);
    await stepUntil(page, (s, pid) => !s.packets.some((p) => p.id === pid), id);
    const gone = await page.evaluate((pid) => ({
      rig: window.__nsp.packets.debugRigs().some((r) => r.id === pid), box: window.__smokeBox.active || !!window.__smokeBox.scene,
      parts: window.__smokeParts.length, live: window.__smokeParts.filter((o) => o.active || o.scene).length,
    }), id);
    if (gone.rig || gone.box || gone.parts !== 7 || gone.live) throw new Error(`after the card died: ${JSON.stringify(gone)}`);
  },
  async charge(page) {
    // Destrier III: C gallops the knight down his lane and back, spearing every attack in it, with dust at the hooves
    // and the lane's slow washed gold under him. Every knight has his seven poses as textures.
    await play(page);
    const missing = await page.evaluate(() => {
      const tex = window.__nsp.game.scene.getScene('field').textures, out = [];
      for (const id of ['black', 'sentinel', 'raider', 'warden', 'ghost', 'forge']) {
        for (const pose of ['foot-idle', 'foot-throw', 'horse-0', 'horse-1', 'horse-throw', 'down', 'cheer']) if (!tex.exists(`knight-${id}-${pose}`)) out.push(`knight-${id}-${pose}`);
      }
      return out;
    });
    if (missing.length) throw new Error(`knight textures missing: ${missing.join(', ')}`);
    await page.evaluate(() => {
      const app = window.__nsp.app;
      app.run.state.owned.push('destrier', 'destrier2', 'destrier3');
      app.dispatch([{ type: 'owned', owned: [...app.run.state.owned] }]);
      // The dust goes through the crumb emitter; count what the gallop asks for (wave 1 has no biters, so nothing else does).
      const fx = window.__nsp.effects, real = fx.crumbs.bind(fx);
      window.__smokeDust = 0;
      fx.crumbs = (x, y, n) => { if (n > 0) window.__smokeDust++; real(x, y, n); };
      document.querySelectorAll('#ui .float').forEach((f) => { f.dataset.old = '1'; });
    });
    // Wave 1's only attacks are the scans, all on the ports lane: the knight goes down to it first, as a player would.
    const attack = (s) => s.packets.find((p) => p.t.kind !== 'legit' && p.x > 300 && p.x < 600 && !p.entering && !p.doomed);
    await stepUntil(page, (s, find) => !!new Function('s', `return (${find})(s);`)(s), attack.toString());
    const [lane, here] = await page.evaluate((find) => { const s = window.__nsp.app.run.state; return [new Function('s', `return (${find})(s);`)(s).lane, s.knight.lane]; }, attack.toString());
    for (let i = here; i > lane; i--) await page.keyboard.press('ArrowUp');
    for (let i = here; i < lane; i++) await page.keyboard.press('ArrowDown');
    await page.keyboard.press('c');
    const started = await page.evaluate(() => window.__nsp.app.run.state.knight.charge.t);
    if (!(started > 0)) throw new Error(`C did not start the charge (charge.t ${started})`);
    // Frozen on the way out, so the shot catches the gallop mid-lane however long the capture takes.
    await stepUntil(page, (s) => s.knight.charge.t > 0 && s.knight.x < 700);
    await freeze(page);
    const mid = await page.evaluate(() => {
      const s = window.__nsp.app.run.state, scene = window.__nsp.game.scene.getScene('field');
      const knight = scene.layers.actors.list.find((o) => o.texture && /^knight-/.test(o.texture.key));
      const tint = scene.layers.back.list.find((o) => o.fillColor === 0xd9b44a);
      return { t: s.knight.charge.t, x: s.knight.x, lane: s.knight.lane, key: knight.texture.key, tint: tint && { y: tint.y, alpha: tint.alpha, visible: tint.visible } };
    });
    if (!(mid.t > 0) || mid.x >= 700 || !/^knight-black-horse-[01]$/.test(mid.key)) throw new Error(`mid-gallop: ${JSON.stringify(mid)}`);
    if (!mid.tint || !mid.tint.visible || mid.tint.y !== mid.lane * 90 || Math.abs(mid.tint.alpha - 0.1) > 1e-6) throw new Error(`the lane tint: ${JSON.stringify(mid)}`);
    await page.waitForTimeout(100);
    await page.screenshot({ path: `${OUT}/charge.png` });
    await freeze(page, false);
    // The dust rides the view clock, which only frames advance (stepping the run in-page skips them, and a slow headless frame
    // rate advances it 50 ms a frame at most): 24 frames through the scene's own hook are 400 ms of gallop, a puff every 80 ms.
    await page.evaluate(() => { const scene = window.__nsp.game.scene.getScene('field'); for (let i = 0; i < 24; i++) scene.onFrame(1000 / 60); });
    await stepUntil(page, (s) => s.knight.charge.t === 0);
    const after = await page.evaluate(() => ({
      hits: window.__nsp.app.run.state.stats.chargeHits, x: window.__nsp.app.run.state.knight.x, dust: window.__smokeDust,
      floats: [...document.querySelectorAll('#ui .float:not([data-old])')].map((f) => f.textContent),
    }));
    if (after.hits < 1 || after.x !== 944 || after.dust < 5 || !after.floats.includes('+20')) throw new Error(`after the charge: ${JSON.stringify(after)}`);
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
    // Spanish runs about 110px longer: at its widest (wave 5, hints on, five-digit score) the HUD stays on one line, with the clock counting
    // and with it saying DESPEJE (time up mid-wave, the last packets still landing: a word where a clock was). The run is held, so neither
    // a step nor the wave clearing can change the HUD between the figures and the shot.
    await spanish(page);
    await page.reload({ waitUntil: 'networkidle' });
    await play(page);
    await freeze(page);
    const widest = (timeLeft) => page.evaluate((left) => {
      const app = window.__nsp.app;
      Object.assign(app.run.state, { wave: 5, score: 88888, credits: 8888, hints: true, timeLeft: left });
      app.refresh();
      const hud = document.querySelector('#ui .hud'), k = hud.getBoundingClientRect().width / 1280;
      const l = hud.querySelector('.hud-l').getBoundingClientRect(), r = hud.querySelector('.hud-r').getBoundingClientRect();
      const tall = [...hud.querySelectorAll('.hud-l > *, .hud-r > *')].filter((e) => e.getBoundingClientRect().height / k > 32).length;
      return { clock: hud.querySelector('.wave b:last-child').textContent, tall, room: Math.round((r.left - l.right) / k), over: Math.round((r.right - hud.getBoundingClientRect().right) / k) };
    }, timeLeft);
    for (const [left, clock] of [[42, '0:42'], [0, 'DESPEJE']]) {
      const fit = await widest(left);
      if (fit.clock !== clock || fit.tall || fit.room < 8 || fit.over > 0) throw new Error(`Spanish HUD does not fit with the clock at ${clock}: ${JSON.stringify(fit)}`);
      await page.screenshot({ path: `${OUT}/${clock === 'DESPEJE' ? 'hud-es-clearing' : 'hud-es'}.png` });
    }
  },
  async panels(page) {
    // The HUD, gutter and uptime strip are opaque: a click on them must not reach the field behind them.
    await play(page);
    await stepUntil(page, (s) => s.packets.filter((p) => !p.entering && !p.doomed).length >= 2);
    const [a, lane] = await page.evaluate(() => {
      const app = window.__nsp.app;
      const [locked, hidden] = app.run.state.packets.filter((p) => !p.entering && !p.doomed);
      locked.x = 300;
      hidden.x = -150;
      app.dispatch(app.run.target(locked.id));
      return [locked.id, hidden.lane];
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
    // Spanish, at its longest: a targeted, bugged attack with the lens on keeps the inspector at 760px and its title inside it.
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
    });
    await page.waitForTimeout(100);
    const fit = await page.evaluate(() => {
      const k = document.querySelector('#ui .bottom').getBoundingClientRect().width / 1280;
      const ins = document.querySelector('#ui .ins'), r = ins.getBoundingClientRect();
      const over = Math.max(...[...ins.querySelectorAll('.ptitle > *')].map((c) => c.getBoundingClientRect().right - (r.right - 18 * k))) / k;
      const box = document.querySelector('#ui .rows');
      const tall = [...box.children].filter((row) => row.getBoundingClientRect().height / k > 26).length;
      const head = document.querySelector('#ui .log .ptitle').getBoundingClientRect().height / k;
      return { width: Math.round(r.width / k), over: Math.round(over), tall, wide: box.scrollWidth - box.clientWidth, head: Math.round(head), tags: ins.querySelectorAll('.ptitle .lk, .ptitle .fl').length };
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
    // A v1 save, as a returning player has one: it reads into the Analyst's slots, the ones the title shows.
    await page.evaluate(() => localStorage.setItem('nsp.v1', JSON.stringify({ bests: { campaign: { normal: { score: 188420, grade: 'A' } }, overtime: { normal: { wave: 14, score: 288888 } }, won: true }, prefs: { lang: 'en', coached: true } })));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#ui .ov-title .best');
    if (await page.$eval('#ui .ov-title .row-btns .btn:nth-child(2)', (b) => b.disabled)) throw new Error('Overtime still locked after a win');
    await fits(page, 'title with bests');
    // The how-to lists every key (eleven rows); its keys and meanings sit on one line each and the screen holds them, in both languages.
    await page.click('#ui .ov-title .row-btns .btn:nth-child(3)');
    await page.waitForSelector('#ui .ov-howto kbd');
    const keys = await page.$$eval('#ui .ov-howto .howto-grid > kbd', (k) => k.map((e) => e.textContent).join(' '));
    if (keys !== '↑ ↓ Tab Shift+Tab Space Esc click H C T M P') throw new Error(`the how-to's keys: ${keys}`);
    await fits(page, 'how-to');
    await page.screenshot({ path: `${OUT}/howto.png` });
    await page.keyboard.press('Escape');
    await page.waitForSelector('#ui .ov-title .btn');
    await page.click('#ui .ov-title .row-btns .btn:nth-child(5)');
    await page.waitForFunction(() => document.documentElement.lang === 'es' && /JUGAR CAMPAÑA/.test(document.querySelector('#ui .ov-title').textContent));
    await fits(page, 'Spanish title');
    // The idle field behind it follows the language too.
    const behind = await page.evaluate(() => [document.querySelector('#ui .hud .wave').textContent, document.querySelector('#ui .bubble.show')]);
    if (!/^OLEADA 1\/6 · RECONOCIMIENTO/.test(behind[0]) || behind[1]) throw new Error(`behind the Spanish title: ${behind[0]}, bubble ${!!behind[1]}`);
    await page.screenshot({ path: `${OUT}/title-es.png` });
    await page.click('#ui .ov-title .row-btns .btn:nth-child(3)');
    await page.waitForSelector('#ui .ov-howto kbd');
    await fits(page, 'Spanish how-to');
    const keysEs = await page.$$eval('#ui .ov-howto .howto-grid > kbd', (k) => k.map((e) => e.textContent).join(' '));
    if (keysEs !== '↑ ↓ Tab Shift+Tab Espacio Esc clic H C T M P') throw new Error(`the Spanish how-to's keys: ${keysEs}`);
    await page.screenshot({ path: `${OUT}/howto-es.png` });
    await page.keyboard.press('Escape');
    // By keyboard: Tab stays on the title's buttons (the layer behind is inert), Enter opens the setup with START
    // under the focus, and Space starts the run.
    await page.waitForSelector('#ui .ov-title .btn');
    await page.keyboard.press('Tab');
    const focused = await page.evaluate(() => document.activeElement?.textContent);
    if (focused !== 'JUGAR CAMPAÑA') throw new Error(`Tab went to ${focused}`);
    await page.keyboard.press('Enter');
    await page.waitForSelector('#ui .ov-setup .foot .btn');
    const start = await page.evaluate(() => ({ screen: window.__nsp.app.screen, focused: document.activeElement?.textContent }));
    if (start.screen !== 'setup' || start.focused !== 'EMPEZAR · ESPACIO') throw new Error(`after Enter on the title: ${JSON.stringify(start)}`);
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__nsp.app.screen === 'playing');
    if (await page.evaluate(() => document.activeElement !== document.body)) throw new Error('a setup button kept the focus into the run');
  },
  async setup(page) {
    // PLAY opens the setup: six knights with their portraits, four difficulties, the Analyst on the Black Knight marked
    // on a first visit, START focused. A pick marks its card at once; START plays the pair and the HUD shows its reputation.
    await page.waitForSelector('#ui .ov-title .btn');
    await page.click('#ui .ov-title .row-btns .btn:nth-child(1)');
    await page.waitForSelector('#ui .ov-setup .foot .btn');
    await page.waitForFunction(() => [...document.querySelectorAll('#ui .ov-setup .kn img')].every((i) => i.complete && i.naturalWidth > 0));
    const shown = () => page.evaluate(() => ({
      screen: window.__nsp.app.screen, knights: document.querySelectorAll('#ui .ov-setup .kn').length, portraits: document.querySelectorAll('#ui .ov-setup .kn img').length,
      levels: document.querySelectorAll('#ui .ov-setup .dl').length, knight: document.querySelector('#ui .ov-setup .kn.sel')?.dataset.id, level: document.querySelector('#ui .ov-setup .dl.sel')?.dataset.id,
      focused: document.activeElement?.textContent, note: document.querySelector('#ui .ov-setup .foot .note')?.textContent,
    }));
    const first = await shown();
    if (first.screen !== 'setup' || first.knights !== 6 || first.portraits !== 6 || first.levels !== 4 || first.knight !== 'black' || first.level !== 'analyst' || first.focused !== 'START · SPACE') throw new Error(`a first setup: ${JSON.stringify(first)}`);
    await page.click('#ui .ov-setup .kn[data-id="warden"]');
    await page.click('#ui .ov-setup .dl[data-id="incident"]');
    const picked = await shown();
    if (picked.knight !== 'warden' || picked.level !== 'incident' || picked.focused !== 'START · SPACE' || picked.note !== 'Warden · Incident · ×1.5') throw new Error(`after the picks: ${JSON.stringify(picked)}`);
    await fits(page, 'setup');
    await page.screenshot({ path: `${OUT}/setup.png` });
    await page.click('#ui .ov-setup .foot .btn:first-child');
    await page.waitForFunction(() => window.__nsp.app.screen === 'playing');
    const run = await page.evaluate(() => ({ cfg: window.__nsp.app.run.state.cfg, pips: document.querySelectorAll('#ui .hud .pips i').length }));
    if (run.cfg.knight !== 'warden' || run.cfg.difficulty !== 'incident' || run.cfg.mode !== 'campaign' || run.pips !== 8) throw new Error(`the run: ${JSON.stringify(run)}`);
    // Remembered across a reload: the title says so, and the setup opens on the pair; Esc goes back to the title.
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#ui .ov-title .btn');
    const title = await page.evaluate(() => [...document.querySelectorAll('#ui .ov-title .note')].map((e) => e.textContent));
    if (!title.includes('Playing as Warden · Incident')) throw new Error(`the title after a reload: ${JSON.stringify(title)}`);
    await page.click('#ui .ov-title .row-btns .btn:nth-child(1)');
    await page.waitForSelector('#ui .ov-setup .foot .btn');
    const again = await shown();
    if (again.knight !== 'warden' || again.level !== 'incident') throw new Error(`the setup after a reload: ${JSON.stringify(again)}`);
    await page.keyboard.press('Escape');
    await page.waitForSelector('#ui .ov-title .btn');
    if (await page.evaluate(() => window.__nsp.app.screen !== 'title' || window.__nsp.app.run !== null)) throw new Error('Esc did not go back to the title');
    // The language button on the foot switches the setup in place and keeps the pair; the picked cards are pressed buttons for a screen reader.
    await page.click('#ui .ov-title .row-btns .btn:nth-child(1)');
    await page.waitForSelector('#ui .ov-setup .foot .btn');
    await page.click('#ui .ov-setup .foot .btn:nth-child(3)');
    await page.waitForFunction(() => document.documentElement.lang === 'es' && /ELIGE A TU CABALLERO/.test(document.querySelector('#ui .ov-setup h2')?.textContent));
    const toggled = await page.evaluate(() => ({
      knight: document.querySelector('#ui .ov-setup .kn.sel')?.dataset.id, level: document.querySelector('#ui .ov-setup .dl.sel')?.dataset.id,
      screen: window.__nsp.app.screen, pressed: [...document.querySelectorAll('#ui .ov-setup [aria-pressed="true"]')].map((b) => b.dataset.id),
    }));
    if (toggled.screen !== 'setup' || toggled.knight !== 'warden' || toggled.level !== 'incident' || toggled.pressed.join() !== 'warden,incident') throw new Error(`after the language button: ${JSON.stringify(toggled)}`);
    await page.click('#ui .ov-setup .foot .btn:nth-child(3)');
    await page.waitForFunction(() => document.documentElement.lang === 'en' && /CHOOSE YOUR KNIGHT/.test(document.querySelector('#ui .ov-setup h2')?.textContent));
    // Enter starts the run from wherever the focus is, once: on a knight's card that is not the marked one it starts on the pair marked,
    // and the card is not picked (the browser's own click on Enter is cancelled).
    await page.evaluate(() => {
      const app = window.__nsp.app, real = app.startRun.bind(app);
      window.__smokeStarts = [];
      app.startRun = (...args) => { window.__smokeStarts.push(args[0]); return real(...args); };
      document.querySelector('#ui .ov-setup .kn[data-id="raider"]').focus();
    });
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__nsp.app.screen === 'playing');
    await page.waitForTimeout(100);
    const entered = await page.evaluate(() => ({ starts: window.__smokeStarts, cfg: window.__nsp.app.run.state.cfg, saved: JSON.parse(localStorage.getItem('nsp.v1')).prefs }));
    if (entered.starts.length !== 1 || entered.starts[0] !== 'campaign' || entered.cfg.knight !== 'warden' || entered.cfg.difficulty !== 'incident' || entered.saved.knight !== 'warden') throw new Error(`Enter on a card: ${JSON.stringify(entered)}`);
    // In Spanish, at its longest: Forge on Zero-day, every card and the foot on one screen.
    await spanish(page);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#ui .ov-title .btn');
    await page.click('#ui .ov-title .row-btns .btn:nth-child(1)');
    await page.waitForSelector('#ui .ov-setup .foot .btn');
    await page.click('#ui .ov-setup .kn[data-id="forge"]');
    await page.click('#ui .ov-setup .dl[data-id="zeroday"]');
    await page.waitForFunction(() => [...document.querySelectorAll('#ui .ov-setup .kn img')].every((i) => i.complete && i.naturalWidth > 0));
    const es = await shown();
    if (es.focused !== 'EMPEZAR · ESPACIO' || es.note !== 'Forja · Día cero · ×2') throw new Error(`the Spanish setup: ${JSON.stringify(es)}`);
    await fits(page, 'Spanish setup');
    await page.screenshot({ path: `${OUT}/setup-es.png` });
  },
  async recap(page) {
    // A wave with mistakes ends on their recap, before its draft: the counts, every breach and false alarm with the payload's
    // tells underlined and the reason, CONTINUE focused. A real user speared is the false alarm; without the lockdown,
    // the first scan to reach the rack is the breach.
    const mistakes = async () => {
      await stepUntil(page, (s) => s.packets.some((p) => p.t.kind === 'legit' && !p.entering && !p.doomed));
      await page.evaluate(() => {
        const app = window.__nsp.app, p = app.run.state.packets.find((q) => q.t.kind === 'legit' && !q.entering && !q.doomed);
        app.dispatch(app.run.target(p.id));
        app.dispatch(app.run.throwSpear());
      });
      await stepUntil(page, (s) => s.waveMistakes.some((e) => e.outcome === 'fp'));
      await page.evaluate(() => { window.__nsp.app.run.state.owned = []; });
      await stepUntil(page, (s) => s.waveMistakes.some((e) => e.outcome === 'breach'));
      await page.evaluate(() => { const a = window.__nsp.app; a.dispatch(a.run.cheat('skip')); });
      await page.waitForSelector('#ui .ov-recap .btn');
    };
    const shown = () => page.evaluate(() => ({
      screen: window.__nsp.app.screen, title: document.querySelector('#ui .ov-recap h2')?.textContent, note: document.querySelector('#ui .ov-recap p.note')?.textContent,
      focused: document.activeElement?.textContent, rows: [...document.querySelectorAll('#ui .ov-recap .mistake')].map((m) => m.className),
      marks: [...document.querySelectorAll('#ui .ov-recap .mistake.breach mark')].map((m) => m.textContent), imgs: document.querySelectorAll('#ui .ov-recap img').length,
      // The row shows the whole request, the tells underlined where they are (a scan's sit on two of its lines).
      lines: document.querySelector('#ui .ov-recap .mistake.breach pre')?.textContent.split('\n').length,
    }));
    await play(page);
    await mistakes();
    const en = await shown();
    if (en.screen !== 'recap' || en.title !== 'WAVE 1 CLEARED' || !/^(1 breach|\d+ breaches) · 1 false alarm$/.test(en.note) || en.focused !== 'CONTINUE ▸') throw new Error(`recap: ${JSON.stringify(en)}`);
    if (!en.rows.includes('mistake breach') || !en.rows.includes('mistake fp') || en.marks.length < 2 || !(en.lines > 1) || en.imgs) throw new Error(`recap rows: ${JSON.stringify(en)}`);
    await fits(page, 'recap');
    await page.screenshot({ path: `${OUT}/recap.png` });
    // Space goes on to the draft: no card taken, nothing focused, so the next Space is not a card button's click.
    await page.keyboard.press('Space');
    await page.waitForFunction(() => window.__nsp.app.screen === 'draft');
    const draft = await page.evaluate(() => ({
      taken: window.__nsp.app.run.state.draft.taken, body: document.activeElement === document.body, notes: [...document.querySelectorAll('#ui .ov-draft p.note')].map((e) => e.textContent),
    }));
    if (draft.taken.length || !draft.body || draft.notes.length !== 1 || draft.notes[0] !== 'T · see every upgrade in the Armory') throw new Error(`after CONTINUE: ${JSON.stringify(draft)}`);
    await page.keyboard.press('Space');
    if ((await page.evaluate(() => window.__nsp.app.run.state.draft.taken)).length) throw new Error('Space on the draft took a card');
    // In Spanish, the same wave.
    await spanish(page);
    await page.reload({ waitUntil: 'networkidle' });
    await play(page);
    await mistakes();
    const es = await shown();
    if (es.title !== 'OLEADA 1 SUPERADA' || !/^(1 brecha|\d+ brechas) · 1 falsa alarma$/.test(es.note) || es.focused !== 'CONTINUAR ▸' || es.marks.length < 2) throw new Error(`Spanish recap: ${JSON.stringify(es)}`);
    await fits(page, 'Spanish recap');
    await page.screenshot({ path: `${OUT}/recap-es.png` });
  },
  async draft(page) {
    await play(page);
    await page.evaluate(() => { const a = window.__nsp.app; a.dispatch(a.run.cheat('skip')); });
    const clean = await toDraft(page);
    await page.waitForSelector('#ui .ov-draft .ucard');
    // A clean wave says so under the stats line (one with mistakes had its recap instead); every draft ends on the Armory's key.
    const notes = await page.evaluate(() => [...document.querySelectorAll('#ui .ov-draft p.note')].map((e) => e.textContent));
    if (JSON.stringify(notes) !== JSON.stringify([...(clean ? ['Clean wave'] : []), 'T · see every upgrade in the Armory'])) throw new Error(`the draft's notes: ${JSON.stringify({ clean, notes })}`);
    await page.waitForFunction(() => [...document.querySelectorAll('#ui .ucard img')].every((i) => i.complete && i.naturalWidth > 0));
    // The cards flip in one after another (a 0.24 s flip, 0.12 s apart): shot once the last has landed.
    await page.waitForFunction(() => !document.getAnimations().some((a) => a.animationName === 'flip' && a.playState !== 'finished'));
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
    const cleanEs = await toDraft(page);
    await page.waitForSelector('#ui .ov-draft .ucard');
    const notesEs = await page.evaluate(() => [...document.querySelectorAll('#ui .ov-draft p.note')].map((e) => e.textContent));
    if (JSON.stringify(notesEs) !== JSON.stringify([...(cleanEs ? ['Oleada limpia'] : []), 'T · mira todas las mejoras en la Armería'])) throw new Error(`the Spanish draft's notes: ${JSON.stringify({ cleanEs, notesEs })}`);
    await everyCardFits(page, 'Spanish draft');
    await page.evaluate(() => { const a = window.__nsp.app; a.pick(0); });
    await page.waitForFunction(() => [...document.querySelectorAll('#ui .ucard img')].every((i) => i.complete && i.naturalWidth > 0));
    await page.waitForTimeout(600);
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
    await page.click('#ui .ov-pause .btn:nth-child(5)');
    const fx = await page.evaluate(() => ({
      effects: window.__nsp.effects.reduced, css: document.querySelector('#ui').classList.contains('reduced'),
      saved: JSON.parse(localStorage.getItem('nsp.v1')).prefs.reducedFx, label: document.querySelector('#ui .ov-pause .btn:nth-child(5)').textContent,
    }));
    if (!fx.effects || !fx.css || fx.saved !== true || !/· ON$/.test(fx.label)) throw new Error(`reduced effects: ${JSON.stringify(fx)}`);
    await page.click('#ui .ov-pause .btn:nth-child(4)');
    await page.waitForFunction(() => document.documentElement.lang === 'es' && /EN PAUSA/.test(document.querySelector('#ui .ov-pause').textContent));
    // Every switch of the Spanish menu says SÍ or NO, the reduced effects (switched on just above) with the rest.
    const reducedEs = await page.textContent('#ui .ov-pause .btn:nth-child(5)');
    if (reducedEs !== 'EFECTOS REDUCIDOS · SÍ') throw new Error(`the Spanish reduced-effects switch says ${reducedEs}`);
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
  async sound(page) {
    // The sound waits for the first key or press; M mutes the sound and the music together and the HUD says so; the pause menu
    // switches each. Headless Chromium has no output device, so this checks state (and that nothing throws on the real context),
    // never what is heard.
    const audio = () => page.evaluate(() => ({
      unlocked: window.__nsp.audio.unlocked, looping: window.__nsp.audio.looping, settings: window.__nsp.audio.settings,
      context: !!window.__nsp.audio.ctx, saved: JSON.parse(localStorage.getItem('nsp.v1') ?? '{}').prefs ?? {},
    }));
    const badge = () => page.isVisible('#ui .hud .mute');
    // The pause menu's last three buttons are the sound switches; the five before them keep their places.
    const switches = async () => (await page.$$eval('#ui .ov-pause button', (b) => b.map((e) => e.textContent))).slice(-3).join(' | ');
    const expectAudio = (what, a, want) => {
      const got = { sound: a.settings.sound, music: a.settings.music, volume: a.settings.volume, looping: a.looping, savedSound: a.saved.sound, savedMusic: a.saved.music, savedVolume: a.saved.volume };
      if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`${what}: ${JSON.stringify(got)}, expected ${JSON.stringify(want)}`);
    };
    const state = (sound, music, volume, looping, saved = true) => ({ sound, music, volume, looping, savedSound: saved ? sound : undefined, savedMusic: saved ? music : undefined, savedVolume: saved ? volume : undefined });

    // Before any gesture nothing is built or running, and there is no badge; the title hints that a key starts the sound, in a note at
    // least 13px tall that hangs off the flow (nothing on the title is placed by it).
    await page.waitForSelector('#ui .ov-title .btn');
    let a = await audio();
    if (a.unlocked || a.context || a.looping || await badge()) throw new Error(`audio before a gesture: ${JSON.stringify(a)}`);
    const hint = () => page.evaluate(() => {
      const h = document.querySelector('#ui .ov-title .sound-hint');
      return h && { text: h.textContent, size: parseFloat(getComputedStyle(h).fontSize), position: getComputedStyle(h).position, inRow: !!h.closest('.row-btns') };
    });
    const titleAt = () => page.evaluate(() => [...document.querySelectorAll('#ui .ov-title > *:not(.sound-hint)')].map((e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 100) / 100).join(); }).join(' | '));
    const hinted = await hint(), laidOut = await titleAt();
    if (!hinted || hinted.text !== '\u266A press any key for sound' || hinted.size < 13 || hinted.position !== 'absolute' || hinted.inRow) throw new Error(`the title's sound hint: ${JSON.stringify(hinted)}`);
    await fits(page, 'title with the sound hint');
    await page.screenshot({ path: `${OUT}/title-hint.png` });
    // The first key (a letter the title routes nowhere) builds it on the real AudioContext, and the loop starts under the title; the hint goes
    // with it and takes nothing else with it: every other thing on the title is where it was.
    await page.keyboard.press('x');
    a = await audio();
    if (!a.unlocked || !a.context || !a.looping) throw new Error(`after the first key: ${JSON.stringify(a)}`);
    if (await hint() || await titleAt() !== laidOut) throw new Error(`the hint's going moved the title, or did not go: ${JSON.stringify([await hint(), laidOut, await titleAt()])}`);
    // Every effect schedules on the real context without throwing, which the unit tests' fake context cannot show.
    const failed = await page.evaluate(() => {
      const errors = [];
      for (const n of ['throw', 'hit', 'miss', 'swallow', 'breach', 'pick', 'levelUp', 'button', 'pause', 'waveStart', 'charge', 'recap']) {
        try { window.__nsp.audio.synth.play(n); } catch (e) { errors.push(`${n}: ${e.message}`); }
      }
      return errors;
    });
    if (failed.length) throw new Error(`effects on the real context: ${failed.join('; ')}`);

    // The limiter on the real engine, with no output device (an offline render of the real view): four breaches at once at the top volume
    // are past full scale without a limiter and under it with one (the first 45 ms, before the breach's noise: nothing random in it),
    // and one breach plays as loud with the limiter as without, its makeup gain taken back out. The node fades in over its first quarter
    // second, so everything plays at half a second.
    const stacks = await page.evaluate(async () => {
      const View = window.__nsp.audio.constructor, RATE = 44100;
      const render = async (n, limiter) => {
        const off = new OfflineAudioContext(1, RATE, RATE);
        const ctx = limiter ? off : new Proxy(off, { get: (t, k) => (k === 'createDynamicsCompressor' ? undefined : typeof t[k] === 'function' ? t[k].bind(t) : t[k]) });
        const view = new View(() => ctx, { sound: true, music: false, volume: 3 });
        view.unlock();
        off.suspend(0.5).then(() => { for (let i = 0; i < n; i++) view.event({ type: 'resolved', packet: {}, outcome: 'breach', damage: 1 }); return off.resume(); });
        const out = (await off.startRendering()).getChannelData(0).slice(RATE / 2, RATE / 2 + Math.round(RATE * 0.045));
        return out.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
      };
      return { four: [await render(4, false), await render(4, true)], one: [await render(1, false), await render(1, true)] };
    });
    if (!(stacks.four[0] > 1 && stacks.four[1] <= 1)) throw new Error(`four breaches at volume 3, without and with the limiter: ${JSON.stringify(stacks.four)}`);
    if (stacks.one[1] < 0.1 || Math.abs(stacks.one[0] - stacks.one[1]) > 0.02) throw new Error(`one breach, without and with the limiter: ${JSON.stringify(stacks.one)}`);

    // M puts both off (saved, the loop stopped, the badge up) and brings both back.
    await play(page);
    expectAudio('in play', await audio(), state(true, true, 2, true, false));
    await page.keyboard.press('m');
    expectAudio('after M', await audio(), state(false, false, 2, false));
    if (!await badge()) throw new Error('no MUTED badge after M');
    await page.screenshot({ path: `${OUT}/sound-muted.png` });
    await page.keyboard.press('m');
    expectAudio('after M again', await audio(), state(true, true, 2, true));
    if (await badge()) throw new Error('the MUTED badge stayed after M again');

    // The pause menu: the three switches, each saved, and M still works over it.
    await page.keyboard.press('p');
    await page.waitForSelector('#ui .ov-pause .btn');
    if (await switches() !== 'SOUND · ON | MUSIC · ON | VOLUME · 2/3') throw new Error(`pause switches: ${await switches()}`);
    await fits(page, 'pause with the sound switches');
    await page.screenshot({ path: `${OUT}/sound-pause.png` });
    const press = (word) => page.click(`#ui .ov-pause button:has-text("${word}")`);
    await press('SOUND');
    expectAudio('SOUND off', await audio(), state(false, true, 2, true));
    if (await switches() !== 'SOUND · OFF | MUSIC · ON | VOLUME · 2/3') throw new Error(`after SOUND: ${await switches()}`);
    await press('MUSIC');
    expectAudio('MUSIC off', await audio(), state(false, false, 2, false));
    if (!await badge()) throw new Error('both off from the pause menu, and no MUTED badge');
    // The volume has three steps, 1 to 3 and round again, never 0 (where nothing would play with both switches on and no badge to say why).
    await press('SOUND');
    await press('MUSIC');
    const volumes = [];
    for (let i = 0; i < 4; i++) { await press('VOLUME'); volumes.push((await audio()).settings.volume); }
    if (volumes.join() !== '3,1,2,3') throw new Error(`the volume stepped ${volumes}`);
    expectAudio('VOLUME 3', await audio(), state(true, true, 3, true));
    await page.keyboard.press('m');
    expectAudio('M over the pause', await audio(), state(false, false, 3, false));
    if (await switches() !== 'SOUND · OFF | MUSIC · OFF | VOLUME · 3/3') throw new Error(`after M in the pause: ${await switches()}`);
    await page.keyboard.press('m');
    expectAudio('M back over the pause', await audio(), state(true, true, 3, true));
    // M gives back the pair it took: SOUND on and MUSIC off is SOUND on and MUSIC off again, not both on.
    await press('MUSIC');
    expectAudio('MUSIC off by hand', await audio(), state(true, false, 3, false));
    await page.keyboard.press('m');
    expectAudio('M with MUSIC off', await audio(), state(false, false, 3, false));
    await page.keyboard.press('m');
    expectAudio('M gives back SOUND on, MUSIC off', await audio(), state(true, false, 3, false));
    await press('MUSIC');
    await press('VOLUME');
    await press('VOLUME');
    expectAudio('back to the defaults', await audio(), state(true, true, 2, true));
    await page.keyboard.press('p');
    await page.waitForFunction(() => window.__nsp.app.screen === 'playing');

    // The console's prompt keeps its letters: M typed there is a letter, not the mute key.
    await page.keyboard.press('`');
    await page.waitForSelector('#ui .term.show input');
    await page.waitForFunction(() => document.activeElement?.tagName === 'INPUT');
    await page.keyboard.type('mmm');
    if (await page.inputValue('#ui .term input') !== 'mmm') throw new Error('the console did not get its letters');
    expectAudio('M in the console', await audio(), state(true, true, 2, true));
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__nsp.app.screen === 'playing');

    // Saved muted, in Spanish: the badge is up from the start, the widest HUD still fits with it, and the pause menu reads in Spanish.
    // The save also has a volume of 0, which the pause menu cannot set: it is dropped and the default 2 applies.
    await page.evaluate(() => localStorage.setItem('nsp.v1', JSON.stringify({ prefs: { lang: 'es', coached: true, sound: false, music: false, volume: 0 } })));
    await page.reload({ waitUntil: 'networkidle' });
    // No key will bring a sound from a muted save, so the title does not hint at one.
    await page.waitForSelector('#ui .ov-title .btn');
    if (await hint()) throw new Error('the title hints at a sound a muted save will not make');
    await play(page);
    if (!await badge()) throw new Error('a muted save came up with no badge');
    // The badge hangs under the bar's left end, so the bar keeps the room it had at its widest (wave 5, hints on, a five-digit
    // score); it stays short of the coach tip at x 130 and clear of the lane labels.
    const hud = await page.evaluate(() => {
      const app = window.__nsp.app;
      Object.assign(app.run.state, { wave: 5, score: 88888, credits: 8888, hints: true });
      app.refresh();
      const bar = document.querySelector('#ui .hud'), b = bar.getBoundingClientRect(), k = b.width / 1280;
      const l = bar.querySelector('.hud-l').getBoundingClientRect(), r = bar.querySelector('.hud-r').getBoundingClientRect();
      const tab = bar.querySelector('.mute'), t = tab.getBoundingClientRect();
      const tall = [...bar.querySelectorAll('.hud-l > *, .hud-r > *')].filter((e) => e.getBoundingClientRect().height / k > 32).length;
      const hits = [...document.querySelectorAll('#ui .glabel *')].filter((e) => {
        const x = e.getBoundingClientRect();
        return x.width > 0 && x.left < t.right && x.right > t.left && x.top < t.bottom && x.bottom > t.top;
      }).length;
      const note = tab.querySelector('.note');
      return { text: tab.textContent, note: note.textContent, struck: getComputedStyle(note).textDecorationLine, tall, room: Math.round((r.left - l.right) / k), over: Math.round((r.right - b.right) / k), under: Math.round((t.top - b.bottom) / k), right: Math.round((t.right - b.left) / k), size: parseFloat(getComputedStyle(tab).fontSize), hits };
    });
    if (hud.text !== '\u266A SILENCIO · M') throw new Error(`the badge says ${JSON.stringify(hud.text)}`);
    // A plain note struck through by the CSS, not a combining solidus the pixel font cannot draw.
    if (hud.note !== '\u266A' || !/line-through/.test(hud.struck)) throw new Error(`the badge's note: ${JSON.stringify([hud.note, hud.struck])}`);
    if (hud.tall || hud.room < 8 || hud.over > 0) throw new Error(`Spanish HUD does not fit while muted: ${JSON.stringify(hud)}`);
    if (hud.under < 0 || hud.right > 129 || hud.size < 13 || hud.hits) throw new Error(`the badge is misplaced: ${JSON.stringify(hud)}`);
    await page.screenshot({ path: `${OUT}/sound-es.png` });
    await page.keyboard.press('p');
    await page.waitForSelector('#ui .ov-pause .btn');
    if (await switches() !== 'SONIDO · NO | MÚSICA · NO | VOLUMEN · 2/3') throw new Error(`Spanish pause switches: ${await switches()}`);
    await fits(page, 'Spanish pause with the sound switches');
    await page.screenshot({ path: `${OUT}/sound-pause-es.png` });
    // Not muted, in Spanish, before any key: the title's hint is there and fits.
    await page.evaluate(() => localStorage.setItem('nsp.v1', JSON.stringify({ prefs: { lang: 'es', coached: true } })));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#ui .ov-title .sound-hint');
    const hintEs = await hint();
    if (hintEs.text !== '\u266A pulsa cualquier tecla para el sonido' || hintEs.size < 13) throw new Error(`the Spanish sound hint: ${JSON.stringify(hintEs)}`);
    await fits(page, 'Spanish title with the sound hint');
    await page.screenshot({ path: `${OUT}/title-hint-es.png` });
  },
  async armory(page) {
    // The Armory is read only: three branches, fourteen cards, CLOSE focused, the detail open on the first card. From the title
    // it shows the loadout a run starts with; T and Esc, the ARMORY button and CLOSE all put it away.
    const shown = () => page.evaluate(() => ({
      screen: window.__nsp.app.screen, cols: document.querySelectorAll('#ui .ov-armory .ar-col').length, cards: document.querySelectorAll('#ui .ov-armory .cx').length,
      focused: document.activeElement?.textContent, name: document.querySelector('#ui .ov-armory .ar-detail h6')?.textContent, id: document.activeElement?.dataset?.id,
      count: document.querySelector('#ui .ov-armory .ar-head .n')?.textContent, credits: document.querySelector('#ui .ov-armory .ar-head .cr')?.textContent,
    }));
    const timeLeft = () => page.evaluate(() => window.__nsp.app.run.state.timeLeft);
    // The 13 px floor of the global constraints: no text on the screen is set smaller (computed sizes are in the 1280x720 space).
    const floor = async (p, what) => {
      const small = await p.evaluate(() => [...document.querySelectorAll('#ui .ov-armory *')].filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()))
        .map((e) => [`${e.tagName.toLowerCase()}.${e.className} "${e.textContent.slice(0, 24)}"`, parseFloat(getComputedStyle(e).fontSize)]).filter(([, px]) => px < 13).map(([name, px]) => `${name} ${px}px`));
      if (small.length) throw new Error(`${what} sets text under 13px:\n${small.join('\n')}`);
    };
    // The three columns' first cards share a top line, whether a head wraps (the Spanish firewall's) or not.
    const aligned = async (what) => {
      const tops = await page.evaluate(() => [...document.querySelectorAll('#ui .ov-armory .ar-col')].map((c) => c.querySelector('.cx').getBoundingClientRect().top));
      if (tops.length !== 3 || Math.max(...tops) - Math.min(...tops) > 1) throw new Error(`${what}: the first cards sit at ${tops.map((y) => Math.round(y)).join(', ')}`);
    };
    // The focused card of the draft (an index), or -1.
    const onCard = () => page.evaluate(() => [...document.querySelectorAll('#ui .ov-draft .ucard')].indexOf(document.activeElement?.closest('.ucard')));
    await page.waitForSelector('#ui .ov-title .btn');
    await page.keyboard.press('t');
    await page.waitForSelector('#ui .ov-armory .cx');
    await page.waitForFunction(() => [...document.querySelectorAll('#ui .ov-armory .cx img')].every((i) => i.complete && i.naturalWidth > 0));
    const first = await shown();
    if (first.screen !== 'armory' || first.cols !== 3 || first.cards !== 14 || first.focused !== 'CLOSE · T' || first.name !== 'Destrier I' || first.count !== '1 of 14 owned' || first.credits !== 'CREDITS 0') throw new Error(`the title's Armory: ${JSON.stringify(first)}`);
    await fits(page, 'armory');
    await floor(page, 'armory');
    await aligned('armory');
    await page.screenshot({ path: `${OUT}/armory.png` });
    await page.keyboard.press('Escape');
    await page.waitForSelector('#ui .ov-title .btn');
    if (await page.evaluate(() => window.__nsp.app.screen) !== 'title') throw new Error('Esc did not close the Armory onto the title');
    // The title's ARMORY button and CLOSE, by the mouse: nothing is left focused behind them.
    await page.click('#ui .ov-title .row-btns .btn:nth-child(4)');
    await page.waitForSelector('#ui .ov-armory .cx');
    await page.click('#ui .ov-armory .ar-head .btn');
    await page.waitForSelector('#ui .ov-title .btn');
    if (await page.evaluate(() => window.__nsp.app.screen !== 'title' || document.activeElement !== document.body)) throw new Error('CLOSE did not leave the Armory for the title');
    // The how-to is a view of the title, and T opens the Armory over it: T, Esc and CLOSE all close it back onto the how-to, and
    // that one Esc closes the Armory only, not the how-to as well; the how-to's own Esc then goes on to the title.
    const onHowto = () => page.evaluate(() => [window.__nsp.app.screen, document.querySelector('#ui .ov.show')?.classList.contains('ov-howto')]);
    await page.click('#ui .ov-title .row-btns .btn:nth-child(3)');
    await page.waitForSelector('#ui .ov-howto kbd');
    for (const close of ['t', 'Escape', 'CLOSE']) {
      await page.keyboard.press('t');
      await page.waitForFunction(() => window.__nsp.app.screen === 'armory');
      if (close === 'CLOSE') await page.click('#ui .ov-armory .ar-head .btn'); else await page.keyboard.press(close);
      await page.waitForSelector('#ui .ov-howto kbd');
      const back = await onHowto();
      if (back[0] !== 'title' || back[1] !== true) throw new Error(`the Armory closed with ${close} onto ${JSON.stringify(back)}, not the how-to`);
    }
    await page.keyboard.press('Escape');
    await page.waitForSelector('#ui .ov-title .btn');
    if (await page.evaluate(() => window.__nsp.app.screen) !== 'title') throw new Error('Esc on the how-to did not go on to the title');
    // In play, T stops the field: the Armory over a run in its wave, what it owns lit, the clock holding still.
    await play(page);
    await page.evaluate(() => {
      const s = window.__nsp.app.run.state;
      s.owned = ['lockdown', 'destrier', 'destrier2', 'obs1', 'f2b', 'prepared'];
      s.credits = 820;
    });
    await page.keyboard.press('t');
    await page.waitForFunction(() => window.__nsp.app.screen === 'armory');
    await page.waitForFunction(() => [...document.querySelectorAll('#ui .ov-armory .cx img')].every((i) => i.complete && i.naturalWidth > 0));
    const run = await shown();
    if (run.count !== '5 of 14 owned' || run.credits !== 'CREDITS 820' || run.name !== 'Destrier II' || run.focused !== 'CLOSE · T') throw new Error(`the Armory over a run: ${JSON.stringify(run)}`);
    const held = await page.evaluate(() => ({ phase: window.__nsp.app.run.state.phase, left: window.__nsp.app.run.state.timeLeft, frozen: document.querySelector('#ui').classList.contains('paused') }));
    await page.waitForTimeout(300);
    const later = await timeLeft();
    if (held.phase !== 'playing' || !held.frozen || later !== held.left) throw new Error(`the field under the Armory: ${JSON.stringify({ held, later })}`);
    await fits(page, 'armory over a run');
    await page.screenshot({ path: `${OUT}/armory-run.png` });
    // Tab walks the cards from CLOSE, and the detail follows the focus: the third card is the Squire.
    for (let i = 0; i < 3; i++) await page.keyboard.press('Tab');
    const third = await shown();
    if (third.id !== 'squire' || third.name !== 'Squire' || third.name === run.name) throw new Error(`Tab went to ${JSON.stringify(third)}`);
    // The arrow keys walk the cards as they sit: → to the same row of the next branch, ↓ down it, ← and ↑ back, the detail following.
    const walked = [];
    for (const key of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) {
      await page.keyboard.press(key);
      const now = await shown();
      walked.push(`${now.id}:${now.name}`);
    }
    if (walked.join() !== 'f2b:fail2ban,tarpit:Tarpit,lens:Decoding lens,squire:Squire') throw new Error(`the arrows went ${walked}`);
    await page.keyboard.press('t');
    await page.waitForFunction(() => window.__nsp.app.screen === 'playing' && !document.querySelector('#ui .ov.show'));
    const resumed = await timeLeft();
    await page.waitForTimeout(300);
    if (!((await timeLeft()) < resumed)) throw new Error('the clock did not run again after the Armory');
    // From the pause menu it comes back to the pause, and the pause is still the pause.
    await page.keyboard.press('p');
    await page.click('#ui .ov-pause .btn:nth-child(3)');
    await page.waitForFunction(() => window.__nsp.app.screen === 'armory');
    await page.keyboard.press('Escape');
    await page.waitForSelector('#ui .ov-pause .btn');
    if (await page.evaluate(() => window.__nsp.app.screen) !== 'paused') throw new Error('the Armory did not return to the pause');
    // By keyboard: Tab to the last button (REDUCED EFFECTS), T and T, and it is still the focused one, not RESUME.
    for (let i = 0; i < 5; i++) await page.keyboard.press('Tab');
    await page.keyboard.press('t');
    await page.waitForFunction(() => window.__nsp.app.screen === 'armory');
    await page.keyboard.press('t');
    await page.waitForSelector('#ui .ov-pause .btn');
    const kept = await page.evaluate(() => ({ screen: window.__nsp.app.screen, focused: document.activeElement?.textContent }));
    if (kept.screen !== 'paused' || !/^REDUCED EFFECTS/.test(kept.focused)) throw new Error(`back on the pause: ${JSON.stringify(kept)}`);
    await page.keyboard.press('p');
    await page.waitForFunction(() => window.__nsp.app.screen === 'playing');
    // Over a draft it shows and does not sell: back on the draft, no card is taken and none is under Space.
    await page.evaluate(() => { const a = window.__nsp.app; a.dispatch(a.run.cheat('skip')); });
    await toDraft(page);
    await page.keyboard.press('t');
    await page.waitForFunction(() => window.__nsp.app.screen === 'armory');
    await page.keyboard.press('t');
    await page.waitForSelector('#ui .ov-draft .ucard');
    const draft = await page.evaluate(() => ({ screen: window.__nsp.app.screen, taken: window.__nsp.app.run.state.draft.taken, body: document.activeElement === document.body }));
    if (draft.screen !== 'draft' || draft.taken.length || !draft.body) throw new Error(`back on the draft: ${JSON.stringify(draft)}`);
    // By keyboard: Tab to the third card, T and T, and the third card still has the focus, so the next Space is not the first card's
    // free pick; nothing was taken meanwhile.
    for (let i = 0; i < 3; i++) await page.keyboard.press('Tab');
    const left = await onCard();
    await page.keyboard.press('t');
    await page.waitForFunction(() => window.__nsp.app.screen === 'armory');
    await page.keyboard.press('t');
    await page.waitForSelector('#ui .ov-draft .ucard');
    const comeback = { card: await onCard(), taken: await page.evaluate(() => window.__nsp.app.run.state.draft.taken) };
    if (left !== 2 || comeback.card !== 2 || comeback.taken.length) throw new Error(`back on the draft's third card: ${JSON.stringify({ left, ...comeback })}`);
    // In Spanish, over a run: the longest names, the state lines and the levels fit.
    await spanish(page);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#ui .ov-title .btn');
    await page.keyboard.press('t');
    await page.waitForSelector('#ui .ov-armory .cx');
    const es = await shown();
    if (es.count !== '1 de 14 en tu poder' || es.credits !== 'CRÉDITOS 0' || es.focused !== 'CERRAR · T') throw new Error(`the Spanish Armory: ${JSON.stringify(es)}`);
    await fits(page, 'Spanish armory');
    await floor(page, 'Spanish armory');
    await aligned('Spanish armory');
    await page.screenshot({ path: `${OUT}/armory-es.png` });
    await page.keyboard.press('t');
    await play(page);
    await page.evaluate(() => {
      const s = window.__nsp.app.run.state;
      s.owned = ['lockdown', 'destrier', 'obs1', 'obs2', 'obs3', 'quote', 'prepared'];
      s.credits = 12345;
    });
    await page.keyboard.press('t');
    await page.waitForSelector('#ui .ov-armory .cx');
    await fits(page, 'Spanish armory over a run');
    await aligned('Spanish armory over a run');
    await page.screenshot({ path: `${OUT}/armory-run-es.png` });
  },
  async webgl(page) {
    // A browser without WebGL gets the card instead of a blank page, and Phaser never starts.
    await page.addInitScript(() => {
      const get = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (kind, ...rest) { return /^webgl/.test(kind) ? null : get.call(this, kind, ...rest); };
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('.gate h2');
    if (await page.$('#stage canvas')) throw new Error('the game booted without WebGL');
    const card = await page.evaluate(() => {
      const g = document.querySelector('.gate');
      return { title: g.querySelector('h2').textContent, link: g.querySelector('a').href, fits: g.scrollHeight <= g.clientHeight && g.scrollWidth <= g.clientWidth };
    });
    if (card.title !== 'This one needs WebGL.' || !card.link.startsWith('https://jorius.github.io/') || !card.fits) throw new Error(`webgl card: ${JSON.stringify(card)}`);
    await page.screenshot({ path: `${OUT}/webgl.png` });
  },
  async reduced(page) {
    // Reduced effects double the glitch periods (the title, the low-uptime strip), hide the scan lines and drop the
    // rack's shake on a breach, and nothing else changes: a shot of the burning field each way.
    await play(page);
    await page.evaluate(() => { const app = window.__nsp.app; app.run.state.uptime = 20; app.dispatch([{ type: 'uptime', before: 100, after: 20 }]); });
    await stepUntil(page, (s) => s.packets.some((p) => !p.entering && !p.doomed));
    // Past the strip's scramble and the lost segments' fresh flash (on the view clock, slower than the wall under software rendering), so the shot
    // shows the steady low-uptime glitch and the segments are the flickering kind.
    await page.waitForFunction(() => document.querySelector('#ui .hpstrip b').textContent === '20%' && !document.querySelector('#ui .hpstrip .segs i.fresh'));
    const glitches = () => page.evaluate(() => {
      const anim = (sel) => { const cs = getComputedStyle(document.querySelector(sel)); return `${cs.animationName} ${cs.animationDuration}`; };
      // A dead segment flickers every 1.3 s, and every seventh every .7 s.
      const dead = [...document.querySelectorAll('#ui .hpstrip.low .segs i.lost')], dur = (e) => getComputedStyle(e).animationDuration;
      return {
        title: anim('#ui .hud .title'), num: anim('#ui .hpstrip.low b'), segs: anim('#ui .hpstrip.low .segs'), scan: getComputedStyle(document.querySelector('#ui .scanlines')).display,
        lost: dur(dead.find((e) => !e.matches(':nth-child(7n)'))), seventh: dur(dead.find((e) => e.matches(':nth-child(7n)'))),
      };
    });
    // A breach, sent to the views (only the rack listens): how many tweens it starts on the rack.
    const shakes = () => page.evaluate(() => {
      const app = window.__nsp.app, scene = window.__nsp.game.scene.getScene('field');
      window.__smokeRack ??= scene.layers.actors.list.find((o) => o.list && o.x === 1124 && o.y === 0);
      const packet = app.run.state.packets.find((p) => !p.entering && !p.doomed);
      app.dispatch([{ type: 'resolved', packet, outcome: 'breach', damage: 10 }]);
      return scene.tweens.getTweensOf(window.__smokeRack).length;
    });
    const full = await glitches();
    if (full.title !== 'jitter 4s' || full.num !== 'lowg 2.2s' || full.segs !== 'lowseg 3.1s' || full.scan === 'none' || full.lost !== '1.3s' || full.seventh !== '0.7s') throw new Error(`full effects: ${JSON.stringify(full)}`);
    if (await shakes() !== 1) throw new Error('a breach did not shake the rack');
    await page.screenshot({ path: `${OUT}/fx.png` });
    // Reduced from the pause menu, then back in play; once the first bounce is over, the next breach asks for none.
    await page.keyboard.press('p');
    await page.click('#ui .ov-pause .btn:nth-child(5)');
    await page.keyboard.press('p');
    await page.waitForFunction(() => window.__nsp.app.screen === 'playing');
    await page.waitForFunction(() => window.__nsp.game.scene.getScene('field').tweens.getTweensOf(window.__smokeRack).length === 0);
    const less = await glitches();
    if (less.title !== 'jitter 8s' || less.num !== 'lowg 4.4s' || less.segs !== 'lowseg 6.2s' || less.scan !== 'none' || less.lost !== '2.6s' || less.seventh !== '1.4s') throw new Error(`reduced effects: ${JSON.stringify(less)}`);
    if (await shakes() !== 0) throw new Error('reduced effects still shake the rack');
    await page.screenshot({ path: `${OUT}/fx-reduced.png` });
  },
  async autopause(page) {
    // The window losing the focus mid-run pauses it, menu up; the focus coming back resumes nothing, the player does.
    await play(page);
    await stepUntil(page, (s) => s.packets.length > 0);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForSelector('#ui .ov-pause.show .btn');
    const paused = await page.evaluate(() => ({
      screen: window.__nsp.app.screen, menu: getComputedStyle(document.querySelector('#ui .ov-pause')).display, frozen: document.querySelector('#ui').classList.contains('paused'),
    }));
    if (paused.screen !== 'paused' || paused.menu !== 'flex' || !paused.frozen) throw new Error(`after a blur: ${JSON.stringify(paused)}`);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForTimeout(100);
    if (await page.evaluate(() => window.__nsp.app.screen) !== 'paused') throw new Error('the focus coming back resumed the run');
    await page.screenshot({ path: `${OUT}/autopause.png` });
    await page.keyboard.press('p');
    await page.waitForFunction(() => window.__nsp.app.screen === 'playing');
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
    // The grade stamps down, the screen thuds and the score counts up: 0.8 s at most, then the shot and the fit checks see the finished screen.
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${OUT}/debrief.png` });
    const shown = await page.evaluate(() => ({
      share: document.querySelector('#ui .share').value, mistakes: document.querySelectorAll('#ui .mistake').length,
      best: JSON.parse(localStorage.getItem('nsp.v1')).bests.campaign['analyst-normal'], grade: document.querySelector('#ui .grade').textContent,
    }));
    if (!shown.share.includes('jorius.github.io/none-shall-pass')) throw new Error('share text missing link');
    if (!shown.share.includes(' · The Black Knight · Analyst')) throw new Error(`the share line does not name the pair: ${shown.share}`);
    if (!shown.mistakes || shown.grade !== 'F' || !shown.best) throw new Error(`debrief: ${JSON.stringify(shown)}`);
    await fits(page, 'debrief');
    await widest(page);
    await page.evaluate(() => window.__nsp.app.refresh());
    await fits(page, 'debrief at its widest');
    // PLAY AGAIN: a fresh run on the same pair, straight in (no setup), nothing else carried over.
    await page.click('#ui .ov-debrief .row-btns .btn:nth-child(2)');
    await page.waitForFunction(() => window.__nsp.app.screen === 'playing');
    const fresh = await page.evaluate(() => ({ s: window.__nsp.app.run.state, rows: document.querySelectorAll('#ui .rows .row').length }));
    if (fresh.s.wave !== 1 || fresh.s.uptime !== 100 || fresh.s.log.length || fresh.rows || fresh.s.phase !== 'playing') throw new Error('PLAY AGAIN kept the last run');
    if (fresh.s.cfg.knight !== 'black' || fresh.s.cfg.difficulty !== 'analyst') throw new Error(`PLAY AGAIN changed the pair: ${JSON.stringify(fresh.s.cfg)}`);
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
    await page.click('#ui .ov-pause .btn:nth-child(4)');
    await page.keyboard.press('p');
    await stepUntil(page, (s) => s.log.length >= 3);
    await widest(page);
    await lose(page);
    await stepUntil(page, (s) => s.phase === 'ended');
    await page.waitForSelector('#ui .ov-debrief .grade');
    await page.waitForTimeout(1000);
    await fits(page, 'Spanish debrief');
    // How far the campaign got, the breaches by family, the best it had to beat, and who held the gate in the head and the share line.
    const es = await page.evaluate(() => ({
      reached: document.querySelector('#ui .statlist > div').textContent, fams: [...document.querySelectorAll('#ui .fams span')].map((e) => e.textContent),
      prev: [...document.querySelectorAll('#ui .ov-debrief .note')].map((e) => e.textContent).find((x) => /^Récord anterior/.test(x)),
      who: document.querySelector('#ui .ov-debrief p.note')?.textContent, share: document.querySelector('#ui .share').value,
    }));
    if (es.reached !== 'Oleada alcanzada6 / 6' || es.fams.length !== 5 || !es.fams[2].startsWith('fuerza bruta ') || !es.prev) throw new Error(`Spanish debrief: ${JSON.stringify(es)}`);
    if (es.who !== 'El Caballero Negro · "Nadie pasará." · Analista' || !es.share.includes(' · El Caballero Negro · Analista')) throw new Error(`the Spanish debrief's pair: ${JSON.stringify(es)}`);
    await page.screenshot({ path: `${OUT}/debrief-es.png` });
    await page.click('#ui .ov-debrief .row-btns .btn:nth-child(3)');
    await page.waitForSelector('#ui .ov-title');
    if (await page.evaluate(() => window.__nsp.app.run) !== null) throw new Error('TITLE kept the run');
  },
  async polish(page) {
    // Game feel. With full effects: the knight's hit snaps the camera and flashes the field white, a breach throws sparks off the rack, a dealt
    // hand flips in and the bought card flies to its loadout tile, and the debrief counts the score up and stamps the grade. Then the same paths
    // under reduced effects, which have none of it, and the two ends of a run: a won rack is clean and its knight hops, a lost one kneels still.
    const gold = 'rgb(217, 180, 74)', red = 'rgb(255, 47, 47)', blue = 'rgb(47, 182, 255)';
    const attack = (s) => s.packets.some((p) => p.t.kind !== 'legit' && p.x > 200 && p.x < 450 && !p.entering && !p.doomed);
    // One spear thrown and stepped to its landing in a single go: no frame runs the 60 ms flash out before it is counted (or before the shot, when held).
    const hit = (hold = false) => page.evaluate((freezeAfter) => {
      const app = window.__nsp.app, fx = window.__nsp.effects, scene = window.__nsp.game.scene.getScene('field'), s = app.run.state;
      for (let i = 0; i < 60 && s.knight.cooldown > 0; i++) app.dispatch(app.run.step(1 / 60));
      const p = s.packets.find((q) => q.t.kind !== 'legit' && q.x > 200 && q.x < 450 && !q.entering && !q.doomed);
      if (!p) throw new Error('no attack to throw at');
      const before = fx.debugFlashes();
      app.dispatch(app.run.target(p.id));
      app.dispatch(app.run.throwSpear());
      for (let i = 0; i < 600 && s.spears.length; i++) app.dispatch(app.run.step(1 / 60));
      const out = {
        dead: p.dead, flashes: fx.debugFlashes() - before, shaking: scene.cameras.main.shakeEffect.isRunning,
        veils: scene.layers.fx.list.filter((o) => o.type === 'Rectangle' && o.fillColor === 0xffffff).map((o) => [o.x, o.y, o.width, o.height, o.fillAlpha]),
      };
      if (freezeAfter) { const menu = app.onScreen; app.onScreen = null; try { app.setScreen('paused'); } finally { app.onScreen = menu; } }
      return out;
    }, hold);
    // A breach sent to the views: what the rack asked the effects for, and how many sparks it added to the air (the last burst may still be up).
    const breach = () => page.evaluate(() => {
      const app = window.__nsp.app, scene = window.__nsp.game.scene.getScene('field'), packet = app.run.state.packets.find((p) => p.t.kind !== 'legit' && !p.entering);
      if (!packet) throw new Error('no attack to land');
      const sparks = scene.layers.fx.list.find((o) => o.texture?.key === 'sparks'), before = sparks.getAliveParticleCount();
      window.__smokeSparks.length = 0;
      app.dispatch([{ type: 'resolved', packet, outcome: 'breach', damage: 10 }]);
      return { calls: [...window.__smokeSparks], fresh: sparks.getAliveParticleCount() - before, lane: packet.lane };
    });
    // The draft with the first card still to take that is not the backup taken (the backup has no tile to fly to): what flew, if anything.
    const take = () => page.evaluate(() => {
      const d = window.__nsp.app.run.state.draft, i = d.picks.findIndex((c) => c.id !== 'backup' && !d.taken.includes(c.id));
      document.querySelectorAll('#ui .ov-draft .ucard .btn')[i].click();
      const copy = document.querySelector('#ui > img.fly'), tile = [...document.querySelectorAll('#ui .loadout .ltile')].at(-1);
      if (!copy) return null;
      const anim = copy.getAnimations()[0], timing = anim.effect.getTiming();
      const last = anim.effect.getKeyframes().at(-1).transform, m = /translate\(\s*(-?[\d.]+)px,\s*(-?[\d.]+)px\)\s*scale\(\s*0?\.6\s*\)/.exec(last);
      // A copy not yet moving sits on the card's icon; its way plus the layer's scale lands its centre on the new tile's.
      const k = document.querySelector('#ui').getBoundingClientRect().width / 1280, from = copy.getBoundingClientRect(), to = tile.getBoundingClientRect();
      return {
        timing: [timing.duration, timing.easing], last,
        miss: m && [from.left + from.width / 2 + Number(m[1]) * k - (to.left + to.width / 2), from.top + from.height / 2 + Number(m[2]) * k - (to.top + to.height / 2)],
      };
    });
    // A hand dealt again (a new array is what a reroll makes) flips in at once; counted here, before any frame can run it out.
    const redeal = () => page.evaluate(() => {
      const app = window.__nsp.app, d = app.run.state.draft;
      d.picks = [...d.picks];
      app.refresh();
      return {
        places: [...document.querySelectorAll('#ui .ov-draft .ucard')].map((c) => c.style.getPropertyValue('--i')),
        flips: document.getAnimations().filter((a) => a.animationName === 'flip').map((a) => [a.effect.getTiming().delay, a.effect.getTiming().duration]).sort((x, y) => x[0] - y[0]),
      };
    });
    // A packet event sent to the views, for the fire: how bright its flash is at once, the length of the fade it starts, and whether the field was snapped.
    const flare = (kind) => page.evaluate((k) => {
      const app = window.__nsp.app, scene = window.__nsp.game.scene.getScene('field'), fx = window.__nsp.effects;
      const wall = scene.layers.objects.list.find((o) => o.type === 'Rectangle' && o.fillColor === 0x2fb6ff && o.width === 24), packet = app.run.state.packets[0];
      scene.tweens.killTweensOf(wall);
      wall.setAlpha(0);
      const snaps = fx.debugFlashes();
      app.dispatch([k === 'entered' ? { type: 'entered', packetId: packet.id } : { type: 'shattered', packet, by: 'rule', ruleId: k }]);
      return { alpha: wall.alpha, duration: scene.tweens.getTweensOf(wall)[0]?.duration ?? null, snaps: fx.debugFlashes() - snaps };
    }, kind);
    // The next card to spawn, followed frame by frame on the view clock (each frame steps the run too) until it has been clear of the gutter for 40
    // frames: its scale on the way there (the pop waits for the gutter, never on the spawn) and from there, whether the pop holds its centre, and how
    // far it rides from its lane.
    const newcomer = () => page.evaluate(([w, h, y0, gutter]) => {
      const app = window.__nsp.app, scene = window.__nsp.game.scene.getScene('field'), s = app.run.state, n = s.nextId;
      for (let i = 0; i < 1200 && s.nextId === n; i++) app.dispatch(app.run.step(1 / 60));
      const p = s.packets.at(-1), box = scene.layers.packets.list.find((o) => o.name === `packet-${p.id}`), before = [], after = [], rides = new Set();
      let off = 0, from = -1;
      for (let i = 0; i < 1500 && (from < 0 || i - from < 40); i++) {
        scene.onFrame(1000 / 60);
        const x = Math.round(p.x * 2) / 2, scale = box.scaleX;
        // Whatever its scale, the card's centre stays where it was, and what is left of its height is the bob.
        off = Math.max(off, Math.abs(box.x + scale * w / 2 - (x + w / 2)));
        rides.add(Math.round((box.y + scale * h / 2 - (p.lane * 90 + y0 + h / 2)) * 1e6) / 1e6);
        if (from < 0 && x >= gutter) from = i;
        (from < 0 ? before : after).push(scale);
      }
      return { before, after, rides: [...rides].sort(), off };
    }, [PKT_W, PKT_H, PKT_Y, LANE_X0]);
    const frames = (n) => page.evaluate((k) => { const scene = window.__nsp.game.scene.getScene('field'); for (let i = 0; i < k; i++) scene.onFrame(1000 / 60); }, n);
    // The knight's sprite height over `n` frames of the view clock (more than a second at 60), and the pose he was in.
    const heights = (n) => page.evaluate((k) => {
      const scene = window.__nsp.game.scene.getScene('field'), knight = scene.layers.actors.list.find((o) => o.texture && /^knight-/.test(o.texture.key)), ys = new Set();
      for (let i = 0; i < k; i++) { scene.onFrame(1000 / 60); ys.add(knight.y); }
      return { ys: ys.size, key: knight.texture.key };
    }, n);
    const rackNow = () => page.evaluate(() => {
      // Found by its own sprite, not its position: a breach bounces it for 300 ms.
      const scene = window.__nsp.game.scene.getScene('field'), box = scene.layers.actors.list.find((o) => o.list?.some((c) => c.texture?.key === 'rack'));
      const px = scene.textures.get('rackfire').getContext().getImageData(0, 0, 40, 150).data;
      let fire = 0;
      for (let i = 3; i < px.length; i += 4) if (px[i]) fire++;
      return {
        fire, bugs: box.list.filter((o) => /^bug-/.test(o.texture?.key ?? '')).length, tint: box.list.find((o) => o.texture?.key === 'rack').tintTopLeft,
        green: box.list.filter((o) => o.type === 'Rectangle').every((o) => o.fillColor === 0x3ddc84 && o.fillAlpha === 1),
      };
    });

    // Full effects: the knight's hit. It lands, the field is veiled in white at 35% and the camera is shaking; the veil is gone a moment later.
    await play(page);
    await page.evaluate(() => { const fx = window.__nsp.effects, real = fx.sparks.bind(fx); window.__smokeSparks = []; fx.sparks = (x, y) => { window.__smokeSparks.push([x, y]); real(x, y); }; });
    await stepUntil(page, attack);
    const snap = await hit(true);
    if (!snap.dead || snap.flashes !== 1 || JSON.stringify(snap.veils) !== '[[0,0,1280,450,0.35]]' || !snap.shaking) throw new Error(`the knight's hit: ${JSON.stringify(snap)}`);
    await page.screenshot({ path: `${OUT}/polish-flash.png` });
    await freeze(page, false);
    await page.waitForFunction(() => window.__nsp.effects.debugFlashes() === 0 && !window.__nsp.game.scene.getScene('field').cameras.main.shakeEffect.isRunning);
    // A breach: 24 sparks from the rack's face, level with the card that got in.
    await stepUntil(page, (s) => s.packets.some((p) => p.t.kind !== 'legit' && !p.entering));
    const bang = await breach();
    if (bang.calls.length !== 1 || bang.calls[0][0] !== 1132 || bang.calls[0][1] !== bang.lane * 90 + PKT_Y + PKT_H / 2 || bang.fresh !== 24) throw new Error(`the breach's sparks: ${JSON.stringify(bang)}`);
    // The fire flares brighter and longer when it takes a packet in or a rule shatters one at it; the lockdown's shatter leaves it alone, no rule's snaps the field.
    for (const kind of ['entered', 'quote']) {
      const f = await flare(kind);
      if (f.alpha !== 0.9 || f.duration !== 200 || f.snaps) throw new Error(`the fire's flare on ${kind}: ${JSON.stringify(f)}`);
    }
    const idle = await flare('lockdown');
    if (idle.alpha !== 0 || idle.duration !== null || idle.snaps) throw new Error(`the fire on the lockdown's shatter: ${JSON.stringify(idle)}`);
    // A card is full size on its way out from under the gutter and pops once it is wholly clear of it: to 90% about its centre, and back to full size,
    // overshooting a little, inside ten frames; it rides a pixel up or down on its own phase.
    const born = await newcomer(), peak = Math.max(...born.after);
    if (born.before.length < 100 || born.before.some((v) => v !== 1) || born.after[0] !== 0.9 || !(peak > 1 && peak < 1.05) || born.after.slice(10).some((v) => v !== 1)
      || born.off > 1e-6 || born.rides.length < 2 || born.rides.some((d) => Math.abs(d) > 1)) {
      throw new Error(`a new card: ${JSON.stringify({ frames: born.before.length, scaled: born.before.filter((v) => v !== 1).length, pop: born.after.slice(0, 12), late: born.after.slice(10).filter((v) => v !== 1).length, off: born.off, rides: born.rides })}`);
    }
    // The dealt hand flips in, each card after its own delay; the bought card's icon flies to the new tile in 300 ms and is gone when it lands.
    await page.evaluate(() => { const a = window.__nsp.app; a.dispatch(a.run.cheat('skip')); });
    await toDraft(page);
    await page.waitForSelector('#ui .ov-draft .ucard');
    const dealt = await redeal();
    if (JSON.stringify(dealt.places) !== '["0","1","2"]' || JSON.stringify(dealt.flips) !== '[[0,240],[120,240],[240,240]]') throw new Error(`the hand's flip: ${JSON.stringify(dealt)}`);
    const flight = await take();
    if (!flight || flight.timing[0] !== 300 || flight.timing[1] !== 'ease-in' || !flight.miss || flight.miss.some((d) => Math.abs(d) > 1)) throw new Error(`the bought card's flight: ${JSON.stringify(flight)}`);
    await page.waitForFunction(() => !document.querySelector('#ui > img.fly'));
    // The copy lands as the tile's twin at the tile's own place (the real column is under the draft's backdrop), over the screen, pulsing once; it goes with the pulse.
    const twin = await page.evaluate(() => {
      const ghost = document.querySelector('#ui > .ltile-ghost'), tile = [...document.querySelectorAll('#ui .loadout .ltile')].at(-1);
      if (!ghost) return null;
      const g = ghost.getBoundingClientRect(), t = tile.getBoundingClientRect(), cs = getComputedStyle(ghost);
      return { miss: [g.left - t.left, g.top - t.top, g.width - t.width, g.height - t.height], pulse: cs.animationName, z: cs.zIndex, clicks: cs.pointerEvents, icon: !!ghost.querySelector('img.px') };
    });
    if (!twin || twin.miss.some((d) => Math.abs(d) > 1) || twin.pulse !== 'tileflash' || twin.z !== '42' || twin.clicks !== 'none' || !twin.icon) throw new Error(`the tile's twin: ${JSON.stringify(twin)}`);
    await page.waitForFunction(() => !document.querySelector('#ui > .ltile-ghost'));
    // Another card bought and the wave started at once: the flight goes with the draft, and no twin lands on the field afterwards.
    await page.evaluate(() => { const a = window.__nsp.app; a.run.state.credits = 5000; a.refresh(); });
    if (!(await take())) throw new Error('the second card did not fly');
    await page.evaluate(() => window.__nsp.app.nextWave());
    await page.waitForFunction(() => window.__nsp.app.screen === 'playing');
    await page.waitForTimeout(450);
    if (await page.evaluate(() => !!document.querySelector('#ui > .fly, #ui > .ltile-ghost'))) throw new Error('a flight outlived its draft');

    // Reduced effects: no snap, no flash, no sparks, no flip and no flight; the hand still carries its places.
    await setReduced(page, true);
    await stepUntil(page, attack);
    const calm = await hit();
    if (!calm.dead || calm.flashes || calm.veils.length || calm.shaking) throw new Error(`reduced effects, the knight's hit: ${JSON.stringify(calm)}`);
    await stepUntil(page, (s) => s.packets.some((p) => p.t.kind !== 'legit' && !p.entering));
    const quiet = await breach();
    if (quiet.calls.length !== 1 || quiet.fresh !== 0) throw new Error(`reduced effects, the breach's sparks: ${JSON.stringify(quiet)}`);
    // The fire keeps its quieter flash for both; a card is full size from the start and rides no bob.
    for (const kind of ['entered', 'quote']) {
      const f = await flare(kind);
      if (f.alpha !== 0.6 || f.duration !== 140 || f.snaps) throw new Error(`reduced effects, the fire's flare on ${kind}: ${JSON.stringify(f)}`);
    }
    const still = await newcomer();
    if (still.after.length < 40 || [...still.before, ...still.after].some((v) => v !== 1) || still.off > 1e-6 || JSON.stringify(still.rides) !== '[0]') {
      throw new Error(`reduced effects, a new card: ${JSON.stringify({ scaled: [...still.before, ...still.after].filter((v) => v !== 1).length, after: still.after.length, off: still.off, rides: still.rides })}`);
    }
    await page.evaluate(() => { const a = window.__nsp.app; a.dispatch(a.run.cheat('skip')); });
    await toDraft(page);
    await page.waitForSelector('#ui .ov-draft .ucard');
    const flat = await redeal();
    if (JSON.stringify(flat.places) !== '["0","1","2"]' || flat.flips.length) throw new Error(`reduced effects, the hand: ${JSON.stringify(flat)}`);
    if (await take()) throw new Error('reduced effects: the bought card flew');
    await page.waitForTimeout(450);
    if (await page.evaluate(() => !!document.querySelector('#ui > .fly, #ui > .ltile-ghost'))) throw new Error('reduced effects: a twin landed');
    await page.evaluate(() => window.__nsp.app.nextWave());
    await page.waitForFunction(() => window.__nsp.app.screen === 'playing');

    // The debrief under reduced effects is simply final: the grade is not stamped, the screen does not thud, the score never counts.
    await watchDebrief(page);
    await sink(page, 12345);
    await stepUntil(page, (s) => s.phase === 'ended');
    // The packets served on the way to the end add to the score, so the figure to expect is the run's own.
    const total = await page.evaluate(() => `SCORE ${window.__nsp.app.run.state.score.toLocaleString('en-US')}`);
    await page.waitForSelector('#ui .ov-debrief .grade');
    await page.waitForTimeout(1000);
    const plain = await page.evaluate(() => ({ grade: document.querySelector('#ui .grade').className, g: document.querySelector('#ui .grade').dataset.g, ...window.__smokeDebrief }));
    if (plain.grade !== 'grade' || plain.g !== 'F' || JSON.stringify(plain.scores) !== JSON.stringify([total]) || plain.classes.some((c) => /shake/.test(c))) throw new Error(`reduced effects, the debrief: ${JSON.stringify(plain)}`);

    // Full effects again, and the same loss. The knight kneels still. The grade stamps down in its colour as the screen thuds and the score counts
    // up from 0 to its figure, never backwards; the thud ends with its own animation; and once it has played, M redraws the debrief finished.
    await page.click('#ui .ov-debrief .row-btns .btn:nth-child(2)');
    await page.waitForFunction(() => window.__nsp.app.screen === 'playing');
    await setReduced(page, false);
    await watchDebrief(page);
    await sink(page, 12345);
    await stepUntil(page, (s) => s.phase === 'ended');
    const final = await page.evaluate(() => `SCORE ${window.__nsp.app.run.state.score.toLocaleString('en-US')}`);
    const kneel = await heights(70);
    if (kneel.ys !== 1 || kneel.key !== 'knight-black-down') throw new Error(`the kneeling knight: ${JSON.stringify(kneel)}`);
    await page.waitForSelector('#ui .ov-debrief .grade.stamp');
    const colours = await page.evaluate(() => {
      const css = (sel) => getComputedStyle(document.querySelector(sel)).color, grade = document.querySelector('#ui .grade');
      return { g: grade.dataset.g, grade: css('#ui .grade'), score: css('#ui .best .num'), served: css('#ui .statlist b.ok'), breaches: css('#ui .statlist b.bad') };
    });
    if (colours.g !== 'F' || colours.grade !== red || colours.score !== gold || colours.served !== blue || colours.breaches !== red) throw new Error(`the debrief's colours: ${JSON.stringify(colours)}`);
    await page.waitForFunction((want) => window.__smokeDebrief.scores.at(-1) === want && !document.querySelector('#ui .ov.shake'), final, { timeout: 1500 });
    const { scores, classes } = await page.evaluate(() => window.__smokeDebrief);
    const counted = scores.map((t) => Number(t.replace(/\D/g, '')));
    if (scores[0] !== 'SCORE 0' || scores.length < 4 || counted.some((n, i) => i && n < counted[i - 1])) throw new Error(`the score's count: ${JSON.stringify(scores)}`);
    if (classes[0] !== 'ov show ov-debrief shake' || classes.at(-1) !== 'ov show ov-debrief') throw new Error(`the debrief's thud: ${JSON.stringify(classes)}`);
    await page.keyboard.press('m');
    const redrawn = await page.evaluate(() => ({ grade: document.querySelector('#ui .grade').className, score: document.querySelector('#ui .best b').textContent, thud: document.querySelector('#ui .ov').classList.contains('shake') }));
    if (redrawn.grade !== 'grade' || redrawn.score !== final || redrawn.thud) throw new Error(`the debrief after M: ${JSON.stringify(redrawn)}`);
    await page.keyboard.press('m');

    // A won run: the rack that was burning is put out, cleared of its bugs and its LEDs green, the knight hops (planted under reduced effects),
    // and the debrief names a grade S in gold. The run's own uptime stays 100, so the grade is S; only the rack's view was told otherwise.
    await page.click('#ui .ov-debrief .row-btns .btn:nth-child(2)');
    await page.waitForFunction(() => window.__nsp.app.screen === 'playing');
    await stepUntil(page, (s) => s.packets.some((p) => p.t.kind !== 'legit' && !p.entering));
    await page.evaluate(() => {
      const app = window.__nsp.app;
      app.dispatch([{ type: 'uptime', before: 100, after: 30 }]);
      app.dispatch([{ type: 'resolved', packet: app.run.state.packets.find((p) => p.t.kind !== 'legit' && !p.entering), outcome: 'breach', damage: 10 }]);
    });
    await frames(90);
    // The breach flashes the rack red for 320 ms of the scene's clock; waited out, its tint is the damage's own (a clean rack's is 0xfff2e6).
    await page.waitForTimeout(700);
    await frames(2);
    const burning = await rackNow();
    if (!(burning.fire > 50) || burning.bugs < 1 || burning.tint === 0xfff2e6) throw new Error(`the burning rack: ${JSON.stringify(burning)}`);
    await page.evaluate(() => { const a = window.__nsp.app; a.run.state.wave = 6; a.dispatch(a.run.cheat('skip')); });
    if (await page.evaluate(() => window.__nsp.app.run.state.endReason) !== 'won') throw new Error('clearing the last wave did not win');
    // Two frames hold one step of the fire (30 Hz): enough to show the cleared cells and the whole-colour tint, without the fire's own decay.
    await frames(2);
    const clean = await rackNow();
    if (clean.fire !== 0 || clean.bugs !== 0 || clean.tint !== 0xfff2e6 || !clean.green) throw new Error(`the won rack: ${JSON.stringify(clean)}`);
    const hop = await heights(60);
    await setReduced(page, true);
    const planted = await heights(60);
    await setReduced(page, false);
    if (hop.ys < 4 || hop.key !== 'knight-black-cheer' || planted.ys !== 1 || planted.key !== 'knight-black-cheer') throw new Error(`the cheering knight: ${JSON.stringify({ hop, planted })}`);
    await page.waitForSelector('#ui .ov-debrief .grade');
    await page.waitForTimeout(1000);
    const won = await page.evaluate(() => ({ head: document.querySelector('#ui .ov-debrief h2').textContent, g: document.querySelector('#ui .grade').dataset.g, color: getComputedStyle(document.querySelector('#ui .grade')).color }));
    if (won.head !== 'SERVER HELD' || won.g !== 'S' || won.color !== gold) throw new Error(`the won debrief: ${JSON.stringify(won)}`);
    await page.screenshot({ path: `${OUT}/polish-won.png` });
  },
  async console(page) {
    const open = async () => {
      await page.keyboard.press('`');
      await page.waitForSelector('#ui .term.show input');
      await page.waitForFunction(() => document.activeElement?.tagName === 'INPUT');
    };
    const run = async (cmd) => { await page.keyboard.type(cmd); await page.keyboard.press('Enter'); };
    // In Space Mono, the help list's second column and the nmap table's STATE and SERVICE columns each start at one x.
    const aligned = (what) => page.evaluate((w) => {
      const pre = document.querySelector('#ui .term pre'), text = pre.textContent;
      if (!/Space Mono/.test(getComputedStyle(pre).fontFamily) || !document.fonts.check('14px "Space Mono"')) return `${w}: not in Space Mono`;
      const nodes = [], walk = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
      for (let n = walk.nextNode(), at = 0; n; at += n.length, n = walk.nextNode()) nodes.push({ n, at });
      const left = (i) => {
        const { n, at } = nodes.findLast((e) => e.at <= i), r = document.createRange();
        r.setStart(n, i - at);
        r.setEnd(n, i - at + 1);
        return r.getBoundingClientRect().left;
      };
      const cols = {};
      let at = 0;
      for (const line of text.split('\n')) {
        const want = /^(\d+\/tcp|PORT) /.test(line) ? [9, 19] : /^ {2}\S.* {2,}\S/.test(line) ? [23] : [];
        for (const c of want) (cols[c] ??= []).push(left(at + c));
        at += line.length + 1;
      }
      const off = Object.entries(cols).filter(([, xs]) => xs.length < 2 || Math.max(...xs) - Math.min(...xs) > 0.5);
      return off.length || !cols[9] || !cols[23] ? `${w}: columns off ${JSON.stringify(cols)}` : '';
    }, what);
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
    const en = await aligned('English console');
    if (en) throw new Error(en);
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
    // Spanish, with its longest man page: the same columns line up.
    await spanish(page);
    await page.reload({ waitUntil: 'networkidle' });
    await play(page);
    await open();
    for (const cmd of ['help', 'man sqli', 'nmap shop.example']) await run(cmd);
    const es = await aligned('Spanish console');
    if (es) throw new Error(es);
    await page.screenshot({ path: `${OUT}/console-es.png` });
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
    await page.screenshot({ path: `${OUT}/root-title.png` });
    await play(page);
    await stepUntil(page, (s) => s.packets.filter((p) => !p.entering).length >= 3);
    // Any refresh (a language switch, the hints key) applies the mode again without stacking a second filter.
    await page.evaluate(() => { window.__nsp.app.refresh(); window.__nsp.app.refresh(); });
    // A locked target in the shot: its border and brackets are the brightest outline on the amber field.
    await page.evaluate(() => {
      const app = window.__nsp.app, p = app.run.state.packets.find((q) => !q.entering);
      p.x = 320;
      app.dispatch(app.run.target(p.id));
    });
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
  async analytics(page) {
    // The tag ships, for the site's domain only; blocked (as on every page here), it never loaded and the game plays on.
    const tag = await page.$eval('script[src="https://cloud.umami.is/script.js"]', (e) => ({ defer: e.defer, ...e.dataset }));
    if (!tag.defer || tag.websiteId !== 'f182739a-828d-4a63-81ab-07e8fd73945f' || tag.domains !== 'jorius.github.io') throw new Error(`umami tag: ${JSON.stringify(tag)}`);
    if (await page.evaluate(() => 'umami' in window)) throw new Error('the blocked tracker loaded');
    // A tracker that only records: the events carry modes and coarse numbers, never what was typed or read.
    await page.waitForSelector('#ui .ov-title .btn');
    await page.evaluate(() => { window.__sent = []; window.umami = { track: (n, d) => { window.__sent.push([n, d ?? null]); } }; });
    await play(page);
    await page.keyboard.press('`');
    await page.waitForSelector('#ui .term.show input');
    await page.waitForFunction(() => document.activeElement?.tagName === 'INPUT');
    await page.keyboard.type('nmap shop.example');
    await page.keyboard.press('Enter');
    await page.keyboard.type('skip');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__nsp.app.screen === 'draft');
    const sent = JSON.stringify(await page.evaluate(() => window.__sent));
    const want = JSON.stringify([['game-start', { mode: 'campaign', root: false, difficulty: 'analyst', knight: 'black' }], ['console-opened', null], ['wave-cleared', { mode: 'campaign', wave: 1, tampered: true }]]);
    if (sent !== want) throw new Error(`sent ${sent}`);
  },
  async phone(page) {
    // A real phone: a small touch screen with no fine pointer gets the card, and the game never boots.
    const browser = page.context().browser();
    const device = async (opts) => {
      const ctx = await browser.newContext(opts), p = await ctx.newPage(), errors = [];
      await blockTracker(ctx);
      p.on('pageerror', (e) => errors.push(e.stack ?? e.message));
      p.on('console', (m) => { if (unexpected(m)) errors.push(m.text()); });
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
      await blockTracker(page);
      page.on('pageerror', (e) => errors.push(e.stack ?? e.message));
      page.on('console', (m) => { if (unexpected(m)) errors.push(m.text()); });
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

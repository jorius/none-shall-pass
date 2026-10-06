// Pixel-art workbench for the v4 mocks: grids use the game's palette and are outlined like src/art/pixels.ts.
window.NSPART = (() => {
  const PAL = { o:'#0b0c10', l:'#8f9bb3', w:'#d5dceb', m:'#5d6680', d:'#3a4152', k:'#1b1d24', R:'#ff2f2f', r:'#a3161c', B:'#2fb6ff', b:'#16608f', T:'#a0703a', t:'#6b4722', S:'#eef2f7', s:'#a7b2c4', y:'#d9b44a', Y:'#d9b44a', h:'#cfc9ba', H:'#958f81', n:'#6d685d', c:'#2a2c35', C:'#3a3d4a', g:'#3ddc84', G:'#1f8a50', X:'#a8432a', x:'#7a2a1a', p:'#e2b48c', P:'#b9825c', a:'#c8a46a', A:'#8f6f3e', j:'#8fdcff', i:'#e8f8ff', E:'#c9d4e2', u:'#b48cff', q:'#6e4bb5' };
  const grid = (w, h) => Array.from({ length: h }, () => Array(w).fill(null));
  const rowsToGrid = (rows) => rows.map((r) => [...r].map((c) => (c === '.' ? null : c)));
  const set = (g, x, y, c) => { if (g[y] && x >= 0 && x < g[0].length) g[y][x] = c; };
  const draw = (g, rows) => { for (const [y, x0, s] of rows) [...s].forEach((ch, i) => { if (ch !== '.') set(g, x0 + i, y, ch); }); return g; };
  const outline = (g) => { const o = g.map((r) => r.slice()); g.forEach((r, y) => r.forEach((c, x) => { if (c) return; if ([[0,1],[1,0],[0,-1],[-1,0]].some(([dy, dx]) => g[y + dy]?.[x + dx] && g[y + dy][x + dx] !== 'o')) o[y][x] = 'o'; })); return o; };
  // Fills the cells whose centre lies in the ring r0 <= d < r1 around (cx, cy); keep(x, y, d) narrows it.
  const disc = (g, cx, cy, r0, r1, c, keep) => g.forEach((row, y) => row.forEach((_, x) => { const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy); if (d >= r0 && d < r1 && (!keep || keep(x, y, d))) set(g, x, y, c); }));
  // Same as disc, for an ellipse with radii rx, ry; keep(x, y, d) gets the normalised distance (1 = the edge).
  const ell = (g, cx, cy, rx, ry, c, keep) => g.forEach((row, y) => row.forEach((_, x) => { const u = (x + 0.5 - cx) / rx, v = (y + 0.5 - cy) / ry, d = u * u + v * v; if (d < 1 && (!keep || keep(x, y, d))) set(g, x, y, c); }));
  const paint = (cv, g, s, pal = {}) => { cv.width = g[0].length * s; cv.height = g.length * s; const x = cv.getContext('2d'); g.forEach((r, yy) => r.forEach((c, xx) => { if (c) { x.fillStyle = pal[c] ?? PAL[c] ?? '#f0f'; x.fillRect(xx * s, yy * s, s, s); } })); };

  // ---------- icons, 16×14 like ICONS in src/art/sprites.ts ----------
  // One flat shield for the whole SERVER branch: a dark-blue rim, a flat blue field, and a different mark on each.
  const shieldBase = () => draw(grid(16, 14), [[1, 3, 'bbbbbbbbb'], [2, 3, 'bBBBBBBBb'], [3, 3, 'bBBBBBBBb'], [4, 3, 'bBBBBBBBb'], [5, 3, 'bBBBBBBBb'], [6, 3, 'bBBBBBBBb'], [7, 4, 'bBBBBBb'], [8, 4, 'bBBBBBb'], [9, 5, 'bBBBb'], [10, 6, 'bBb'], [11, 7, 'b']]);
  const marked = (cells, c = 'w') => { const g = shieldBase(); cells.forEach(([x, y]) => set(g, x, y, c)); return outline(g); };
  const ICON = {
    // today's tape icon, copied from src/art/sprites.ts for the before/after
    oldTape: () => outline(draw(grid(16, 14), [[2, 1, 'kkkkkkkkkkkkk'], [3, 1, 'kllkkkkkkllkk'], [4, 1, 'klwlkkkklwlkk'], [5, 1, 'kllkkkkkkllkk'], [6, 1, 'kkkkkkkkkkkkk'], [7, 1, 'kkkTTTTTTTkkk'], [8, 1, 'kkkkkkkkkkkkk']])),
    // the tick is today's exact mark; only the lit left rim and the shaded right rim are gone
    shieldTick: () => marked([[5, 5], [6, 6], [7, 6], [7, 7], [8, 5], [9, 4], [10, 3]]),
    shieldQ: () => marked([[6, 2], [7, 2], [8, 2], [5, 3], [9, 3], [9, 4], [8, 5], [7, 6], [7, 8]]),
    shieldCode: () => marked([[6, 3], [5, 4], [6, 5], [8, 3], [9, 4], [8, 5]]),
    shieldKey: () => marked([[6, 2], [7, 2], [8, 2], [6, 3], [8, 3], [6, 4], [7, 4], [8, 4], [7, 5], [7, 6], [7, 7], [7, 8], [8, 6], [8, 8]], 'y'),
    // an almond eye: lid line, white, blue iris, black pupil with a glint
    eye: () => outline(rowsToGrid([
      '................',
      '................',
      '......dddd......',
      '....ddSSSSdd....',
      '..ddSSSBBSSSdd..',
      '.dSSSSBbbBSSSSd.',
      'dSSSSBbikbBSSSSd',
      'dSSSSBbkkbBSSSSd',
      '.dSSSSBbbBSSSSd.',
      '..ddSSSBBSSSdd..',
      '....ddSSSSdd....',
      '......dddd......',
      '................',
      '................',
    ])),
    // a round lens: true circle rim, glass, a glint, and a handle that comes out from under the rim
    lens: () => {
      const g = grid(16, 14);
      disc(g, 6.5, 5.5, 0, 3.6, 'j');
      disc(g, 6.5, 5.5, 3.6, 5.2, 'l');
      set(g, 4, 3, 'i'); set(g, 5, 3, 'i'); set(g, 4, 4, 'i');
      // a solid handle, three cells thick, drawn after the rim so it visibly enters it
      set(g, 10, 7, 'T'); set(g, 9, 8, 'T');
      for (let i = 0; i < 6; i++) { set(g, 10 + i, 8 + i, 'T'); set(g, 11 + i, 8 + i, 'T'); set(g, 10 + i, 9 + i, 't'); }
      return outline(g);
    },
    // prepared statements: a form field whose value is a placeholder
    field: () => {
      const g = grid(16, 14);
      draw(g, [[2, 1, 'hhhhhhhhhhhhhh'], [11, 1, 'hhhhhhhhhhhhhh']]);
      for (let y = 3; y <= 10; y++) { set(g, 1, y, 'h'); set(g, 14, y, 'h'); for (let x = 2; x <= 13; x++) set(g, x, y, 'k'); }
      draw(g, [[3, 6, 'BBBB'], [4, 5, 'B'], [4, 10, 'B'], [5, 10, 'B'], [6, 9, 'B'], [7, 8, 'B'], [9, 8, 'B']]);
      return outline(g);
    },
    // prepared statements, take three: a syringe with a green check — the server is immunised against injection
    syringe: () => {
      const g = grid(16, 14);
      const centers = [[10, 4], [9, 5], [8, 6], [7, 7], [6, 8], [5, 9]];
      centers.forEach(([cx, cy], i) => { set(g, cx - 1, cy - 1, 'h'); set(g, cx + 1, cy + 1, 'h'); set(g, cx, cy, i === 0 ? 'd' : i < 3 ? 'w' : 'B'); });
      draw(g, [[2, 10, 'h'], [3, 11, 'h'], [4, 12, 'h']]);
      draw(g, [[2, 12, 'd'], [1, 13, 'd'], [2, 14, 'd'], [0, 12, 'd']]);
      draw(g, [[10, 4, 's'], [11, 3, 's'], [12, 2, 's']]);
      draw(g, [[9, 14, 'g'], [10, 13, 'gg'], [11, 10, 'g'], [11, 12, 'gg'], [12, 10, 'ggg']]);
      return outline(g);
    },
    // prepared statements A: the database with a brass padlock hung on its front
    dbLock: () => {
      const g = grid(16, 14);
      for (let y = 3; y <= 11; y++) for (let x = 1; x <= 10; x++) set(g, x, y, 'l');
      ell(g, 6, 11, 5, 2.2, 'm', (x, y) => y >= 11);
      for (const cy of [5.8, 8.6]) ell(g, 6, cy, 5, 2.0, 'm', (x, y, d) => d >= 0.4 && y + 0.5 > cy);
      ell(g, 6, 3, 5, 2.2, 'w');
      ell(g, 6, 3, 5, 2.2, 'l', (x, y, d) => d >= 0.45);
      draw(g, [[6, 10, 'kkk'], [7, 10, 'k.k'], [8, 10, 'k.k'], [9, 9, 'yyyyy'], [10, 9, 'yykyy'], [11, 9, 'yykyy'], [12, 9, 'yyyyy']]);
      return outline(g);
    },
    // prepared statements B: a puzzle piece — a value only fits the slot the query left for it
    puzzle: () => {
      const g = grid(16, 14);
      for (let y = 3; y <= 11; y++) for (let x = 3; x <= 11; x++) set(g, x, y, 'u');
      draw(g, [[1, 6, 'uuu'], [2, 6, 'uuu']]);
      [[11, 6], [11, 7], [11, 8], [10, 7]].forEach(([x, y]) => set(g, x, y, null));
      return outline(g);
    },
    // prepared statements C: a plug going into a socket — parameters plug into fixed slots
    plug: () => {
      const g = grid(16, 14);
      for (let y = 3; y <= 10; y++) for (let x = 9; x <= 14; x++) set(g, x, y, x === 9 ? 'H' : 'h');
      draw(g, [[5, 9, 'kk'], [8, 9, 'kk'], [5, 5, 'llll'], [8, 5, 'llll']]);
      for (let y = 4; y <= 9; y++) for (let x = 1; x <= 4; x++) set(g, x, y, y === 4 ? 'm' : 'd');
      draw(g, [[6, 0, 'k'], [7, 0, 'k']]);
      return outline(g);
    },
    // MFA + SSH keys: the key and token from the v3 round, restored as they were
    key: () => outline(draw(grid(16, 14), [[3, 1, 'yyyy'], [4, 0, 'yy..yy'], [5, 0, 'y....yyyyyyyyy'], [6, 0, 'y....yyyyyyyyy'], [7, 0, 'yy..yy...y.yy'], [8, 1, 'yyyy....y.y'], [10, 10, 'ccccc'], [11, 10, 'cgcgc'], [12, 10, 'ccccc']])),
    // output encoding + CSP: a comment bubble whose <> stays text
    bubble: () => {
      const g = grid(16, 14);
      draw(g, [[1, 2, 'HHHHHHHHHHHH'], [2, 1, 'HhhhhhhhhhhhhH'], [3, 1, 'HhhhhhhhhhhhhH'], [4, 1, 'HhhhhhhhhhhhhH'], [5, 1, 'HhhhhhhhhhhhhH'], [6, 1, 'HhhhhhhhhhhhhH'], [7, 1, 'HhhhhhhhhhhhhH'], [8, 1, 'HhhhhhhhhhhhhH'], [9, 2, 'HHHHHHHHHHHH'], [10, 3, 'HhH'], [11, 3, 'HH'], [12, 3, 'H']]);
      draw(g, [[3, 5, 'b'], [4, 4, 'b'], [5, 3, 'b'], [6, 4, 'b'], [7, 5, 'b'], [3, 9, 'b'], [4, 10, 'b'], [5, 11, 'b'], [6, 10, 'b'], [7, 9, 'b']]);
      return outline(g);
    },
    // fail2ban: the red "no" sign over a grey person
    ban: () => {
      const g = grid(16, 14);
      disc(g, 8, 7, 0, 4.7, 'S');
      disc(g, 8, 4.9, 0, 1.7, 'm');
      disc(g, 8, 11.2, 0, 3.4, 'm', (x, y) => y >= 8 && y <= 10);
      disc(g, 8, 7, 0, 4.7, 'R', (x, y) => Math.abs((x + 0.5 - 8) - (y + 0.5 - 7)) < 1.2);
      disc(g, 8, 7, 4.7, 6.4, 'R');
      return outline(g);
    },
    // restore from backup: the classic database, a cylinder seen from slightly above, plus a green restore arrow
    db: () => {
      const g = grid(16, 14);
      for (let y = 3; y <= 11; y++) for (let x = 1; x <= 11; x++) set(g, x, y, 'l');
      ell(g, 6.5, 11, 5.5, 2.2, 'm', (x, y) => y >= 11);
      for (const cy of [5.8, 8.6]) ell(g, 6.5, cy, 5.5, 2.0, 'm', (x, y, d) => d >= 0.4 && y + 0.5 > cy);
      ell(g, 6.5, 3, 5.5, 2.2, 'w');
      ell(g, 6.5, 3, 5.5, 2.2, 'l', (x, y, d) => d >= 0.45);
      draw(g, [[4, 14, 'g'], [5, 13, 'ggg'], [6, 14, 'g'], [7, 14, 'g'], [8, 14, 'g'], [9, 14, 'g'], [10, 14, 'g']]);
      return outline(g);
    },
    // tarpit A: a packet sinking into black tar
    tarpit: () => {
      const g = grid(16, 14);
      draw(g, [[2, 4, 'hhhhhhhh'], [3, 4, 'hHhhhhHh'], [4, 4, 'hhHhhHhh'], [5, 4, 'hhhHHhhh'], [6, 4, 'hhhhhhhh'], [7, 4, 'hhhhhhhh']]);
      disc(g, 8, 10.5, 0, 7.2, 'k', (x, y) => y >= 7 && Math.abs(y + 0.5 - 10.5) < 3.2);
      for (let x = 0; x < 16; x++) if (g[7][x] === 'k') set(g, x, 7, 'c');
      disc(g, 3.5, 9.5, 0, 1.1, 'C'); disc(g, 12, 10, 0, 1.3, 'C'); set(g, 9, 11, 'C');
      return outline(g);
    },
    // tarpit B: a snail
    snail: () => {
      const g = grid(16, 14);
      // the foot runs under the shell and out the back; the head and two eye stalks lead
      draw(g, [[8, 1, 'aaa'], [9, 0, 'aaaaa'], [10, 0, 'aaaaaaaaaaaaaa'], [11, 1, 'AAAAAAAAAAAAA']]);
      draw(g, [[7, 1, 'A'], [6, 1, 'A'], [5, 1, 'k'], [4, 1, 'k'], [7, 3, 'A'], [6, 3, 'A'], [5, 3, 'k'], [4, 3, 'k']]);
      disc(g, 10, 6.5, 0, 4.6, 'X');
      disc(g, 10, 6.5, 0, 1.0, 'k');
      disc(g, 10, 6.5, 1.8, 2.7, 'k', (x, y) => Math.atan2(y + 0.5 - 6.5, x + 0.5 - 10) > -2.2);
      disc(g, 10, 6.5, 3.4, 4.2, 'k', (x, y) => { const t = Math.atan2(y + 0.5 - 6.5, x + 0.5 - 10); return t > 0.6 && t < 3.0; });
      return outline(g);
    },
  };

  // ---------- knights: the body from src/art/sprites.ts, with the old gear or the new ----------
  const SHIELD_OLD = (x, y) => [[y, x, 'llllll'], [y + 1, x, 'lBBBBb'], [y + 2, x, 'lBBwBb'], [y + 3, x, 'lBwwwb'], [y + 4, x, 'lBBwBb'], [y + 5, x, 'lBBwBb'], [y + 6, x + 1, 'lBBb'], [y + 7, x + 1, 'lBb'], [y + 8, x + 2, 'lb'], [y + 9, x + 2, 'l']];
  const SPEAR_OLD = () => { const r = [[1, 17, 'S'], [2, 16, 'sSs'], [3, 16, 'sSs'], [4, 16, 'sSs'], [5, 17, 'S'], [6, 17, 's']]; for (let y = 7; y <= 28; y++) r.push([y, 17, 'T']); return r; };
  // A heater shield: 9 wide, 12 tall, a lit rim, a dark inner border and the knight's emblem centred.
  const EMBLEM = {
    cross: ['bBBwBBb', 'bBwwwBb', 'bBBwBBb', 'bBBwBBb'],
    eye: ['bBwwwBb', 'bwwkwwb', 'bBwwwBb', 'bBBBBBb'],
    blade: ['bBBwBBb', 'bBBwBBb', 'bBwwwBb', 'bBByBBb'],
    split: ['bAAABBb', 'bAAABBb', 'bAAABBb', 'bAAABBb'],
    mask: ['bBBBBBb', 'bBkBkBb', 'bBBBBBb', 'bBkkkBb'],
    gear: ['bBwBwBb', 'bBwkwBb', 'bBwBwBb', 'bBBBBBb'],
    glasses: ['bBBBBBb', 'bggBggb', 'bBBBBBb', 'bBBBBBb'],
    mask2: ['bSSSSSb', 'bSkSkSb', 'bSSSSSb', 'bBSSSBb'],
    prompt: ['bBwBBBb', 'bBBwBBb', 'bBwBBBb', 'bBBBwwb'],
  };
  const SHIELD_NEW = (x, y, em) => {
    const e = EMBLEM[em] ?? EMBLEM.cross;
    const rows = ['lllllllll', 'lbbbbbbbd', ...e.map((r) => `l${r}d`), 'lbBBBBBbd', '.lbBBBbd.', '.lbBBBbd.', '..lbBbd..', '...lbd...', '....d....'];
    return rows.map((s, i) => [y + i, x, s]);
  };
  // A leaf-shaped head, a gold socket, a pennant, a wrapped shaft and a butt cap.
  const SPEAR_NEW = () => {
    const r = [[0, 18, 'S'], [1, 17, 'sSS'], [2, 17, 'sSS'], [3, 17, 'sSw'], [4, 17, 'ssS'], [5, 18, 's'], [6, 18, 'y'], [7, 18, 'y']];
    r.push([8, 14, 'RRRR'], [9, 15, 'rRR'], [10, 16, 'rR'], [11, 17, 'r']);
    for (let y = 8; y <= 27; y++) r.push([y, 18, y % 5 === 0 ? 't' : 'T']);
    r.push([28, 18, 'm']);
    return r;
  };
  const HELM = (x, y, o) => {
    const rows = [];
    const braid = [[y + 2, x + 8, 'Y'], [y + 3, x + 8, 'YY'], [y + 4, x + 9, 'YY'], [y + 5, x + 8, 'YY'], [y + 6, x + 9, 'YY'], [y + 7, x + 8, 'YY'], [y + 8, x + 9, 'YY'], [y + 9, x + 9, 'Y'], [y + 10, x + 9, 'y'], [y + 11, x + 9, 'Y'], [y + 12, x + 10, 'y']];
    if (o.plume) rows.push([y - 4, x + 5, 'RR'], [y - 3, x + 4, 'RRRR'], [y - 2, x + 4, 'RRrrr'], [y - 1, x + 5, 'R'], [y - 1, x + 7, 'rrr']);
    // goggles pushed up on the helmet instead of a plume
    if (o.goggles) rows.push([y - 2, x + 1, 'yjy.yjy'], [y - 1, x + 1, 'yjyyyjy']);
    // a cowl with a lit edge, a platinum fringe, green eyes in the dark and a scarf over the mouth
    if (o.hood2) {
      rows.push([y - 3, x + 3, 'mmm'], [y - 2, x + 2, 'mcccm'], [y - 1, x + 1, 'mcccccm'], [y, x, 'mccccccm'], [y + 1, x, 'mcEEEEcm'], [y + 2, x, 'mckgkgkm'],
        [y + 3, x, 'mckkkkkm'], [y + 4, x, 'mcGGGGcm'], [y + 5, x, 'mccccccm'], [y + 6, x + 1, 'mccccm'], [y + 7, x + 2, 'mmmm']);
      return rows;
    }
    if (o.hood) {
      if (o.braid) rows.push(...braid);
      rows.push([y - 2, x + 2, 'cccc'], [y - 1, x + 1, 'cCCCCc'], [y, x, 'cCCCCCCc'], [y + 1, x, 'cCkkkCCc'], [y + 2, x, 'ckggkkCc'], [y + 3, x, 'ckkkkkCc'], [y + 4, x, 'cCkkkCCc'], [y + 5, x, 'cCCCCCCc'], [y + 6, x + 1, 'cCCCCc'], [y + 7, x + 2, 'cccc']);
      return rows;
    }
    if (o.braid) rows.push(...braid);
    rows.push([y, x + 1, 'llmmmd'], [y + 1, x, 'lwlmmmmd'], [y + 2, x, 'llmmmmmd']);
    if (o.face === 'open') rows.push([y + 3, x, 'mpppmmmd'], [y + 4, x, 'mkppPmdd'], [y + 5, x, 'mppPmmdd']);
    else rows.push([y + 3, x, 'RRRRmmmd'], [y + 4, x, 'kkmmmmdd'], [y + 5, x, 'lmkmmmdd']);
    if (o.beard === 'red') rows.push([y + 6, x + 1, 'XXXXdd'], [y + 7, x + 2, 'xXXx']);
    else if (o.beard) rows.push([y + 6, x + 1, 'ttTtdd'], [y + 7, x + 2, 'tTtt']);
    else rows.push([y + 6, x + 1, 'mmmmdd'], [y + 7, x + 2, 'dddd']);
    return rows;
  };
  const CHEST = {
    cross: [[15, 7, 'dkkRkkmdd'], [16, 7, 'dkkRkkmd'], [17, 7, 'dkRRRkmd'], [18, 7, 'dkkRkkmd'], [19, 7, 'dkkRkkdd']],
    plain: [[15, 7, 'dRRRRRmdd'], [16, 7, 'dRRRRRmd'], [17, 7, 'dRRwRRmd'], [18, 7, 'dRRRRRmd'], [19, 7, 'dRRRRRdd']],
    chevron: [[15, 7, 'dRkkkRmdd'], [16, 7, 'dkRkRkmd'], [17, 7, 'dkkRkkmd'], [18, 7, 'dkkkkkmd'], [19, 7, 'dkkkkkdd']],
    split: [[15, 7, 'dAAARRmdd'], [16, 7, 'dAAARRmd'], [17, 7, 'dAAARRmd'], [18, 7, 'dAAARRmd'], [19, 7, 'dAAARRdd']],
    // a dark cloak with a green clasp (Ghost); a leather apron with brass rivets (Forge)
    cloak: [[15, 7, 'dcccccmdd'], [16, 7, 'dcgccccmd'], [17, 7, 'dcccccmd'], [18, 7, 'dcccccmd'], [19, 7, 'dcccccdd']],
    apron: [[15, 7, 'dtTTTtmdd'], [16, 7, 'dtTyTtmd'], [17, 7, 'dtTTTtmd'], [18, 7, 'dtTyTtmd'], [19, 7, 'dtTTTtdd']],
  };
  const knight = (o, gear = 'new') => {
    const rows = gear === 'new' ? SPEAR_NEW() : SPEAR_OLD();
    rows.push(...HELM(5, 5, o));
    rows.push([13, 4, 'llmdmmmdmmd'], [14, 3, 'lwlmdmmmdmmmd'], ...CHEST[o.chest ?? 'cross'], [20, 7, 'ttttyttt'],
      [21, 7, 'mmd'], [21, 11, 'mmd'], [22, 7, 'lmd'], [22, 11, 'mmd'], [23, 7, 'lmd'], [23, 11, 'mmd'], [24, 7, 'mmd'], [24, 11, 'mdd'],
      [25, 7, 'lmd'], [25, 11, 'mmd'], [26, 7, 'lmd'], [26, 11, 'mmd'], [27, 5, 'llmmd'], [27, 11, 'mmmd']);
    rows.push(gear === 'new' ? [15, 15, 'mlld'] : [15, 16, 'mld'], gear === 'new' ? [16, 15, 'dmmd'] : [16, 16, 'dmd']);
    rows.push(...(gear === 'new' ? SHIELD_NEW(0, 14, o.shield ?? 'cross') : SHIELD_OLD(1, 14)));
    return outline(draw(grid(21, 30), rows));
  };

  // ---------- squire v2: a man-at-arms in training. Kettle hat over a mail coif, a quilted gambeson with the knight's
  // red cross, a round buckler, a short spear with the same pennant. Shaded like the knight, smaller and lighter.
  const squire = (throwing) => {
    const g = rowsToGrid([
      '.....................',
      '.....................',
      '......lllll..........',
      '.....lwlllll.........',
      '.....llllllm.........',
      '...ddddddddddd.......',
      '....spkpppPPs........',
      '....spppppPPs........',
      '....sppPPPPPs........',
      '.....ssppPPss........',
      '......ssssss.........',
      '....aaaaaaaaa........',
      '...aaaaaaaaaaA.......',
      '..lllaaaRaaaaAA......',
      '.lmwmlaRRRaaaaAA.....',
      '.lmmmlaaRaaaaAAA.....',
      '..lllaaaaaaaaA.......',
      '....aAaAaAaAa........',
      '....aaaaaaaaa........',
      '....ttttytttt........',
      '....aaaaaaaaa........',
      '....aAaaAaaAa........',
      '.....nn...nn.........',
      '.....Hn...Hn.........',
      '.....Hn...Hn.........',
      '.....Hn...Hn.........',
      '.....tt...tt.........',
      '....ttt...ttt........',
      '...tttt...tttt.......',
      '.....................',
    ]);
    if (!throwing) {
      draw(g, [[0, 18, 'S'], [1, 17, 'sSS'], [2, 17, 'sSw'], [3, 17, 'ssS'], [4, 18, 's'], [5, 18, 'y'], [6, 14, 'RRRR'], [7, 15, 'rRR'], [8, 16, 'rR']]);
      for (let y = 6; y <= 28; y++) if (!g[y][18]) g[y][18] = 'T';
      draw(g, [[14, 16, 'pp'], [15, 16, 'pp']]);
    } else {
      draw(g, [[1, 3, 'SsTTTTTTTTTTTT'], [0, 4, 's'], [2, 4, 's'], [2, 15, 'pp'], [3, 15, 'p'], [4, 14, 'Ap'], [5, 14, 'A'], [6, 13, 'AA'], [7, 13, 'A'], [8, 13, 'A'], [9, 13, 'A'], [10, 12, 'A']]);
    }
    return outline(g);
  };

  return { PAL, paint, ICON, knight, squire };
})();

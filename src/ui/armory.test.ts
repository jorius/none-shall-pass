// @vitest-environment jsdom
// packages
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// core
import { CARDS } from '../core/content/cards';

// i18n
import { setLang } from '../i18n';

// local
import { armoryEntries, renderArmory, stateText, type ArmoryDeps, type ArmoryEntry } from './armory';

// jsdom has no canvas to paint the icons on.
vi.mock('../art/dataurl', () => ({ iconUrl: (icon: string, size: string) => `data:image/png;${icon}-${size}` }));

describe('armoryEntries', () => {
  it('lists every upgrade once, grouped by level, with its state for this run', () => {
    const e = armoryEntries(['lockdown', 'destrier', 'obs1', 'obs2', 'f2b', 'prepared']);
    expect(e.map((x) => x.id)).toEqual(['destrier', 'obs1', 'squire', 'lens', 'lockdown', 'quote', 'f2b', 'tarpit', 'cdn', 'prepared', 'sortlist', 'mfa', 'csp', 'backup']);
    const d = e.find((x) => x.id === 'destrier')!;
    expect(d.levels.map((l) => [l.id, l.owned, l.next])).toEqual([['destrier', true, false], ['destrier2', false, true], ['destrier3', false, false]]);
    expect(e.find((x) => x.id === 'lockdown')!.state).toBe('start');
    expect(e.find((x) => x.id === 'f2b')!.state).toBe('owned');
    expect(e.find((x) => x.id === 'backup')!.state).toBe('oneShot');
    expect(e.find((x) => x.id === 'squire')!.state).toBe('draft');
    const o = e.find((x) => x.id === 'obs1')!;
    expect(o.levels.map((l) => l.owned)).toEqual([true, true, false]);
  });

  it('folds each chain into one entry, whatever the run holds, and gives a single card no levels', () => {
    for (const owned of [[], ['destrier3', 'obs3'], CARDS.map((c) => c.id)] as const) {
      const e = armoryEntries(owned);
      expect(e).toHaveLength(14);
      // Every card of the game is on the screen once: as an entry or as a level of one.
      expect(e.flatMap((x) => (x.levels.length ? x.levels.map((l) => l.id) : [x.id])).sort()).toEqual(CARDS.map((c) => c.id).sort());
    }
    const e = armoryEntries([]);
    expect(e.filter((x) => x.family).map((x) => [x.id, x.family, x.levels.length])).toEqual([['destrier', 'destrier', 3], ['obs1', 'obs', 3]]);
    expect(e.filter((x) => !x.family).every((x) => x.levels.length === 0)).toBe(true);
  });

  it('prices an entry by its next level, walks a chain one level at a time, and falls back to the first when it is all owned', () => {
    const by = (owned: Parameters<typeof armoryEntries>[0], id: string): ArmoryEntry => armoryEntries(owned).find((x) => x.id === id)!;
    const d0 = by([], 'destrier');
    expect([d0.state, d0.price]).toEqual(['draft', 1000]);
    expect(d0.levels.map((l) => [l.next, l.price])).toEqual([[true, 1000], [false, 600], [false, 1000]]);
    const d2 = by(['destrier', 'destrier2'], 'destrier');
    expect([d2.state, d2.price]).toEqual(['owned', 1000]);
    expect(d2.levels.map((l) => [l.owned, l.next])).toEqual([[true, false], [true, false], [false, true]]);
    expect(by(['obs1'], 'obs1').price).toBe(600);
    const all = by(['obs1', 'obs2', 'obs3'], 'obs1');
    expect([all.state, all.price, all.levels.some((l) => l.next)]).toEqual(['owned', 250, false]);
    expect(['quote', 'tarpit', 'squire', 'backup', 'lockdown'].map((id) => by([], id).price)).toEqual([250, 600, 600, 250, 250]);
  });

  it('keeps the start card lit and the one-shot a one-shot, owned or not', () => {
    expect(armoryEntries([]).find((x) => x.id === 'lockdown')!.state).toBe('start');
    expect(armoryEntries(['backup']).find((x) => x.id === 'backup')!.state).toBe('oneShot');
  });

  it('locks a card whose requirement is not owned, and names it', () => {
    // No card ships like that (the chained levels fold into their entry), so the rule is checked on a made-up requirement.
    const cards = CARDS.map((c) => (c.id === 'quote' ? { ...c, req: 'prepared' as const } : c));
    const locked = armoryEntries([], cards).find((x) => x.id === 'quote')!;
    expect([locked.state, locked.needs]).toEqual(['locked', 'prepared']);
    const open = armoryEntries(['prepared'], cards).find((x) => x.id === 'quote')!;
    expect([open.state, open.needs]).toEqual(['draft', undefined]);
    // Owning it wins over the requirement.
    expect(armoryEntries(['quote'], cards).find((x) => x.id === 'quote')!.state).toBe('owned');
  });
});

describe('stateText', () => {
  afterEach(() => setLang('en'));

  it('writes the state line of each state, with the price or the card it needs', () => {
    const entry = (over: Partial<ArmoryEntry>): ArmoryEntry => ({ id: 'quote', family: null, levels: [], state: 'draft', price: 250, ...over });
    expect([entry({ state: 'owned' }), entry({ state: 'start' }), entry({ state: 'draft', price: 1000 }), entry({ state: 'oneShot' }), entry({ state: 'locked', needs: 'prepared' })].map(stateText)).toEqual([
      'OWNED', 'OWNED · START', 'IN THE DRAFT · 1,000', 'ONE SHOT · 250', 'LOCKED · needs Prepared statements',
    ]);
    setLang('es');
    expect([entry({ state: 'owned' }), entry({ state: 'start' }), entry({ state: 'draft', price: 1000 }), entry({ state: 'oneShot' }), entry({ state: 'locked', needs: 'prepared' })].map(stateText)).toEqual([
      'TUYO', 'TUYO · INICIO', 'EN EL SORTEO · 1.000', 'UN SOLO USO · 250', 'BLOQUEADO · requiere Sentencias preparadas',
    ]);
  });

  it('adds the level to an owned chain', () => {
    const d = armoryEntries(['destrier', 'destrier2']).find((x) => x.id === 'destrier')!;
    expect(stateText(d)).toBe('OWNED · LEVEL 2 OF 3');
    setLang('es');
    expect(stateText(d)).toBe('TUYO · NIVEL 2 DE 3');
  });
});

describe('renderArmory', () => {
  let box: HTMLElement, closed: number;
  const mount = (over: Partial<ArmoryDeps> = {}): void => renderArmory(box, { owned: ['lockdown'], credits: 820, close: () => { closed++; }, ...over });
  const card = (id: string): HTMLButtonElement => box.querySelector<HTMLButtonElement>(`.cx[data-id="${id}"]`)!;
  const hover = (id: string): void => { card(id).dispatchEvent(new Event('mouseenter')); };
  const text = (sel: string, root: ParentNode = box): string | undefined => root.querySelector(sel)?.textContent ?? undefined;
  beforeEach(() => {
    document.body.innerHTML = '';
    box = document.createElement('div');
    document.body.append(box);
    closed = 0;
  });
  afterEach(() => setLang('en'));

  it('renders three columns with a detail panel that follows the focus', () => {
    mount();
    expect(box.querySelectorAll('.ar-col').length).toBe(3);
    expect(box.querySelectorAll('.cx').length).toBe(14);
    (box.querySelector('.cx[data-id="tarpit"]') as HTMLElement).dispatchEvent(new Event('mouseenter'));
    expect(box.querySelector('.ar-detail h6')?.textContent).toBe('Tarpit');
    expect(box.querySelector('.ar-detail .stat')?.textContent).toContain('600');
  });

  it('puts each upgrade in its branch, in the order of the draft', () => {
    mount();
    const cols = [...box.querySelectorAll('.ar-col')].map((c) => ({ cls: c.className, head: text('h5', c), ids: [...c.querySelectorAll<HTMLElement>('.cx')].map((x) => x.dataset.id) }));
    expect(cols).toEqual([
      { cls: 'ar-col KNIGHT', head: 'KNIGHT · read & act', ids: ['destrier', 'obs1', 'squire', 'lens'] },
      { cls: 'ar-col FIREWALL', head: 'FIREWALL · rules at the door', ids: ['lockdown', 'quote', 'f2b', 'tarpit', 'cdn'] },
      { cls: 'ar-col SERVER', head: 'SERVER · fix the code', ids: ['prepared', 'sortlist', 'mfa', 'csp', 'backup'] },
    ]);
    // A column is its head and its cards: the stylesheet lays the three heads and the three card stacks on shared rows,
    // so the first cards share a top line however many lines a head takes.
    expect([...box.querySelectorAll('.ar-col')].map((c) => [...c.children].map((x) => x.tagName.toLowerCase() + (x.className ? `.${x.className}` : '')))).toEqual(Array(3).fill(['h5', 'div.ar-cards']));
    expect(box.querySelectorAll('.ar-body > .ar-col, .ar-body > .ar-detail')).toHaveLength(4);
  });

  it('heads the screen with the count, the credits and a CLOSE that has the focus, ahead of every card', () => {
    mount({ credits: 1234 });
    expect([text('h4'), text('.ar-head .n'), text('.ar-head .cr')]).toEqual(['ARMORY', '1 of 14 owned', 'CREDITS 1,234']);
    const close = box.querySelector<HTMLButtonElement>('.ar-head button')!;
    expect(close.textContent).toBe('CLOSE · T');
    expect(document.activeElement).toBe(close);
    // Tab from it walks the cards in the order they sit on the screen, column by column.
    const order = [...box.querySelectorAll('button')];
    expect(order).toHaveLength(15);
    expect(order[0]).toBe(close);
    expect(order.slice(1).map((b) => b.dataset.id)).toEqual(['destrier', 'obs1', 'squire', 'lens', 'lockdown', 'quote', 'f2b', 'tarpit', 'cdn', 'prepared', 'sortlist', 'mfa', 'csp', 'backup']);
    close.click();
    expect(closed).toBe(1);
  });

  it('draws over the last render, leaving one screen in the box', () => {
    mount();
    mount({ owned: ['lockdown', 'f2b'] });
    expect(box.querySelectorAll('.ar')).toHaveLength(1);
    expect(box.querySelectorAll('.cx')).toHaveLength(14);
    expect(text('.ar-head .n')).toBe('2 of 14 owned');
  });

  it('lights what the run owns and tells each card\'s state, with the level of a chain in pips and in words', () => {
    mount({ owned: ['lockdown', 'destrier', 'obs1', 'obs2', 'f2b', 'prepared'] });
    expect(text('.ar-head .n')).toBe('5 of 14 owned');
    const lines = [...box.querySelectorAll<HTMLElement>('.cx')].map((c) => [c.dataset.id, c.className, text('.st', c)]);
    // The first card is the one the detail opens on, so it is the lit one.
    expect(lines).toEqual([
      ['destrier', 'cx LEGENDARY owned sel', 'OWNED · LEVEL 1 OF 3'], ['obs1', 'cx RARE owned', 'OWNED · LEVEL 2 OF 3'], ['squire', 'cx RARE draft', 'IN THE DRAFT · 600'], ['lens', 'cx COMMON draft', 'IN THE DRAFT · 250'],
      ['lockdown', 'cx COMMON start', 'OWNED · START'], ['quote', 'cx COMMON draft', 'IN THE DRAFT · 250'], ['f2b', 'cx COMMON owned', 'OWNED'], ['tarpit', 'cx RARE draft', 'IN THE DRAFT · 600'], ['cdn', 'cx RARE draft', 'IN THE DRAFT · 600'],
      ['prepared', 'cx RARE owned', 'OWNED'], ['sortlist', 'cx RARE draft', 'IN THE DRAFT · 600'], ['mfa', 'cx RARE draft', 'IN THE DRAFT · 600'], ['csp', 'cx RARE draft', 'IN THE DRAFT · 600'], ['backup', 'cx COMMON oneShot', 'ONE SHOT · 250'],
    ]);
    // The chains carry their level in pips (lit for the levels owned); a single card has none.
    expect(['destrier', 'obs1'].map((id) => [text('.nm', card(id)), card(id).querySelectorAll('.lvl i').length, card(id).querySelectorAll('.lvl i.on').length])).toEqual([['Destrier', 3, 1], ['Observability', 3, 2]]);
    expect(box.querySelectorAll('.cx:not([data-id="destrier"]):not([data-id="obs1"]) .lvl, .cx:not([data-id="destrier"]):not([data-id="obs1"]) .tiers')).toHaveLength(0);
  });

  it('shows the icon of each card and the text of the level the run is on', () => {
    mount({ owned: ['lockdown', 'obs1', 'obs2'] });
    expect(card('lockdown').querySelector('img.px')?.getAttribute('src')).toBe('data:image/png;lock-tile');
    expect(card('destrier').querySelector('img.px')?.getAttribute('src')).toBe('data:image/png;horse-tile');
    expect(card('lockdown').querySelector('img')?.getAttribute('alt')).toBe('');
    expect(text('.ds', card('lockdown'))).toBe("Every port you don't use is padlocked. Scans of :23, :445 and :3389 are denied at the door; :25 mail stays open.");
    // A chain tells the top level owned, or its first level when it holds none.
    expect(text('.ds', card('obs1'))).toBe('Tricky attacks show their bugs too.');
    expect(text('.ds', card('destrier'))).toBe('Every packet in your lane slows to 70%. You gallop between lanes.');
  });

  it('lists the levels of a chain inside its card: owned ones green, the next one lit, the rest dim, each with its price until it is owned', () => {
    mount({ owned: ['lockdown', 'destrier'] });
    const rows = (id: string): (string | null)[][] => [...card(id).querySelectorAll('.tiers > span')].map((r) => [r.className, text('b', r) ?? null, text('.tx', r) ?? null, text('.pr', r) ?? null]);
    expect(rows('destrier')).toEqual([
      ['on', 'I', 'Every packet in your lane slows to 70%. You gallop between lanes.', null],
      ['next', 'II', "The knight's lane slows to 50%.", '600'],
      ['', 'III', 'C: you gallop down your lane and spear every attack in it. Real users pass untouched. Once per wave.', '1,000'],
    ]);
    // Nothing owned of the other chain: its first level is the next one.
    expect(rows('obs1').map((r) => [r[0], r[1], r[3]])).toEqual([['next', 'I', '250'], ['', 'II', '600'], ['', 'III', '1,000']]);
  });

  it('fills the detail from the card under the pointer or the focus: branch, rarity, level, name, what it does, in real life, the catch, the state', () => {
    mount({ owned: ['lockdown', 'destrier', 'destrier2'] });
    // It opens on the first card.
    expect([text('.ar-detail .k'), text('.ar-detail h6'), text('.ar-detail .stat')]).toEqual(['KNIGHT · RARE · LEVEL 2 OF 3', 'Destrier II', 'OWNED · LEVEL 2 OF 3']);
    expect(card('destrier').classList.contains('sel')).toBe(true);
    hover('lockdown');
    expect(text('.ar-detail .k')).toBe('FIREWALL · COMMON');
    expect(text('.ar-detail h6')).toBe('Port lockdown');
    expect([...box.querySelectorAll('.ar-detail p')].map((p) => p.textContent)).toEqual([
      "Every port you don't use is padlocked. Scans of :23, :445 and :3389 are denied at the door; :25 mail stays open.",
      'IN REAL LIFE Default-deny: expose only what must be reachable from outside.',
      'THE CATCH None. Cheap, boring, effective.',
    ]);
    expect(text('.ar-detail .stat')).toBe('OWNED · START');
    // The card the detail follows is the lit one, and only one is.
    expect([...box.querySelectorAll('.cx.sel')].map((c) => (c as HTMLElement).dataset.id)).toEqual(['lockdown']);
    // The keyboard fills it the same way.
    card('sortlist').focus();
    expect([text('.ar-detail .k'), text('.ar-detail h6'), text('.ar-detail .stat')]).toEqual(['SERVER · RARE', 'Sort-column allow-list', 'IN THE DRAFT · 600']);
    expect([...box.querySelectorAll('.cx.sel')].map((c) => (c as HTMLElement).dataset.id)).toEqual(['sortlist']);
    // Leaving the card keeps its text up: the panel does not blink between two cards.
    card('sortlist').dispatchEvent(new Event('mouseleave'));
    expect(text('.ar-detail h6')).toBe('Sort-column allow-list');
  });

  describe('the arrow keys', () => {
    const press = (key: string, over: KeyboardEventInit = {}): KeyboardEvent => {
      const ev = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...over });
      document.activeElement!.dispatchEvent(ev);
      return ev;
    };
    // The card that has the focus, by its id (CLOSE has none).
    const at = (): string | undefined => (document.activeElement as HTMLElement).dataset.id;
    // Each press from the card named, to the card the focus lands on.
    const walk = (from: string, keys: string[]): (string | undefined)[] => {
      card(from).focus();
      return keys.map((key) => { press(key); return at(); });
    };
    beforeEach(() => mount());

    it('walks up and down a branch, one card a press, and stops at its ends', () => {
      expect(walk('destrier', ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown'])).toEqual(['obs1', 'squire', 'lens', 'lens', 'lens']);
      expect(walk('lens', ['ArrowUp', 'ArrowUp', 'ArrowUp', 'ArrowUp'])).toEqual(['squire', 'obs1', 'destrier', 'destrier']);
      expect(walk('lockdown', ['ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown'])).toEqual(['quote', 'f2b', 'tarpit', 'cdn', 'cdn']);
    });

    it('jumps to the same row of the next branch, and to the last row of a shorter one, stopping at the ends', () => {
      // KNIGHT has four cards, FIREWALL and SERVER five.
      expect(walk('obs1', ['ArrowRight', 'ArrowRight', 'ArrowRight'])).toEqual(['quote', 'sortlist', 'sortlist']);
      expect(walk('sortlist', ['ArrowLeft', 'ArrowLeft', 'ArrowLeft'])).toEqual(['quote', 'obs1', 'obs1']);
      expect(walk('cdn', ['ArrowLeft'])).toEqual(['lens']);
      expect(walk('backup', ['ArrowLeft', 'ArrowLeft', 'ArrowRight'])).toEqual(['cdn', 'lens', 'tarpit']);
    });

    it('fills the detail from the card the arrow lands on, and lights only that one', () => {
      card('destrier').focus();
      press('ArrowRight');
      expect([at(), text('.ar-detail h6'), [...box.querySelectorAll('.cx.sel')].length]).toEqual(['lockdown', 'Port lockdown', 1]);
      press('ArrowDown');
      expect([at(), text('.ar-detail h6'), text('.ar-detail .stat')]).toEqual(['quote', 'Quote filter', 'IN THE DRAFT · 250']);
      expect([...box.querySelectorAll('.cx.sel')].map((c) => (c as HTMLElement).dataset.id)).toEqual(['quote']);
    });

    it('goes in at the first card from CLOSE, where the screen opens, whichever arrow is pressed', () => {
      for (const key of ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight']) {
        mount();
        expect(document.activeElement).toBe(box.querySelector('.ar-head .btn'));
        expect(press(key).defaultPrevented, key).toBe(true);
        expect([at(), text('.ar-detail h6')], key).toEqual(['destrier', 'Destrier I']);
      }
    });

    it('takes the plain arrows and nothing else: every other key, and an arrow with a modifier held, is left to the browser', () => {
      card('lockdown').focus();
      for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) expect(press(key).defaultPrevented, key).toBe(true);
      card('lockdown').focus();
      for (const [key, over] of [['Tab', {}], ['Tab', { shiftKey: true }], ['t', {}], ['T', {}], ['Escape', {}], ['Enter', {}], [' ', {}], ['m', {}],
        ['ArrowDown', { altKey: true }], ['ArrowLeft', { ctrlKey: true }], ['ArrowRight', { metaKey: true }], ['ArrowUp', { shiftKey: true }]] as const) {
        const ev = press(key, over);
        expect([key, ev.defaultPrevented, at()], `${key} ${JSON.stringify(over)}`).toEqual([key, false, 'lockdown']);
      }
    });

    it('steps once a press however many times the screen has been drawn', () => {
      mount();
      mount();
      mount({ owned: ['lockdown', 'f2b'] });
      expect(walk('destrier', ['ArrowDown'])).toEqual(['obs1']);
      expect(walk('obs1', ['ArrowRight'])).toEqual(['quote']);
    });

    it('takes the arrows only while it is on screen: the box is every screen\'s, and what it draws next gets its arrows back', () => {
      // The Armory is drawn into the box the title, the setup and the rest share; the next screen replaces it, and its keys are its own.
      const next = document.createElement('button');
      box.replaceChildren(next);
      next.focus();
      for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) expect(press(key).defaultPrevented, key).toBe(false);
      expect(document.activeElement).toBe(next);
    });
  });

  it('reads in Spanish, the thousands with a dot', () => {
    setLang('es');
    mount({ credits: 1234, owned: ['lockdown', 'destrier'] });
    expect([text('h4'), text('.ar-head .n'), text('.ar-head .cr'), text('.ar-head button')]).toEqual(['ARMERÍA', '2 de 14 en tu poder', 'CRÉDITOS 1.234', 'CERRAR · T']);
    expect([...box.querySelectorAll('h5')].map((h) => h.textContent)).toEqual(['CABALLERO · leer y actuar', 'FIREWALL · reglas en la puerta', 'SERVIDOR · arreglar el código']);
    expect([text('.nm', card('destrier')), text('.nm', card('obs1')), text('.st', card('destrier')), text('.st', card('lockdown')), text('.st', card('backup'))]).toEqual([
      'Destrero', 'Observabilidad', 'TUYO · NIVEL 1 DE 3', 'TUYO · INICIO', 'UN SOLO USO · 250',
    ]);
    expect([...card('destrier').querySelectorAll('.tiers .pr')].map((p) => p.textContent)).toEqual(['600', '1.000']);
    hover('tarpit');
    expect([text('.ar-detail .k'), text('.ar-detail h6'), text('.ar-detail .stat')]).toEqual(['FIREWALL · RARA', 'Pozo de brea', 'EN EL SORTEO · 600']);
    expect([...box.querySelectorAll('.ar-detail p b')].map((b) => b.textContent)).toEqual(['EN LA VIDA REAL', 'EL PERO']);
  });
});

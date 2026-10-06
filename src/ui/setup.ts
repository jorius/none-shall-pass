// core
import { KNIGHT_IDS, KNIGHTS, type KnightId } from '../core/content/knights';
import { DIFFICULTIES, DIFFICULTY_IDS, type Difficulty } from '../core/difficulty';

// art
import { gridUrl } from '../art/dataurl';
import { knightFoot } from '../art/sprites';

// i18n
import { lang, loc, t } from '../i18n';

// local
import { button, el } from './dom';

export interface SetupDeps {
  knight: KnightId;
  difficulty: Difficulty;
  root: boolean;
  pick(k: KnightId): void;
  level(d: Difficulty): void;
  start(): void;
  back(): void;
  toggleLang(): void;
}

// Each portrait (the knight on foot, spear up, in their own colours) is painted once and kept as a data URL.
const portraits = new Map<KnightId, string>();
const portrait = (id: KnightId): string => {
  let url = portraits.get(id);
  if (!url) {
    url = gridUrl(knightFoot(KNIGHTS[id].look, false), 3, KNIGHTS[id].pal);
    portraits.set(id, url);
  }
  return url;
};

// The score multiplier as the HUD writes it: a decimal comma in Spanish.
const mult = (m: number): string => `×${lang() === 'es' ? String(m).replace('.', ',') : m}`;

// The screen between the title and wave 1: six knights, four difficulties, the current pair marked (and pressed, for a screen reader).
// A pick calls back and the caller redraws; START takes the focus for every player, so Space starts the run (the label says so), and
// so does Enter, wherever the focus is (the App takes that key), except on BACK and the language button: they carry data-keeps-enter,
// and Enter there is their own click. The language button sits after START and BACK on the foot.
export const renderSetup = (box: HTMLElement, d: SetupDeps): void => {
  box.innerHTML = '';
  el('h2', '', box, t('setup.title'));
  el('p', '', box, t('setup.sub'));
  if (d.root) el('div', 'badge-root', box, t('title.rootOn'));
  const wrap = el('div', 'wrap', box);
  const left = el('div', '', wrap);
  el('div', 'sh', left, t('setup.knights'));
  const knights = el('div', 'knights', left);
  for (const id of KNIGHT_IDS) {
    const k = KNIGHTS[id];
    const card = button(knights, id === d.knight ? 'kn sel' : 'kn', '', () => d.pick(id));
    card.dataset.id = id;
    card.setAttribute('aria-pressed', String(id === d.knight));
    const img = el('img', 'px', el('div', 'pic', card));
    img.src = portrait(id);
    img.alt = '';
    el('div', 'nm', card, loc(k.name));
    el('div', 'team', card, loc(k.team)).style.background = k.color;
    el('div', 'motto', card, loc(k.motto));
    el('div', 'who', card, loc(k.who));
  }
  const diff = el('div', 'diff', wrap);
  el('div', 'sh', diff, t('setup.difficulty'));
  DIFFICULTY_IDS.forEach((id, i) => {
    const def = DIFFICULTIES[id];
    const row = button(diff, id === d.difficulty ? 'dl sel' : 'dl', '', () => d.level(id));
    row.dataset.id = id;
    row.setAttribute('aria-pressed', String(id === d.difficulty));
    el('span', 'rad', row);
    el('span', 'nm', row, loc(def.name));
    el('span', 'x', row, mult(def.mult));
    el('div', 'ds', row, loc(def.desc));
    // One lit bar per step up, green to red: the first n of four take the level's colour (styles.css).
    const bar = el('div', `bar l${i + 1}`, row);
    for (let b = 0; b < 4; b++) el('i', b <= i ? 'on' : '', bar);
  });
  const foot = el('div', 'foot', box);
  button(foot, 'btn', t('setup.start'), d.start).focus();
  // Actions their labels name, so a focused one keeps Enter for its own click; the marker tells the App to leave the key to it.
  button(foot, 'btn ghost', t('setup.back'), d.back).dataset.keepsEnter = '';
  button(foot, 'btn ghost', t('lang.toggle'), d.toggleLang).dataset.keepsEnter = '';
  const chosen = DIFFICULTIES[d.difficulty];
  el('span', 'note', foot, `${loc(KNIGHTS[d.knight].name)} · ${loc(chosen.name)} · ${mult(chosen.mult)}`);
};

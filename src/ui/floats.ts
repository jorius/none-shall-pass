// core
import { FIELD_TOP } from '../core/constants';
import type { FloatKind, RunEvent } from '../core/events';

// game
import type { View } from '../game/view';

// i18n
import { t } from '../i18n';

// local
import { el } from './dom';

const CLS: Record<FloatKind, string> = {
  points: 'ok', tricky: 'big', sneaky: 'big', squire: 'gold', notFooled: 'big', neutralized: 'ok', falsePositive: 'fp', damage: 'bad',
};

// Score and damage pop-ups that rise and fade where they happened: at the packet or over the rack.
export class Floats implements View {
  constructor(private readonly ui: HTMLElement) {}

  event(ev: RunEvent): void {
    if (ev.type !== 'float') return;
    const text = {
      points: `+${ev.value}`,
      tricky: `+${ev.value} · ${t('float.tricky')}`,
      sneaky: `+${ev.value} · ${t('float.sneaky')}`,
      squire: `+${ev.value} · ${t('float.squire')}`,
      notFooled: `+${ev.value} · ${t('float.notFooled')}`,
      neutralized: t('float.neutralized'),
      falsePositive: t('float.falsePositive'),
      damage: t('float.damage', { n: ev.value }),
    }[ev.kind];
    const f = el('div', `float ${CLS[ev.kind]}`, this.ui, text);
    if (ev.at === 'rack') { f.style.right = '14px'; f.style.top = `${FIELD_TOP + 36 + Math.random() * 110}px`; }
    else { f.style.left = `${Math.max(116, Math.min(ev.x, 1100))}px`; f.style.top = `${FIELD_TOP + ev.y}px`; }
    setTimeout(() => f.remove(), 1200);
  }
}

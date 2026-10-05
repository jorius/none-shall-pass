// packages
import Phaser from 'phaser';

// core
import { FIELD_H, FW_X, LANE_H, LOCK_X, TAR_X0, TAR_X1 } from '../../core/constants';
import type { CardId } from '../../core/content/cards';
import type { RunEvent } from '../../core/events';
import { CSS, HEX } from '../../core/palette';
import type { Run } from '../../core/run';

// i18n
import { t } from '../../i18n';

// stage
import { RENDER_SCALE } from '../../stage';

// game
import type { FieldScene } from '../FieldScene';
import type { View } from '../view';

const PORTS = [{ n: 23, open: false }, { n: 445, open: false }, { n: 3389, open: false }, { n: 25, open: true }];
const ROW_BG = 0x1b1d24;

interface PortRow { bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text; open: boolean; timer: Phaser.Time.TimerEvent | null }

const sign = (scene: FieldScene, x: number, y: number, text: string, color: string = CSS.ink): Phaser.GameObjects.Text =>
  scene.add.text(x, y, text, { fontFamily: 'Space Mono', fontSize: '13px', color, backgroundColor: 'rgba(28,28,28,0.92)', padding: { x: 6, y: 1 }, resolution: RENDER_SCALE });

// The firewall upgrades the player owns, drawn as things on the field: the padlocked port panel,
// the portcullis, the fail2ban hammer, the tar strip and the CDN band.
export class FieldObjectsView implements View {
  private objects: Phaser.GameObjects.GameObject[] = [];
  private rows = new Map<number, PortRow>();
  private hammer: Phaser.GameObjects.Image | null = null;
  private banned: Phaser.GameObjects.Text | null = null;
  private bubbles: Phaser.GameObjects.Arc[] = [];
  private bannedCount = 0;

  constructor(private readonly scene: FieldScene) {
    if (!scene.textures.exists('portcullis')) {
      const tex = scene.textures.createCanvas('portcullis', 9, 14);
      if (tex) {
        const c = tex.getContext();
        c.fillStyle = '#8f9bb3';
        c.fillRect(0, 0, 3, 14);
        c.fillRect(0, 0, 9, 3);
        tex.refresh();
        tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
  }

  start(run: Run): void {
    this.bannedCount = run.state.banned.length;
    this.build(run.state.owned);
  }

  refresh(run: Run | null): void {
    if (run) this.build(run.state.owned);
  }

  event(ev: RunEvent): void {
    if (ev.type === 'owned') this.build(ev.owned);
    if (ev.type === 'banned') { this.bannedCount = ev.count; this.banned?.setText(t('field.banned', { n: ev.count })); }
    if (ev.type === 'shattered' && ev.by === 'rule' && ev.ruleId === 'lockdown' && ev.packet.t.port) this.deny(ev.packet.t.port);
    if (ev.type === 'shattered' && ev.by === 'rule' && ev.ruleId === 'f2b' && this.hammer) this.slam(this.hammer);
  }

  private add<T extends Phaser.GameObjects.GameObject>(obj: T, layer: 'back' | 'objects' = 'objects'): T {
    this.scene.layers[layer].add(obj);
    this.objects.push(obj);
    return obj;
  }

  // Everything is rebuilt from the owned list; pending flashes and slams are cancelled first,
  // so none of them can land on an object this destroys.
  private build(owned: CardId[]): void {
    for (const row of this.rows.values()) row.timer?.remove(false);
    if (this.hammer) this.scene.tweens.killTweensOf(this.hammer);
    for (const o of this.objects) o.destroy();
    this.objects = [];
    this.rows.clear();
    this.hammer = null;
    this.banned = null;
    this.bubbles = [];
    const s = this.scene;

    // The grate goes in first so the port panel, which overlaps its left edge on the bottom lane, stays readable.
    if (owned.includes('quote')) {
      this.add(s.add.tileSprite(888, 0, 18, FIELD_H, 'portcullis').setOrigin(0, 0).setAlpha(0.85));
      this.add(s.add.rectangle(887, 0, 2, FIELD_H, 0x5d6680).setOrigin(0, 0));
    }

    if (owned.includes('lockdown')) {
      const y0 = 4 * LANE_H + 2;
      this.add(s.add.rectangle(LOCK_X, y0, 78, 86, 0x121317).setOrigin(0, 0).setStrokeStyle(2, 0x3c414d));
      PORTS.forEach((pt, i) => {
        const y = y0 + 3 + i * 20.5;
        const bg = this.add(s.add.rectangle(LOCK_X + 3, y, 72, 19, ROW_BG).setOrigin(0, 0));
        if (pt.open) bg.setStrokeStyle(1, HEX.blue);
        const label = this.add(s.add.text(LOCK_X + 7, y + 1, `:${pt.n}`, { fontFamily: 'Space Mono', fontSize: '13px', fontStyle: '700', color: pt.open ? CSS.blue : CSS.dim, resolution: RENDER_SCALE }));
        this.add(s.add.image(LOCK_X + 56, y + 0.5, pt.open ? 'lock-open' : 'lock-shut').setOrigin(0, 0));
        this.rows.set(pt.n, { bg, label, open: pt.open, timer: null });
      });
      this.add(sign(s, LOCK_X - 6, y0, t('field.lockdown')).setOrigin(1, 0));
    }

    // The count sits left of the hammer at the foot of the :22 lane: below it, the top of /login belongs to
    // the tarpit sign, and to its right the fire. The hammer goes on top, so a slam swings over the sign.
    if (owned.includes('f2b')) {
      this.banned = this.add(sign(s, 834, LANE_H - 2, t('field.banned', { n: this.bannedCount })).setOrigin(1, 1));
      this.hammer = this.add(s.add.image(836 + 34, 52 + 38, 'hammer').setOrigin(0.7, 0.9));
    }

    if (owned.includes('tarpit')) {
      const y = LANE_H + 60;
      this.add(s.add.rectangle(TAR_X0, y, TAR_X1 - TAR_X0, 26, 0x101114).setOrigin(0, 0), 'back');
      for (let i = 0; i < 9; i++) this.bubbles.push(this.add(s.add.circle(TAR_X0 + 12 + i * 25, y + 13, 3, 0x3a3d4a), 'back'));
      this.add(sign(s, TAR_X0, LANE_H + 2, t('field.tarpit')));
    }

    // The band's sign hangs at the top of its middle lane, clear of the tarpit sign and of the portcullis.
    if (owned.includes('cdn')) {
      this.add(s.add.rectangle(FW_X - 70, LANE_H, 70, 3 * LANE_H, HEX.blue, 0.08).setOrigin(0, 0), 'back');
      this.add(sign(s, 884, 2 * LANE_H + 2, t('field.cdn'), CSS.blue).setOrigin(1, 0));
    }
  }

  // A denied scan flashes its port's row red; a second scan on the same port restarts the flash.
  private deny(port: number): void {
    const row = this.rows.get(port);
    if (!row || row.open) return;
    row.timer?.remove(false);
    row.bg.setFillStyle(HEX.red);
    row.label.setColor(CSS.ink);
    row.timer = this.scene.time.delayedCall(300, () => {
      row.timer = null;
      row.bg.setFillStyle(ROW_BG);
      row.label.setColor(CSS.dim);
    });
  }

  // A new ban restarts the swing from rest rather than stacking a second chain on the first.
  private slam(hammer: Phaser.GameObjects.Image): void {
    this.scene.tweens.killTweensOf(hammer);
    hammer.setAngle(0);
    this.scene.tweens.chain({ targets: hammer, tweens: [{ angle: -55, duration: 120 }, { angle: 10, duration: 90 }, { angle: 0, duration: 90 }] });
  }

  frame(_run: Run | null, _dt: number, time: number): void {
    this.bubbles.forEach((b, i) => b.setY(LANE_H + 73 + Math.sin(time * 2.4 + i * 1.7) * 3).setAlpha(0.5 + Math.sin(time * 3 + i) * 0.4));
  }
}

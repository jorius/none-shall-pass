// core
import { templateById } from './content/packets';
import { createState, type Packet, type RunConfig, type RunState } from './state';

export const cfg = (over: Partial<RunConfig> = {}): RunConfig => ({ mode: 'campaign', seed: 1, root: false, hints: false, difficulty: 'analyst', knight: 'black', ...over });

export const freshState = (over: Partial<RunConfig> = {}): RunState => createState(cfg(over));

export const place = (s: RunState, templateId: string, x: number, src = '192.0.2.10'): Packet => {
  const t = templateById(templateId);
  const p: Packet = { id: s.nextId++, t, src, lane: t.lane, x, checked: false, entering: false, doomed: false, held: false, heldOnce: false, slowed: false, dead: false };
  s.packets.push(p);
  return p;
};

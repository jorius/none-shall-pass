// core
import type { CardId } from './content/cards';
import type { LineId } from './content/lines';
import type { DraftState, EndReason, Packet, Thrower } from './state';
import type { LaneIndex, Point } from './types';

export type Outcome = 'hit' | 'squire' | 'charge' | 'rule' | 'served' | 'neutralized' | 'breach' | 'fp';

export interface LogEntry {
  seq: number;
  wave: number;
  outcome: Outcome;
  packet: Packet;
  points: number;
  ruleId?: CardId;
  damage?: number;
  fpBy?: Thrower | 'rule' | 'charge';
}

export type FloatKind = 'points' | 'tricky' | 'sneaky' | 'squire' | 'notFooled' | 'neutralized' | 'falsePositive' | 'damage';

export type RunEvent =
  | { type: 'waveStarted'; wave: number }
  | { type: 'spawned'; packet: Packet }
  | { type: 'laneChanged'; lane: LaneIndex }
  | { type: 'targeted'; packetId: number | null }
  | { type: 'thrown'; packetId: number; by: Thrower; from: Point; to: Point; duration: number }
  | { type: 'shattered'; packet: Packet; by: Thrower | 'rule' | 'charge'; ruleId?: CardId }
  | { type: 'chargeStarted'; lane: LaneIndex }
  | { type: 'chargeEnded' }
  | { type: 'missed'; packetId: number }
  | { type: 'entered'; packetId: number }
  | { type: 'consumed'; packetId: number }
  | { type: 'resolved'; packet: Packet; outcome: 'served' | 'neutralized' | 'breach'; damage: number; fixId?: CardId }
  | { type: 'float'; at: 'packet' | 'rack'; x: number; y: number; kind: FloatKind; value: number }
  | { type: 'log'; entry: LogEntry }
  | { type: 'say'; line: LineId; wave?: number }
  | { type: 'uptime'; before: number; after: number }
  | { type: 'reputation'; value: number }
  | { type: 'banned'; ip: string; count: number }
  | { type: 'waveCleared'; wave: number }
  | { type: 'draftOpened'; draft: DraftState }
  | { type: 'draftChanged'; draft: DraftState }
  | { type: 'owned'; owned: CardId[] }
  | { type: 'runEnded'; reason: EndReason };

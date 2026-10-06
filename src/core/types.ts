export type Lang = 'en' | 'es';
export type Localized = { en: string; es: string };
export type Kind = 'legit' | 'sqli' | 'xss' | 'brute' | 'scan' | 'flood';
export type MaliciousKind = Exclude<Kind, 'legit'>;
export type Tier = 1 | 2 | 3;
export type LaneIndex = 0 | 1 | 2 | 3 | 4;
export type NetId = 'home' | 'mobile' | 'ci' | 'vps' | 'bot' | 'mail' | 'cloud';
export type Chip = 'GET' | 'POST' | 'SSH' | 'SMTP' | 'TCP';
export interface Point { x: number; y: number }

export interface PacketTemplate {
  id: string;
  lane: LaneIndex;
  kind: Kind;
  tier?: Tier;
  decoy?: boolean;
  port?: number;
  orderBy?: boolean;
  card: string;
  request: string[];
  hints?: string[];
  decodedHints?: string[];
  context?: Localized;
  why: Localized;
  net: NetId;
  fixedSrc?: string;
  weight: number;
}

export interface Template extends PacketTemplate {
  raw: string;
  decoded?: string;
  decodedPayload?: string;
  chip: Chip;
  path: string;
  payload: string;
}

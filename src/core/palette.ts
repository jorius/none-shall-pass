// The site's dark tokens, as CSS strings and as Phaser colour numbers.
export const CSS = {
  paper: '#292929', sub: '#333333', ink: '#f2efe7', dim: '#a4a197', mute: '#3a3a3a',
  soft: '#1c1c1c', rule: '#e6e2d6', red: '#ff2f2f', blue: '#2fb6ff', gold: '#d9b44a',
} as const;
export type Token = keyof typeof CSS;
export const HEX = Object.fromEntries(
  Object.entries(CSS).map(([k, v]) => [k, parseInt(v.slice(1), 16)]),
) as Record<Token, number>;

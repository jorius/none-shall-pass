// core
import type { IconId } from '../core/content/cards';

// local
import { paintGrid, type Grid } from './pixels';
import { iconGrid } from './sprites';

const cache = new Map<string, string>();

export const gridUrl = (g: Grid, scale: number, pal?: Record<string, string>): string => {
  const c = document.createElement('canvas');
  c.width = g[0].length * scale;
  c.height = g.length * scale;
  const ctx = c.getContext('2d');
  if (ctx) paintGrid(ctx, g, scale, pal);
  return c.toDataURL('image/png');
};

// Tiles sit in the 44px loadout column; cards show a bigger icon. Actors use a smaller scale.
export const iconUrl = (icon: IconId, size: 'tile' | 'card'): string => {
  const key = `${icon}:${size}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const actor = icon === 'horse' || icon === 'squire';
  const url = gridUrl(iconGrid(icon), size === 'tile' ? (actor ? 1 : 2) : (actor ? 2 : 4));
  cache.set(key, url);
  return url;
};

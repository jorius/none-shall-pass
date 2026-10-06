// @vitest-environment jsdom
// packages
import { afterEach, describe, expect, it } from 'vitest';

// i18n
import { setLang } from '../i18n';

// local
import { renderWebglGate, shouldGateWebgl } from './webglGate';

// Phaser 4 draws with WebGL only; the probe asks a canvas for a context the way Phaser would.
describe('shouldGateWebgl', () => {
  const canvas = (has: string[]) => ({ getContext: (kind: string) => (has.includes(kind) ? {} : null) });
  it('lets a browser with WebGL 2, or only WebGL 1, play', () => {
    expect(shouldGateWebgl(canvas(['webgl2', 'webgl']))).toBe(false);
    expect(shouldGateWebgl(canvas(['webgl']))).toBe(false);
  });
  it('gates a browser with neither, or one whose probe throws', () => {
    expect(shouldGateWebgl(canvas([]))).toBe(true);
    expect(shouldGateWebgl({ getContext: () => { throw new Error('blocked'); } })).toBe(true);
  });
});

describe('renderWebglGate', () => {
  afterEach(() => setLang('en'));

  it('replaces the stage with the WebGL card and a way back to the site, in both languages', () => {
    const root = document.createElement('div');
    root.innerHTML = '<div id="stage"></div>';
    renderWebglGate(root);
    expect(root.querySelector('#stage')).toBeNull();
    expect(root.querySelector('.gate h2')?.textContent).toBe('This one needs WebGL.');
    expect(root.querySelector<HTMLAnchorElement>('.gate a')?.href).toBe('https://jorius.github.io/');
    setLang('es');
    renderWebglGate(root);
    expect(root.querySelector('.gate h2')?.textContent).toBe('Este necesita WebGL.');
    expect(root.querySelectorAll('.gate')).toHaveLength(1);
  });

  it('shows a generic message for a boot that failed for any other reason', () => {
    const root = document.createElement('div');
    renderWebglGate(root, 'boot');
    expect(root.querySelector('.gate h2')?.textContent).toBe('Something went wrong.');
    expect(root.querySelector('.gate p')?.textContent).toContain('Reload');
    expect(root.querySelector('.gate a')).not.toBeNull();
  });
});

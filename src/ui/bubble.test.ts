// @vitest-environment jsdom
// packages
import { beforeEach, describe, expect, it } from 'vitest';

// core
import { Run } from '../core/run';
import { cfg } from '../core/testkit';

// local
import { Bubble } from './bubble';

describe('Bubble', () => {
  let ui: HTMLElement, bubble: Bubble, run: Run, box: HTMLElement;
  beforeEach(() => {
    ui = document.createElement('div');
    bubble = new Bubble(ui);
    run = new Run(cfg());
    box = ui.querySelector('.bubble') as HTMLElement;
  });

  it('shows a line with its sub and hides it after 2.6 s', () => {
    bubble.frame(run, 0, 1);
    bubble.event({ type: 'say', line: 'noTarget' }, run);
    expect(box.classList.contains('show')).toBe(true);
    expect(box.textContent).toBe('No target.Tab picks the next packet in this lane.');
    bubble.frame(run, 0, 3.5);
    expect(box.classList.contains('show')).toBe(true);
    bubble.frame(run, 0, 3.7);
    expect(box.classList.contains('show')).toBe(false);
  });

  it('keeps a repeated line up without rebuilding it', () => {
    bubble.frame(run, 0, 1);
    bubble.event({ type: 'say', line: 'noTarget' }, run);
    const node = box.firstChild;
    bubble.frame(run, 0, 3);
    bubble.event({ type: 'say', line: 'noTarget' }, run);
    expect(box.firstChild).toBe(node);
    bubble.frame(run, 0, 5.5);
    expect(box.classList.contains('show')).toBe(true);
    bubble.frame(run, 0, 5.7);
    expect(box.classList.contains('show')).toBe(false);
  });

  it('rebuilds for a different line, or the same one once it has gone', () => {
    bubble.frame(run, 0, 1);
    bubble.event({ type: 'say', line: 'noTarget' }, run);
    const first = box.firstChild;
    bubble.event({ type: 'say', line: 'emptyLane' }, run);
    expect(box.firstChild).not.toBe(first);
    expect(box.textContent).toContain('Nothing on this lane.');
    bubble.frame(run, 0, 4);
    const second = box.firstChild;
    bubble.event({ type: 'say', line: 'emptyLane' }, run);
    expect(box.firstChild).not.toBe(second);
    expect(box.classList.contains('show')).toBe(true);
  });

  it('gives the wave start the wave intro and sits below the knight on the top lane', () => {
    bubble.event({ type: 'say', line: 'waveStart', wave: 1 }, run);
    expect(box.querySelector('small')?.textContent).toBe('Someone is knocking on every port.');
    bubble.frame(run, 0, 0);
    expect(box.classList.contains('below')).toBe(false);
    run.state.knight.y = 0;
    bubble.frame(run, 0, 0);
    expect(box.classList.contains('below')).toBe(true);
  });
});

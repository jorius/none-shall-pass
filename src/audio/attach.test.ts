// @vitest-environment jsdom
// packages
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// local
import { AudioView } from './index';
import { studio } from './testkit';

describe('AudioView in the page', () => {
  let detach = (): void => undefined;
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '';
  });
  afterEach(() => {
    detach();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // A view with the loop off, so what is heard is the effects alone.
  const attached = () => {
    const kit = studio();
    const view = new AudioView(() => kit.ctx, { sound: true, music: false, volume: 2 });
    detach = view.attach(window);
    return { ...kit, view };
  };

  it('stays locked until the first key or press, and then builds its context once', () => {
    const { view } = attached();
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new MouseEvent('mousemove'));
    expect(view.unlocked).toBe(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    expect(view.unlocked).toBe(true);
  });

  it('unlocks on a pointer press as well', () => {
    const { view } = attached();
    window.dispatchEvent(new Event('pointerdown'));
    expect(view.unlocked).toBe(true);
  });

  it('listens no more once it is detached', () => {
    const { view } = attached();
    detach();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' }));
    expect(view.unlocked).toBe(false);
  });

  it('ticks on a click on an overlay button, even one that redraws its screen away, and on nothing else', () => {
    const { view, heard } = attached();
    view.unlock();
    const box = document.body.appendChild(document.createElement('div'));
    box.className = 'ov show';
    // Like PLAY or RESUME: the screen is redrawn inside the click, so by the time it bubbles the button is out of the page.
    const go = box.appendChild(document.createElement('button'));
    go.onclick = () => box.replaceChildren();
    const outside = document.body.appendChild(document.createElement('button'));
    outside.click();
    box.click();
    expect(heard()).toEqual([]);
    go.click();
    expect(heard()).toEqual(['square:660']);
    expect(box.children).toHaveLength(0);
  });

  it('ticks when the click lands on something inside the button, and not for a button that is disabled', () => {
    const { view, heard } = attached();
    view.unlock();
    const box = document.body.appendChild(document.createElement('div'));
    box.className = 'ov show';
    const card = box.appendChild(document.createElement('button'));
    const label = card.appendChild(document.createElement('span'));
    label.click();
    expect(heard()).toEqual(['square:660']);
    const locked = box.appendChild(document.createElement('button'));
    locked.disabled = true;
    locked.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(heard()).toEqual([]);
  });

  it('does not tick for a click before the first gesture has built the context', () => {
    const { view, voices } = attached();
    const box = document.body.appendChild(document.createElement('div'));
    box.className = 'ov show';
    box.appendChild(document.createElement('button')).click();
    expect([view.unlocked, voices]).toEqual([false, []]);
  });
});

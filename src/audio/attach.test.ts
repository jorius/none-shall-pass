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
    Reflect.deleteProperty(document, 'hidden');
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

  // The browser's own switch for a tab nobody can see; a test throws it and says so, and the afterEach puts the browser's back.
  const hide = (on: boolean): void => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => on });
    document.dispatchEvent(new Event('visibilitychange'));
  };

  it('suspends its context while the tab is hidden and resumes it when the tab is shown again, even straight after a gesture asked', () => {
    const { view, resume, suspend } = attached();
    view.unlock();
    expect([resume.mock.calls.length, suspend.mock.calls.length]).toEqual([1, 0]);
    hide(true);
    expect([resume.mock.calls.length, suspend.mock.calls.length]).toEqual([1, 1]);
    // A gesture would not ask a context again for 500 ms; a tab coming back asks at once.
    hide(false);
    expect([resume.mock.calls.length, suspend.mock.calls.length]).toEqual([2, 1]);
  });

  it('resumes a context it suspended even when the context still says it is running, the suspend not through yet', () => {
    const kit = studio('running');
    const view = new AudioView(() => kit.ctx, { sound: true, music: false, volume: 2 });
    detach = view.attach(window);
    view.unlock();
    expect(kit.resume).not.toHaveBeenCalled();
    hide(true);
    hide(false);
    expect([kit.suspend.mock.calls.length, kit.resume.mock.calls.length]).toEqual([1, 1]);
  });

  it('leaves a running context alone when a tab that was never hidden is shown', () => {
    const kit = studio('running');
    const view = new AudioView(() => kit.ctx, { sound: true, music: false, volume: 2 });
    detach = view.attach(window);
    view.unlock();
    hide(false);
    expect([kit.suspend.mock.calls.length, kit.resume.mock.calls.length]).toEqual([0, 0]);
  });

  it('has nothing to suspend before the first gesture, and builds its context as usual after', () => {
    const { view, suspend, resume } = attached();
    hide(true);
    hide(false);
    expect([suspend.mock.calls.length, resume.mock.calls.length, view.unlocked]).toEqual([0, 0, false]);
    view.unlock();
    expect([view.unlocked, resume.mock.calls.length]).toEqual([true, 1]);
  });

  it('survives a suspend that is refused, or that the context does not have', async () => {
    const { view, suspend, ctx } = attached();
    view.unlock();
    suspend.mockRejectedValue(new Error('closed'));
    expect(() => hide(true)).not.toThrow();
    await vi.advanceTimersByTimeAsync(0);
    suspend.mockImplementation(() => { throw new Error('gone'); });
    expect(() => hide(true)).not.toThrow();
    delete (ctx as { suspend?: unknown }).suspend;
    expect(() => hide(true)).not.toThrow();
    expect(() => hide(false)).not.toThrow();
  });

  it('listens no more to the tab once it is detached', () => {
    const { view, suspend } = attached();
    view.unlock();
    detach();
    hide(true);
    expect(suspend).not.toHaveBeenCalled();
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

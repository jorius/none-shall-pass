// stage
import { SCREEN_W } from '../stage';

// local
import { el } from './dom';

// The DOM layer shares the canvas's 1280×720 logical space, so UI and field line up at any size.
export const createUiLayer = (stage: HTMLElement, canvas: HTMLCanvasElement): HTMLElement => {
  const ui = el('div', '', stage);
  ui.id = 'ui';
  const sync = (): void => {
    const s = stage.getBoundingClientRect(), r = canvas.getBoundingClientRect();
    ui.style.transform = `translate(${r.left - s.left}px, ${r.top - s.top}px) scale(${r.width / SCREEN_W})`;
  };
  new ResizeObserver(sync).observe(canvas);
  window.addEventListener('resize', () => requestAnimationFrame(sync));
  sync();
  return ui;
};

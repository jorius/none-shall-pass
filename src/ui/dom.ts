export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
};

// A clicked button must not keep the focus, or the next Space press (the spear key) would click it again.
export const button = (parent: HTMLElement, cls: string, text: string, onClick: () => void): HTMLButtonElement => {
  const b = el('button', cls, parent, text);
  b.onmousedown = (e) => e.preventDefault();
  b.onclick = onClick;
  return b;
};

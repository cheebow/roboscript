export function requireElement<T extends HTMLElement = HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (element === null) throw new Error(`Missing element #${id}`);
  return element as T;
}

export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string,
  text = '',
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  element.className = className;
  element.textContent = text;
  return element;
}

/** A button of the page (never one that submits a form), with its tooltip and what a press does. */
export function createButton(className: string, label: string, title = '', onClick?: () => void): HTMLButtonElement {
  const button = createElement('button', className, label);
  button.type = 'button';
  if (title !== '') button.title = title;
  if (onClick !== undefined) button.addEventListener('click', onClick);
  return button;
}

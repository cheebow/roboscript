import { t } from '../i18n/messages';
import { createButton, createElement } from './dom';

/** A share link to offer beside the code: the address, and what to call it in a message. */
export interface ShareLink {
  url: string;
  title: string;
}

/**
 * A share code to copy: the code on a line of its own, chosen whole when
 * clicked, and under it a button to copy it with any others given. With a
 * link, buttons to copy the link, and where the device can, to send it with
 * the device's own share menu (to a social network, a message ...).
 */
export function createShareBox(code: string, className: string, others: readonly HTMLButtonElement[] = [], link?: ShareLink): HTMLElement {
  const field = createElement('input', 'garage-share-field');
  field.type = 'text';
  field.readOnly = true;
  field.value = code;
  field.setAttribute('aria-label', t('share.field'));
  field.addEventListener('focus', () => field.select());
  const copy = createButton('tool-button share-action', t('garage.copy'), t('garage.copy.title'), () => {
    field.select();
    navigator.clipboard?.writeText(code).catch(() => {
      // Left selected: the player can copy it by hand.
    });
  });
  const line = createElement('div', 'garage-share-line');
  line.append(field);
  const actions = createElement('div', 'garage-share-line');
  actions.append(copy);
  if (link !== undefined) {
    const copyLink = createButton('tool-button share-action', t('share.copyLink'), t('share.copyLink.title'), () => {
      navigator.clipboard?.writeText(link.url).then(
        () => (copyLink.textContent = t('share.copied')),
        () => {
          // No clipboard: the link goes in the field, to be copied by hand.
          field.value = link.url;
          field.select();
        },
      );
    });
    actions.append(copyLink);
    if (typeof navigator.share === 'function') {
      actions.append(
        createButton('tool-button share-action', t('share.send'), t('share.send.title'), () => {
          navigator.share({ title: link.title, url: link.url }).catch(() => {
            // Closed without sending: nothing to do.
          });
        }),
      );
    }
  }
  actions.append(...others);
  const box = createElement('div', className);
  box.append(line, actions);
  return box;
}

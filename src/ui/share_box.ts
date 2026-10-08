import { t } from '../i18n/messages';
import { createButton, createElement } from './dom';

/** A share link to offer beside the code: the address, what to call it, and the words to post with it. */
export interface ShareLink {
  url: string;
  title: string;
  /** A line to post with the link, the hashtag at its end. */
  text: string;
}

/** Where "POST ON X" opens: X's page for writing a post, with the words and the link in it. */
const X_POST = 'https://x.com/intent/post';
/** ms a copy button says it copied before it goes back to what it was: long enough to see, short enough to copy again. */
const COPIED_FOR = 2000;

/** Has the button say it copied, then go back to its own label. */
function sayCopied(button: HTMLButtonElement): void {
  const label = button.dataset.label ?? button.textContent ?? '';
  button.dataset.label = label;
  button.textContent = t('share.copied');
  window.clearTimeout(Number(button.dataset.timer ?? 0));
  button.dataset.timer = String(window.setTimeout(() => (button.textContent = label), COPIED_FOR));
}

/**
 * How to give something away, the easiest first: with a link, buttons to post
 * it on X, to copy it, and where the device can, to send it with the device's
 * own share menu; then the share code with a button to copy it, and any
 * other buttons given (such as saving a file).
 */
export function createShareBox(code: string, className: string, others: readonly HTMLButtonElement[] = [], link?: ShareLink): HTMLElement {
  const field = createElement('input', 'garage-share-field');
  field.type = 'text';
  field.readOnly = true;
  field.value = code;
  field.setAttribute('aria-label', t('share.field'));
  field.addEventListener('focus', () => field.select());
  const copyCode = createButton('tool-button share-action', t('share.copyCode'), t('share.copyCode.title'), () => {
    field.select();
    navigator.clipboard?.writeText(code).then(
      () => sayCopied(copyCode),
      () => {
        // Left selected: the player can copy it by hand.
      },
    );
  });

  const actions = createElement('div', 'garage-share-line');
  if (link !== undefined) {
    const post = createButton('tool-button share-action', t('share.postOnX'), t('share.postOnX.title'), () => {
      const address = `${X_POST}?${new URLSearchParams({ text: link.text, url: link.url })}`;
      window.open(address, '_blank', 'noopener');
    });
    const copyLink = createButton('tool-button share-action', t('share.copyLink'), t('share.copyLink.title'), () => {
      navigator.clipboard?.writeText(link.url).then(
        () => sayCopied(copyLink),
        () => {
          // No clipboard: the link goes in the field, to be copied by hand.
          field.value = link.url;
          field.select();
        },
      );
    });
    actions.append(post, copyLink);
    if (typeof navigator.share === 'function') {
      actions.append(
        createButton('tool-button share-action', t('share.send'), t('share.send.title'), () => {
          navigator.share({ title: link.title, text: link.text, url: link.url }).catch(() => {
            // Closed without sending: nothing to do.
          });
        }),
      );
    }
  }
  actions.append(copyCode, ...others);

  const codeLine = createElement('div', 'garage-share-line');
  codeLine.append(createElement('span', 'garage-share-caption', t('share.field')), field);
  const box = createElement('div', className);
  box.append(actions, codeLine);
  return box;
}

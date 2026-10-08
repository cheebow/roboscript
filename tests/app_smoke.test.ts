// @vitest-environment happy-dom
import { beforeAll, describe, expect, it, vi } from 'vitest';
import html from '../index.html?raw';

// The whole app on the real page: started once, then driven by its buttons, as a
// player would. It catches wiring the unit tests cannot see (a screen that throws
// when shown, a field that is read before it is made).

const click = (id: string) => (document.getElementById(id) as HTMLElement).click();
const frames: FrameRequestCallback[] = [];
/** Runs the frames the app asked for since the last call, as the browser would. */
function runFrames(count = 3): void {
  for (let index = 0; index < count; index++) {
    const pending = frames.splice(0);
    for (const frame of pending) frame(performance.now() + 16 * (index + 1));
  }
}

beforeAll(async () => {
  // The page without its script tag: the app is started below, by hand.
  document.body.innerHTML = html.slice(html.indexOf('<body>') + '<body>'.length, html.indexOf('</body>')).replace(/<script[\s\S]*?<\/script>/g, '');
  // happy-dom has no Option constructor: one made the usual way.
  vi.stubGlobal('Option', function Option(text = '', value = text) {
    const option = document.createElement('option');
    option.textContent = text;
    option.value = value;
    return option;
  });
  // happy-dom draws nothing: a 2D context that takes every call and does nothing is enough.
  const context = new Proxy({}, { get: (_, name) => (name === 'measureText' ? () => ({ width: 0 }) : () => {}), set: () => true });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
  vi.stubGlobal('requestAnimationFrame', (frame: FrameRequestCallback) => frames.push(frame));
  window.localStorage.clear();
  const { startApp } = await import('../src/ui/app');
  startApp();
  runFrames();
});

describe('the app, on the real page', () => {
  it('opens the team battle, runs a match and steps through it', () => {
    click('boot');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    document.getElementById('boot')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    click('screen-program');
    runFrames();
    // Into the team battle: its editors, the garage of teams and its toolbar are made.
    (document.getElementById('screen-team-edit') as HTMLElement).click();
    runFrames();
    expect(document.getElementById('app')?.dataset.screen).toBe('team');
    expect(document.getElementById('team-code')?.hidden).toBe(false);
    expect(document.querySelectorAll('#team-garage .garage-save-buttons button')).toHaveLength(2);
    click('run');
    runFrames(10);
    expect(document.getElementById('message')?.textContent ?? '').not.toContain('error');
    click('debug');
    runFrames(5);
    click('transport-play');
    runFrames(5);
  });

  it('changes the team size and the base map, and outfits a machine', () => {
    const size = document.getElementById('team-size') as HTMLSelectElement;
    size.value = '5';
    size.dispatchEvent(new Event('change'));
    runFrames();
    expect(document.querySelectorAll('#inspector-tabs button, #inspector-tabs .tab').length).toBeGreaterThanOrEqual(10);
    const map = document.getElementById('arena') as HTMLSelectElement;
    map.value = map.options[map.options.length - 1].value;
    map.dispatchEvent(new Event('change'));
    runFrames();
    // ALPHA's config: the machine tabs appear, and picking machine 3 and a part works.
    const configRow = [...document.querySelectorAll('#project-tree *')].find((element) => element.textContent?.trim().endsWith('config')) as HTMLElement;
    configRow.click();
    runFrames();
    const tabs = document.querySelectorAll<HTMLButtonElement>('#machine-picker button');
    expect(tabs).toHaveLength(5);
    tabs[2].click();
    runFrames();
    const part = [...document.querySelectorAll<HTMLButtonElement>('#config button')].find((button) => button.textContent?.startsWith('Heavy'));
    part?.click();
    runFrames();
    click('run');
    runFrames(10);
  });

  it('watches saved teams fight, and goes back to the editor', () => {
    click('screen-team-watch');
    runFrames();
    expect(document.getElementById('app')?.dataset.screen).toBe('teamwatch');
    const fight = [...document.querySelectorAll<HTMLButtonElement>('#team-lineup-slots button')].find((button) => button.textContent === document.querySelector('#team-lineup-slots .lineup-buttons button')?.textContent);
    fight?.click();
    runFrames(10);
    click('screen-team-edit');
    runFrames();
    expect(document.getElementById('app')?.dataset.screen).toBe('team');
  });

  it('goes back and forth between the duel and the team battle', () => {
    click('boot-button');
    document.getElementById('boot')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    click('screen-program');
    runFrames();
    expect(document.getElementById('app')?.dataset.screen).toBe('program');
    click('run');
    runFrames(5);
    click('screen-team-edit');
    runFrames();
    click('reset');
    runFrames();
    expect(document.getElementById('app')?.dataset.screen).toBe('team');
  });
});

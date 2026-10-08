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
  // Three built-in robots on the contest's list, so that a league can start.
  const { CONTEST_KEY, writeContest } = await import('../src/project/contest_store');
  const { STANDARD_LOADOUT } = await import('../src/data/parts');
  const { TEMPLATES } = await import('../src/data/templates');
  window.localStorage.setItem(
    CONTEST_KEY,
    writeContest(TEMPLATES.slice(0, 3).map((template) => ({ robot: { name: template.name, source: template.source, loadout: STANDARD_LOADOUT }, origin: 'built-in' as const }))),
  );
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
    // Play and pause live beside the seek bar alone.
    expect(document.getElementById('pause')).toBeNull();
    // The team templates come first; the duel's are one step aside, in a submenu.
    const entries = [...(document.querySelector('#template-menu > .menu-list')?.children ?? [])];
    expect(entries.at(-1)?.classList.contains('menu-sub')).toBe(true);
    expect(entries.slice(0, -1).every((entry) => entry.classList.contains('menu-item'))).toBe(true);
    expect(entries.length).toBeGreaterThan(2);
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
    // Each side's line tells its robots standing and its base's HP.
    const statuses = [...document.querySelectorAll('#team-lineup-slots .lineup-status')].map((status) => status.textContent ?? '');
    expect(statuses).toHaveLength(2);
    for (const status of statuses) expect(status).toMatch(/\d+\/\d+.*\d+$/);
    // Every machine of each side is drawn small on its slot, its parts on hover.
    const machines = document.querySelectorAll<HTMLCanvasElement>('#team-lineup-slots .machine-preview');
    expect(machines).toHaveLength(10);
    expect(machines[0].title).toMatch(/1.*\//);
    click('screen-team-edit');
    runFrames();
    expect(document.getElementById('app')?.dataset.screen).toBe('team');
  });

  it('fights in the arena, plays a series there, and keeps the results', async () => {
    click('screen-arena');
    runFrames();
    // ALPHA and BRAVO as they are being edited can fight without being saved first.
    const groups = [...document.querySelectorAll<HTMLOptGroupElement>('#lineup-slots select')[0].querySelectorAll('optgroup')];
    expect(groups[0].querySelectorAll('option')).toHaveLength(2);
    const lineupButtons = () => [...document.querySelectorAll<HTMLButtonElement>('#lineup-slots .lineup-buttons button')];
    lineupButtons()[0].click();
    runFrames(10);
    expect(document.querySelectorAll('#result-rows .result-row').length).toBe(0);
    // The series is computed match by match, then listed.
    lineupButtons()[1].click();
    await vi.waitFor(() => expect(document.querySelector('#result-rows .series')).not.toBeNull(), { timeout: 20_000 });
    // The fight left mid-way still counts once the series is listed.
    expect(document.querySelectorAll('#result-rows .result-row').length).toBeGreaterThan(1);
  }, 30_000);

  it('plays a league in the contest and shows its board', async () => {
    click('screen-contest');
    runFrames();
    const start = [...document.querySelectorAll<HTMLButtonElement>('#contest-body .lineup-buttons button')][0];
    start.click();
    await vi.waitFor(() => expect(document.getElementById('board')?.hidden).toBe(false), { timeout: 30_000 });
    expect(document.querySelector('#board .board-title')?.textContent).not.toBe('');
  }, 40_000);

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

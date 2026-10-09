// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionMenu } from '../src/ui/action_menu';
import { CHANGES, latestChangeDate } from '../src/data/changes';
import { BOOT_KEY, BootScreen } from '../src/ui/boot_screen';
import { GaragePanel, type GarageHandlers } from '../src/ui/garage_panel';
import { renderMarkup } from '../src/ui/markup';
import { Notice } from '../src/ui/notice';

/** Storage kept in a map, as localStorage would keep it. */
function memoryStorage() {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  };
}

function key(target: EventTarget, name: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('the tutorial markup', () => {
  it('makes paragraphs, lists, code blocks, code and bold', () => {
    const root = renderMarkup('First line\nsame paragraph.\n\n- one `fire`\n- two\n\n```\nloop\n    fire\n```\n\n**Bold `wait`** after.');
    expect([...root.children].map((child) => child.tagName)).toEqual(['P', 'UL', 'PRE', 'P']);
    expect(root.children[0].textContent).toBe('First line same paragraph.');
    expect(root.querySelectorAll('li')).toHaveLength(2);
    expect(root.querySelector('li code')?.textContent).toBe('fire');
    expect(root.querySelector('pre')?.textContent).toBe('loop\n    fire');
    expect(root.querySelector('strong code')?.textContent).toBe('wait');
  });

  it('makes a table, its first row the heading, without the row of dashes', () => {
    const root = renderMarkup('| word | meaning |\n|---|---|\n| `fire` | shoot |\n| `wait` | rest |');
    expect(root.querySelectorAll('th')).toHaveLength(2);
    expect(root.querySelectorAll('tr')).toHaveLength(3);
    expect(root.querySelector('td code')?.textContent).toBe('fire');
  });
});

describe('a notice', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('shows what happened, and fades by itself when it went well', () => {
    const notice = new Notice();
    expect(notice.element.hidden).toBe(true);
    notice.show('saved');
    expect(notice.element.hidden).toBe(false);
    expect(notice.element.classList.contains('problem')).toBe(false);
    vi.advanceTimersByTime(10_000);
    expect(notice.element.hidden).toBe(true);
  });

  it('keeps a problem until the next notice or a click, so that it is read', () => {
    const notice = new Notice();
    notice.show('saved');
    notice.show('could not', true);
    expect(notice.element.textContent).toBe('could not');
    expect(notice.element.classList.contains('problem')).toBe(true);
    vi.advanceTimersByTime(60_000);
    expect(notice.element.hidden).toBe(false);
    notice.element.click();
    expect(notice.element.hidden).toBe(true);
    notice.show('could not', true);
    notice.show('saved');
    vi.advanceTimersByTime(10_000);
    expect(notice.element.hidden).toBe(true);
  });
});

describe('a share box', () => {
  afterEach(() => vi.useRealTimers());

  it('says it copied, then goes back to its own label', async () => {
    const { createShareBox } = await import('../src/ui/share_box');
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText: () => Promise.resolve() } });
    const box = createShareBox('CODE', 'share');
    document.body.append(box);
    const copy = [...box.querySelectorAll('button')].find((button) => button.title !== '' && button.textContent !== '') as HTMLButtonElement;
    const label = copy.textContent;
    vi.useFakeTimers();
    copy.click();
    await vi.advanceTimersByTimeAsync(0);
    expect(copy.textContent).not.toBe(label);
    await vi.advanceTimersByTimeAsync(2500);
    expect(copy.textContent).toBe(label);
    vi.unstubAllGlobals();
  });
});

describe('the help', () => {
  it('opens at once, fills in its text once loaded, and finds a word', async () => {
    const { HelpPanel } = await import('../src/ui/help_panel');
    const help = new HelpPanel();
    help.open();
    expect(help.shown).toBe(true);
    // The table of contents and the first topic follow the text.
    await vi.waitFor(() => expect(document.querySelectorAll('#help .help-link').length).toBeGreaterThan(10));
    expect(document.querySelector('#help .help-link.selected')).not.toBeNull();
    help.openWord('signal');
    expect(document.querySelector('#help .help-word-found')?.getAttribute('data-word')).toBe('signal');
    help.close();
    expect(document.getElementById('help')).toBeNull();
  });

  it('opens the guide at its start, and stays shut when closed before its text came', async () => {
    const { HelpPanel } = await import('../src/ui/help_panel');
    const help = new HelpPanel();
    help.openGuide();
    await vi.waitFor(() => expect(document.querySelector('#help .help-link.selected')).not.toBeNull());
    const guideStart = document.querySelector('#help .help-link.selected')?.textContent;
    help.close();
    help.open();
    help.close();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(document.getElementById('help')).toBeNull();
    expect(guideStart).not.toBe('');
  });
});

describe('the watch', () => {
  it('folds its long lists, and remembers which', async () => {
    const { WatchPanel } = await import('../src/ui/watch_panel');
    const storage = memoryStorage();
    const fields = document.createElement('div');
    const name = document.createElement('span');
    document.body.append(fields, name);
    new WatchPanel(fields, name, storage);
    const [, sensors] = [...fields.querySelectorAll<HTMLButtonElement>('.watch-section')];
    expect(sensors.nextElementSibling?.hasAttribute('hidden')).toBe(false);
    sensors.click();
    expect(sensors.nextElementSibling?.hasAttribute('hidden')).toBe(true);
    // Made again, as on the next visit: still folded.
    const again = document.createElement('div');
    new WatchPanel(again, name, storage);
    expect(again.querySelectorAll('.watch-section')[1].nextElementSibling?.hasAttribute('hidden')).toBe(true);
  });

  it('shows how many teammates and enemies are left in a team match', async () => {
    const { WatchPanel } = await import('../src/ui/watch_panel');
    const { captureSnapshot } = await import('../src/debug/snapshot');
    const { prepareCastleFight } = await import('../src/arena/castle_match');
    const { CASTLE_ARENAS } = await import('../src/data/arenas');
    const { STANDARD_LOADOUT } = await import('../src/data/parts');
    const { Simulation } = await import('../src/sim/simulation');
    const light = { ...STANDARD_LOADOUT, body: 'light', gun: 'pistol' } as const;
    const side = (name: string) => ({ name, source: 'loop\n    wait\n', loadouts: [light, light, light] });
    const prepared = prepareCastleFight([side('ALPHA'), side('BRAVO')], CASTLE_ARENAS[0], 3, 1);
    if (!prepared.ok) throw new Error(prepared.problems.join('\n'));
    const fields = document.createElement('div');
    const panel = new WatchPanel(fields, document.createElement('span'));
    panel.update(captureSnapshot(new Simulation(prepared.fight.config)).robots[0], {});
    const valueOf = (word: string) =>
      [...fields.querySelectorAll('.field')].find((row) => row.querySelector('.field-name')?.getAttribute('title')?.endsWith(` ${word}`))
        ?.querySelector('.field-value')?.textContent;
    expect(valueOf('allies_alive')).toBe('2');
    expect(valueOf('enemies_alive')).toBe('3');
  });
});

describe('a menu', () => {
  function menu(onPick: (id: string) => void = () => {}) {
    const { element, menu: created } = ActionMenu.inPanel('ADD', 'add a robot', onPick);
    document.body.append(element);
    created.setItems([
      { id: 'built-in', label: 'Built-in', items: [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }] },
      { id: 'garage', label: 'Garage (empty)', disabled: true },
      { id: 'file', label: 'Open a file…', title: 'pick a file' },
    ]);
    const button = element.querySelector('button')!;
    const list = element.querySelector<HTMLElement>('.menu-list')!;
    return { element, button, list };
  }

  it('opens and closes from its button, and puts its list away after a pick or a click outside', () => {
    const picked: string[] = [];
    const { button, list } = menu((id) => picked.push(id));
    expect(list.hidden).toBe(true);
    button.click();
    expect(list.hidden).toBe(false);
    [...list.querySelectorAll<HTMLButtonElement>('.menu-item')].find((item) => item.textContent === 'B')!.click();
    expect(picked).toEqual(['b']);
    expect(list.hidden).toBe(true);
    button.click();
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(list.hidden).toBe(true);
  });

  it('shows items that cannot be picked as such, and the tooltip of an item', () => {
    const { list } = menu();
    const items = [...list.querySelectorAll<HTMLButtonElement>(':scope > .menu-item, :scope > .menu-sub > .menu-item')];
    expect(items.map((item) => item.disabled)).toEqual([false, true, false]);
    expect(items[2].title).toBe('pick a file');
  });

  it('goes through its items with the arrow keys, skipping those that cannot be picked, and back to its button with Escape', () => {
    const { button, list } = menu();
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    expect(document.activeElement?.textContent).toBe('Built-in');
    key(document.activeElement!, 'ArrowDown');
    expect(document.activeElement?.textContent).toBe('Open a file…');
    key(document.activeElement!, 'ArrowUp');
    key(document.activeElement!, 'ArrowRight');
    expect(document.activeElement?.textContent).toBe('A');
    key(document.activeElement!, 'ArrowLeft');
    expect(document.activeElement?.textContent).toBe('Built-in');
    key(document.activeElement!, 'Escape');
    expect(list.hidden).toBe(true);
    expect(document.activeElement).toBe(button);
  });
});

describe('the start-up screen', () => {
  it('shows its lines, goes to the menu on any key, and starts what is chosen, remembering it', () => {
    const storage = memoryStorage();
    const chosen: string[] = [];
    const boot = new BootScreen(storage, (choice) => chosen.push(choice));
    boot.show();
    const screen = document.getElementById('boot')!;
    expect(screen).not.toBeNull();
    key(screen, 'x');
    expect(screen.querySelectorAll('.boot-line').length).toBeGreaterThan(5);
    expect(screen.querySelector('.boot-item.current .boot-item-name')?.textContent).toBe('TUTORIAL');
    key(screen, 'ArrowDown');
    key(screen, 'ArrowDown');
    key(screen, 'Enter');
    expect(chosen).toEqual(['program']);
    expect(document.getElementById('boot')).toBeNull();
    expect(JSON.parse(storage.getItem(BOOT_KEY)!).last).toBe('program');

    // The next time, the cursor starts on what was started last.
    boot.show();
    key(document.getElementById('boot')!, 'x');
    expect(document.querySelector('.boot-item.current .boot-item-name')?.textContent).toBe('PROGRAM');
  });

  it('offers the team battle, and starts it when chosen', () => {
    const storage = memoryStorage();
    const chosen: string[] = [];
    const boot = new BootScreen(storage, (choice) => chosen.push(choice));
    boot.show();
    const screen = document.getElementById('boot')!;
    key(screen, 'x');
    const names = [...screen.querySelectorAll('.boot-item-name')].map((item) => item.textContent);
    expect(names).toContain('TEAM BATTLE');
    // After the duel's own screens: the sixth line of the menu.
    key(screen, '6');
    expect(chosen).toEqual(['team']);
  });

  it('tells a returning player what changed, once, and keeps quiet for a new one', () => {
    // A returning player: the boot choice was saved before there was any news.
    const storage = memoryStorage();
    storage.setItem(BOOT_KEY, JSON.stringify({ version: 1, last: 'program' }));
    const boot = new BootScreen(storage, () => {});
    boot.show();
    key(document.getElementById('boot')!, 'x');
    expect(document.querySelectorAll('.boot-news-item').length).toBe(CHANGES.length);
    expect(document.querySelector('.boot-news-title')?.textContent).toBe('SINCE YOUR LAST VISIT');
    expect(JSON.parse(storage.getItem(BOOT_KEY)!).seen).toBe(latestChangeDate());
    boot.hide();

    // Seen: the next visit shows nothing, and choosing a screen keeps the day.
    boot.show();
    key(document.getElementById('boot')!, 'x');
    expect(document.querySelector('.boot-news')).toBeNull();
    key(document.getElementById('boot')!, 'Enter');
    expect(JSON.parse(storage.getItem(BOOT_KEY)!).seen).toBe(latestChangeDate());
  });

  it('shows no news on the very first visit: it only notes the day', () => {
    const storage = memoryStorage();
    const boot = new BootScreen(storage, () => {});
    boot.show();
    key(document.getElementById('boot')!, 'x');
    expect(document.querySelector('.boot-news')).toBeNull();
    expect(JSON.parse(storage.getItem(BOOT_KEY)!).seen).toBe(latestChangeDate());
    boot.hide();
  });

  it('shows only what came after the day last seen', () => {
    const oldest = CHANGES[CHANGES.length - 1].date;
    const storage = memoryStorage();
    storage.setItem(BOOT_KEY, JSON.stringify({ version: 1, last: 'arena', seen: oldest }));
    const boot = new BootScreen(storage, () => {});
    boot.show();
    key(document.getElementById('boot')!, 'x');
    expect(document.querySelectorAll('.boot-news-item').length).toBe(CHANGES.filter((change) => change.date > oldest).length);
    boot.hide();
  });

  it('is in English above the menu whatever the language', () => {
    const boot = new BootScreen(null, () => {});
    boot.show();
    key(document.getElementById('boot')!, 'x');
    expect(document.querySelector('.boot-log')?.textContent).toContain('Ready.');
  });
});

describe('the inspector', () => {
  it('rebuilds its tabs for the robots it is given, and can be pointed at one', async () => {
    const { Inspector } = await import('../src/ui/inspector');
    const tabs = document.createElement('div');
    const fields = document.createElement('div');
    document.body.append(tabs, fields);
    const inspector = new Inspector(tabs, fields, ['ALPHA', 'BRAVO']);
    expect([...tabs.children].map((tab) => tab.textContent)).toEqual(['ALPHA', 'BRAVO']);
    inspector.setRobots(['ALPHA-1', 'ALPHA-2', 'ALPHA-3', 'BRAVO-1', 'BRAVO-2', 'BRAVO-3']);
    expect(tabs.children).toHaveLength(6);
    expect(inspector.selected).toBe(0);
    inspector.select(4);
    expect(inspector.selected).toBe(4);
    expect(tabs.children[4].classList.contains('selected')).toBe(true);
    // An index out of range changes nothing.
    inspector.select(9);
    expect(inspector.selected).toBe(4);
  });
});

describe('the garage panel', () => {
  function panel() {
    const calls: string[] = [];
    const handlers: GarageHandlers = {
      save: (name, robotIndex) => void calls.push(`save ${name} ${robotIndex}`),
      load: (name, robotIndex) => void calls.push(`load ${name} ${robotIndex}`),
      remove: (name) => void calls.push(`remove ${name}`),
      share: async () => 'CODE',
      importCode: async () => true,
      saveFile: (name) => void calls.push(`file ${name}`),
      importFile: () => void calls.push('import file'),
    };
    const container = document.createElement('div');
    document.body.append(container);
    const garage = new GaragePanel(container, ['ALPHA', 'BRAVO'], handlers);
    garage.show(['Striker']);
    const nameInput = container.querySelector<HTMLInputElement>('.garage-name-input')!;
    const saveButtons = [...container.querySelectorAll<HTMLButtonElement>('.garage-save-buttons button')];
    return { calls, container, nameInput, saveButtons };
  }

  it('asks again before saving over a robot kept under the same name', () => {
    const { calls, nameInput, saveButtons } = panel();
    nameInput.value = 'Fresh';
    saveButtons[0].click();
    expect(calls).toEqual(['save Fresh 0']);
    nameInput.value = 'Striker';
    saveButtons[1].click();
    expect(calls).toEqual(['save Fresh 0']);
    expect(saveButtons[1].textContent).toBe('replace?');
    saveButtons[1].click();
    expect(calls).toEqual(['save Fresh 0', 'save Striker 1']);
  });

  it('deletes only on the second press, and keeps names to the length a name may have', () => {
    const { calls, container, nameInput } = panel();
    const remove = [...container.querySelectorAll<HTMLButtonElement>('.garage-action')].find((button) => button.textContent === '×')!;
    remove.click();
    expect(calls).toEqual([]);
    remove.click();
    expect(calls).toEqual(['remove Striker']);
    expect(nameInput.maxLength).toBe(16);
  });
});

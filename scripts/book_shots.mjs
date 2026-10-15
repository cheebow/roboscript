// Takes the book's pictures of the debugger (docs/images/book-debugger-{en,ja}.png)
// from the running game, so that they can be taken again when the screen changes.
//
//   npx vite --port 5199 --strictPort    (in another terminal)
//   node scripts/book_shots.mjs
//
// It drives a headless Chrome over the DevTools protocol: CHROME names the
// browser to use, the system's Google Chrome by default.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PAGE = process.env.PAGE ?? 'http://localhost:5199/index.html';
const PORT = 9333;
const SIZE = { width: 1280, height: 800 };
/** The match: the same seed every time, so the picture shows the same moment. */
const SEED = 1;
/** The line the ◆ goes on: `fire` in the sample program. */
const FOLLOWED_LINE = 15;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connect() {
  for (let tries = 0; tries < 50; tries++) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
      const page = targets.find((target) => target.type === 'page');
      if (page !== undefined) return new WebSocket(page.webSocketDebuggerUrl);
    } catch {
      // Not up yet.
    }
    await sleep(200);
  }
  throw new Error('Chrome did not start');
}

function client(socket) {
  let next = 0;
  const waiting = new Map();
  socket.addEventListener('message', (message) => {
    const data = JSON.parse(message.data);
    const resolve = waiting.get(data.id);
    if (resolve === undefined) return;
    waiting.delete(data.id);
    resolve(data);
  });
  return (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++next;
      waiting.set(id, (data) => (data.error ? reject(new Error(`${method}: ${data.error.message}`)) : resolve(data.result)));
      socket.send(JSON.stringify({ id, method, params }));
    });
}

async function shoot(send, language) {
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (exceptionDetails !== undefined) throw new Error(`${expression}: ${exceptionDetails.exception?.description ?? exceptionDetails.text}`);
    return result.value;
  };
  const until = async (expression, what) => {
    for (let tries = 0; tries < 100; tries++) {
      if (await evaluate(expression)) return;
      await sleep(100);
    }
    throw new Error(`Gave up waiting for ${what}`);
  };

  // A fresh start in the language asked for, straight to the program screen.
  await send('Page.navigate', { url: `${PAGE}?seed=${SEED}` });
  await until(`document.readyState === 'complete'`, 'the page');
  await evaluate(`localStorage.clear(); localStorage.setItem('roboscript/language', '${language}'); true`);
  await send('Page.navigate', { url: `${PAGE}?seed=${SEED}` });
  // Any key skips the start-up lines; then the first PROGRAM of the menu, the one-robot one.
  await until(`document.querySelector('.boot') !== null`, 'the start screen');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'x' })); true`);
  const program = language === 'ja' ? 'プログラム' : 'PROGRAM';
  const item = `[...document.querySelectorAll('.boot-item')].find((b) => b.querySelector('.boot-item-name')?.textContent.trim() === '${program}')`;
  await until(`${item} !== undefined`, 'the menu');
  await evaluate(`${item}.click(); true`);
  await until(`document.querySelector('#code .cm-lineNumbers') !== null && document.querySelector('#code').offsetParent !== null`, 'the editor');

  // DEBUG, then the ◆ on the line: the match stops where the line runs first.
  await evaluate(`document.querySelector('#debug').click(); true`);
  await sleep(500);
  await until(`[...document.querySelectorAll('#code .cm-lineNumbers .cm-gutterElement')].some((e) => e.textContent.trim() === '${FOLLOWED_LINE}')`, 'the line numbers');
  const box = await evaluate(`(() => {
    const element = [...document.querySelectorAll('#code .cm-lineNumbers .cm-gutterElement')].find((e) => e.textContent.trim() === '${FOLLOWED_LINE}');
    const r = element.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  for (const type of ['mousePressed', 'mouseReleased']) {
    await send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', clickCount: 1 });
  }
  await sleep(800);
  // The log beside it, scrolled to the moment shown.
  await evaluate(`document.querySelector('#log-tab-log')?.click(); true`);
  await evaluate(`(() => { const rows = document.querySelector('#log-rows'); const last = [...rows.querySelectorAll('.log-row:not(.future)')].pop(); last?.scrollIntoView({ block: 'end' }); return true; })()`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: SIZE.width - 1, y: SIZE.height - 1 });
  await sleep(500);

  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  const file = `docs/images/book-debugger-${language}.png`;
  writeFileSync(file, Buffer.from(data, 'base64'));
  console.log(`${file}: ${await evaluate(`document.querySelector('#message').textContent`)}`);
}

const profile = mkdtempSync(join(tmpdir(), 'book-shots-'));
const chrome = spawn(CHROME, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  `--window-size=${SIZE.width},${SIZE.height}`,
  '--hide-scrollbars',
  '--no-first-run',
  'about:blank',
], { stdio: 'ignore' });
try {
  const socket = await connect();
  await new Promise((resolve) => socket.addEventListener('open', resolve));
  const send = client(socket);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { ...SIZE, deviceScaleFactor: 2, mobile: false });
  for (const language of ['ja', 'en']) await shoot(send, language);
  socket.close();
} finally {
  chrome.kill();
}

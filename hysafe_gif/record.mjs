// Deterministic UI recorder: drives cursor + scroll on a timeline, captures PNG frames with per-frame dt.
import { CDP, listTargets, pickBlankPage, sleep } from './cdp.mjs';
import fs from 'node:fs';
import path from 'node:path';

const W = 1600, H = 1000, FPS = 15, FRAME = 1000 / FPS;

const which = process.argv[2] || 'home';
const outDir = path.resolve(process.argv[3] || ('frames_' + which));
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const page = await pickBlankPage();
const c = await CDP.connect(page.webSocketDebuggerUrl);
await c.send('Page.bringToFront');
await c.send('Page.enable');
await c.send('Runtime.enable');
await c.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

async function centerOf(text, opts = {}) {
  const js = `(() => {
    const want = ${JSON.stringify(text)};
    const exact = ${JSON.stringify(!!opts.exact)};
    const els = [...document.querySelectorAll('button,a,[role=button],div,span')];
    const hit = els.find(e => {
      const t = (e.innerText || '').trim();
      const ok = exact ? t === want : t.includes(want);
      if (!ok) return false;
      const r = e.getBoundingClientRect();
      return r.width > 4 && r.height > 4 && r.top >= 0 && r.bottom <= innerHeight + 200;
    });
    if (!hit) return null;
    const r = hit.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) };
  })()`;
  return await c.eval(js);
}

const frames = [];
let t0 = 0;
let mouse = { x: 1580, y: 980, visible: false, down: false };
let lastDispatch = { x: -1, y: -1 };

const easeOut = (p) => 1 - Math.pow(1 - p, 3);
const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
const lerp = (a, b, p) => a + (b - a) * p;

function moveTo(p) {
  if (p.visible !== undefined) mouse.visible = p.visible;
  if (p.x !== undefined) mouse.x = p.x;
  if (p.y !== undefined) mouse.y = p.y;
}

async function dispatchMove(force = false) {
  const x = Math.round(mouse.x), y = Math.round(mouse.y);
  if (!force && x === lastDispatch.x && y === lastDispatch.y) return;
  lastDispatch = { x, y };
  await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: mouse.down ? 'left' : 'none', buttons: mouse.down ? 1 : 0 });
}
async function press() {
  mouse.down = true;
  await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: Math.round(mouse.x), y: Math.round(mouse.y), button: 'left', buttons: 1, clickCount: 1 });
}
async function release() {
  mouse.down = false;
  await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: Math.round(mouse.x), y: Math.round(mouse.y), button: 'left', buttons: 0, clickCount: 1 });
}
async function wheel(dy) {
  await c.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: Math.round(mouse.x), y: Math.round(mouse.y), deltaX: 0, deltaY: dy });
}

// ---- timeline definition -------------------------------------------------
// Each entry: { t: startMs, dur: ms, kind, ... }
// kinds: wait | move (to x,y) | press | release | wheel (dy over dur, ticks)
async function buildTimeline() {
  if (which === 'home') {
    const browse = await centerOf('浏览服务');
    const guide = await centerOf('下单必看');
    const navServices = await centerOf('服务', { exact: true });
    return {
      nav: 'https://hysafe.top/',
      settle: 0,
      steps: [
        { t: 0, kind: 'wait' },
        { t: 950, kind: 'cursorIn', x: 1480, y: 905 },
        { t: 1050, kind: 'move', to: browse, dur: 620 },
        { t: 1720, kind: 'wait' },
        { t: 2080, kind: 'move', to: guide, dur: 520 },
        { t: 2650, kind: 'wait' },
        { t: 2700, kind: 'press' },
        { t: 2760, kind: 'release' },
        { t: 2900, kind: 'wait' },
        { t: 4300, kind: 'wait' },
      ],
      total: 4700,
    };
  }
  if (which === 'services') {
    const buy = await centerOf('选 TA 下单');
    const picker = await centerOf('嘉豪');
    return {
      nav: 'https://hysafe.top/#/services',
      settle: 0,
      steps: [
        { t: 0, kind: 'wait' },
        { t: 900, kind: 'cursorIn', x: 1500, y: 880 },
        { t: 1000, kind: 'move', to: { x: 700, y: 500 }, dur: 400 },
        { t: 1450, kind: 'scroll', dy: 420, dur: 900 },
        { t: 2500, kind: 'wait' },
        { t: 2900, kind: 'scroll', dy: -420, dur: 700 },
        { t: 3750, kind: 'move', to: buy, dur: 550 },
        { t: 4400, kind: 'wait' },
        { t: 4450, kind: 'press' },
        { t: 4510, kind: 'release' },
        { t: 4900, kind: 'move', to: picker, dur: 400 },
        { t: 5350, kind: 'press' },
        { t: 5410, kind: 'release' },
        { t: 5800, kind: 'move', to: await centerOf('提交订单'), dur: 500 },
        { t: 6600, kind: 'wait' },
      ],
      total: 7000,
    };
  }
}

// ---- run -----------------------------------------------------------------
const tl = await buildTimeline();
await c.send('Page.navigate', { url: tl.nav });
const start = Date.now();
t0 = performance.now();

let stepIdx = 0;
let scrollState = null;
const stepStart = new Map();

let frameNo = 0;
let lastCapture = performance.now();

while (true) {
  const now = performance.now() - t0;
  if (now > tl.total) break;

  // advance steps whose start time passed
  while (stepIdx < tl.steps.length && tl.steps[stepIdx].t <= now) {
    const s = tl.steps[stepIdx];
    stepStart.set(stepIdx, performance.now());
    if (s.kind === 'cursorIn') { moveTo({ visible: true, x: s.x, y: s.y }); await dispatchMove(true); }
    if (s.kind === 'press') await press();
    if (s.kind === 'release') await release();
    if (s.kind === 'scroll') scrollState = { dyTotal: s.dy, dur: s.dur, from: performance.now(), acc: 0 };
    stepIdx++;
  }
  // interpolate active move steps
  for (let i = 0; i < tl.steps.length; i++) {
    const s = tl.steps[i];
    if (s.kind !== 'move') continue;
    const st = stepStart.get(i);
    if (st === undefined) continue;
    const p = Math.min(1, (performance.now() - st) / s.dur);
    const prev = i > 0 ? tl.steps[i - 1] : null;
    const fromX = (prev && prev.kind === 'move' && prev.to ? prev.to.x : (prev && prev.kind === 'cursorIn' ? prev.x : mouse.x));
    const fromY = (prev && prev.kind === 'move' && prev.to ? prev.to.y : (prev && prev.kind === 'cursorIn' ? prev.y : mouse.y));
    const e = easeInOut(p);
    moveTo({ x: lerp(fromX, s.to.x, e), y: lerp(fromY, s.to.y, e) });
  }
  if (scrollState) {
    const p = Math.min(1, (performance.now() - scrollState.from) / scrollState.dur);
    const target = scrollState.dyTotal * easeInOut(p);
    const delta = target - scrollState.acc;
    scrollState.acc = target;
    if (Math.abs(delta) > 0.5) await wheel(delta);
    if (p >= 1) scrollState = null;
  }
  if (mouse.visible) await dispatchMove();

  const png = await c.screenshot();
  const ts = performance.now();
  const dt = Math.round((ts - lastCapture) / 10) * 10;
  lastCapture = ts;
  frames.push({ i: frameNo, file: `f${String(frameNo).padStart(4, '0')}.png`, dt: Math.max(40, dt), cursor: { ...mouse } });
  fs.writeFileSync(path.join(outDir, frames[frameNo].file), png);
  frameNo++;

  const el = performance.now() - start;
  const want = frameNo * FRAME;
  const sleepMs = want - el;
  if (sleepMs > 0) await sleep(sleepMs);
}

fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify({ w: W, h: H, fps: FPS, frames }, null, 1));
console.log('frames:', frames.length, 'dir:', outDir);
c.close();

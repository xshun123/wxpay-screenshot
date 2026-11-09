// Deterministic UI recorder: drives cursor + scroll on a timeline, captures PNG frames with per-frame dt.
import { CDP, listTargets, pickBlankPage, sleep } from './cdp.mjs';
import fs from 'node:fs';
import path from 'node:path';

const W = 1600, H = 1000, FPS = 12, FRAME = 1000 / FPS;

const which = process.argv[2] || 'home';
const outDir = path.resolve(process.argv[3] || ('frames_' + which));
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const page = await pickBlankPage();
const c = await CDP.connect(page.webSocketDebuggerUrl);
await c.send('Page.bringToFront');
{ const o = c.send.bind(c); let n = 0; c.send = async (m, p) => { n++; try { return await o(m, p); } catch (e) { console.log('FAIL@' + n, m, e.message, JSON.stringify(p).slice(0,120)); throw e; } }; }
await c.send('Page.enable');
await c.send('Runtime.enable');
await c.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });

async function centerOf(text, opts = {}) {
  const js = `(() => {
    const want = ${JSON.stringify(text)};
    const exact = ${JSON.stringify(!!opts.exact)};
    let hit = null, bestArea = Infinity;
    for (const e of document.querySelectorAll('button,a,[role=button],div,span,li,section')) {
      const t = (e.innerText || '').trim();
      const ok = exact ? t === want : t.includes(want);
      if (!ok) continue;
      const r = e.getBoundingClientRect();
      if (r.width <= 4 || r.height <= 4) continue;
      if (r.top < 0 || r.bottom > innerHeight + 200) continue;
      const area = r.width * r.height;
      if (area < bestArea) { bestArea = area; hit = e; }
    }
    if (!hit) return null;
    const r = hit.getBoundingClientRect();
    return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), w: Math.round(r.width), h: Math.round(r.height) };
  })()`;
  return await c.eval(js);
}

async function waitFor(text, opts = {}, timeout = 25000) {
  const t0 = performance.now();
  while (performance.now() - t0 < timeout) {
    const ctr = await centerOf(text, opts);
    if (ctr) return ctr;
    await sleep(350);
  }
  console.log('waitFor timeout:', text);
  return null;
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
    const browse = await waitFor('浏览服务');
    const guide = await waitFor('下单必看');
    const okBtn = await centerOf('我知道了');
    console.log('HOME targets', JSON.stringify({ browse, guide, okBtn }));
    return {
      nav: 'https://hysafe.top/',
      steps: [
        { t: 0, kind: 'wait' },
        { t: 380, kind: 'cursorIn', x: 1470, y: 890 },
        { t: 460, kind: 'move', to: browse, dur: 620 },
        { t: 1680, kind: 'wait' },
        { t: 1980, kind: 'move', to: guide, dur: 520 },
        { t: 2560, kind: 'wait' },
        { t: 2620, kind: 'press' },
        { t: 2690, kind: 'release' },
        { t: 2950, kind: 'wait' },
        { t: 4250, kind: 'wait' },
        { t: 4300, kind: 'moveText', text: '我知道了', dur: 420 },
        { t: 4760, kind: 'wait' },
        { t: 4830, kind: 'press' },
        { t: 4900, kind: 'release' },
        { t: 5500, kind: 'wait' },
      ],
      total: 5900,
    };
  }
  if (which === 'services') {
    const buy = await waitFor('选 TA 下单');
    console.log('SERVICES buy', JSON.stringify(buy));
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
        { t: 4450, kind: 'wait' },
        { t: 4520, kind: 'press' },
        { t: 4590, kind: 'release' },
        { t: 4900, kind: 'wait' },
        { t: 5000, kind: 'moveText', text: '服务数量', exact: false, dur: 420 },
        { t: 5500, kind: 'wait' },
        { t: 5900, kind: 'moveText', text: '提交订单', dur: 520 },
        { t: 6700, kind: 'wait' },
      ],
      total: 7200,
    };
  }
}

// ---- run -----------------------------------------------------------------
const which_url = which === 'services' ? 'https://hysafe.top/#/services' : 'https://hysafe.top/';
await c.send('Page.navigate', { url: which_url });
await sleep(1200); // let the SPA start mounting; waitFor() handles the rest

const tl = await buildTimeline();
if (!tl) throw new Error('no timeline');
// reload so the recorded clip starts from a clean page state
await c.send('Page.navigate', { url: which_url });
const start = performance.now();
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
    if (s.kind === 'moveText') {
      const ctr = await centerOf(s.text, { exact: !!s.exact });
      console.log('resolved', s.text, JSON.stringify(ctr));
      s.kind = 'move';
      s.to = ctr || { x: Math.round(mouse.x), y: Math.round(mouse.y) };
      s.dur = s.dur || 400;
    }
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

  let png = null;
  for (let att = 0; att < 8; att++) {
    try { png = await c.screenshot(); break; }
    catch (e) {
      if (!/Not attached to an active page/.test(e.message)) throw e;
      await sleep(60);
    }
  }
  if (!png) continue;
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

import { CDP, pickBlankPage, sleep } from './cdp.mjs';
import fs from 'node:fs';
import path from 'node:path';

const W = 1080, H = 1080, FPS = 15, TOTAL = 7400;
const outDir = path.resolve('frames_ad');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const page = await pickBlankPage();
const c = await CDP.connect(page.webSocketDebuggerUrl);
await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Page.bringToFront');
await c.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
const url = 'file:///C:/Users/Administrato_i2t0cbm/Desktop/' + encodeURIComponent('hysafe动图') + '/ad/ad.html';
await c.send('Page.navigate', { url });
await sleep(1800);
await c.eval("document.fonts ? document.fonts.ready.then(()=>1) : 1");
console.log('title', await c.eval('document.title'), 'renderAt?', await c.eval('typeof window.renderAt'));

const frames = [];
const n = Math.round(TOTAL * FPS / 1000);
for (let i = 0; i < n; i++) {
  const t = Math.round(i * 1000 / FPS);
  await c.eval('window.renderAt(' + t + ')');
  let png = null;
  for (let a = 0; a < 6; a++) {
    try { png = await c.screenshot(); break; } catch (e) { if (!/Not attached/.test(e.message)) throw e; await sleep(50); }
  }
  if (!png) continue;
  const f = 'f' + String(i).padStart(4, '0') + '.png';
  fs.writeFileSync(path.join(outDir, f), png);
  frames.push({ file: f, t, dt: 1000 / FPS });
}
fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify({ w: W, h: H, fps: FPS, frames }, null, 0));
console.log('frames', frames.length);
c.close();

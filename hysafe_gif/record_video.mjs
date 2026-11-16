import { CDP, pickBlankPage, sleep } from './cdp.mjs';
import fs from 'node:fs';
import path from 'node:path';

const W = 720, H = 720, DSF = 1.5, FPS = 30, TOTAL = 4000;  // 720 逻辑像素 × 1.5 = 1080 输出
const outDir = path.resolve('frames_vid');
fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const page = await pickBlankPage();
const c = await CDP.connect(page.webSocketDebuggerUrl);
await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Page.bringToFront');
await c.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DSF, mobile: false });
await c.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
const url = 'file:///C:/Users/Administrato_i2t0cbm/Desktop/' + encodeURIComponent('hysafe动图') + '/ad/ad_trans.html';
await c.send('Page.navigate', { url });
await sleep(1500);
console.log('renderAt?', await c.eval('typeof window.renderAt'));

const n = Math.round(TOTAL * FPS / 1000);
let written = 0;
for (let i = 0; i < n; i++) {
  const t = (i * 1000) / FPS;
  await c.eval('window.renderAt(' + Math.round(t) + ')');
  let png = null;
  for (let a = 0; a < 6; a++) {
    try {
      const r = await c.send('Page.captureScreenshot', { format: 'png', optimizeForSpeed: true, omitBackground: true });
      png = Buffer.from(r.data, 'base64'); break;
    } catch (e) { if (!/Not attached/.test(e.message)) throw e; await sleep(50); }
  }
  if (!png) continue;
  fs.writeFileSync(path.join(outDir, 'f' + String(i).padStart(4, '0') + '.png'), png);
  written++;
}
console.log('frames', written);
c.close();

import { CDP, listTargets, sleep } from './cdp.mjs';
import fs from 'node:fs';

const targets = await listTargets();
const page = targets.find(t => t.type === 'page');
const c = await CDP.connect(page.webSocketDebuggerUrl);
await c.send('Page.enable'); await c.send('Runtime.enable');
await c.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
await c.send('Page.navigate', { url: 'https://hysafe.top/' });
await sleep(4000);

// rects of key elements
const rects = await c.eval(`JSON.stringify([...document.querySelectorAll('button,a')].map((e,i)=>{const r=e.getBoundingClientRect();return {i,text:(e.innerText||'').trim().slice(0,20),x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),w:Math.round(r.width),h:Math.round(r.height)}}).filter(o=>o.w>0&&o.h>0))`);
console.log('RECTS_HOME', rects);

// click 下单必看
const idx = JSON.parse(rects).find(o => o.text.includes('下单必看'));
await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: idx.x, y: idx.y });
await sleep(300);
for (const type of ['mousePressed','mouseReleased']) {
  await c.send('Input.dispatchMouseEvent', { type, x: idx.x, y: idx.y, button: 'left', clickCount: 1 });
}
await sleep(1500);
fs.writeFileSync('probe_modal1.png', await c.screenshot());
console.log('AFTER CLICK 下单必看:', (await c.eval('document.body.innerText.slice(0,600)')).replace(/\n+/g,' | '));
await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
await sleep(800);

// go services
await c.send('Page.navigate', { url: 'https://hysafe.top/#/services' });
await sleep(3000);
const r2 = JSON.parse(await c.eval(`JSON.stringify([...document.querySelectorAll('button,a')].map((e,i)=>{const r=e.getBoundingClientRect();return {i,text:(e.innerText||'').trim().slice(0,26),x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2),w:Math.round(r.width),h:Math.round(r.height)}}).filter(o=>o.w>0&&o.h>0))`));
console.log('RECTS_SERVICES', JSON.stringify(r2.filter(o=>o.text.includes('下单')||o.text.includes('全部')||o.text.length<6).slice(0,12)));
const buy = r2.find(o => o.text.includes('选 TA 下单'));
console.log('BUY btn', JSON.stringify(buy));
if (buy) {
  await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: buy.x, y: buy.y });
  await sleep(400);
  for (const type of ['mousePressed','mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, x: buy.x, y: buy.y, button: 'left', clickCount: 1 });
  await sleep(1800);
  fs.writeFileSync('probe_order.png', await c.screenshot());
  console.log('AFTER BUY:', (await c.eval('document.body.innerText.slice(0,800)')).replace(/\n+/g,' | '));
}
c.close();

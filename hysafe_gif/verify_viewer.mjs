import { CDP, pickBlankPage, sleep } from './cdp.mjs';
import fs from 'node:fs';
const url = 'file:///C:/Users/Administrato_i2t0cbm/Desktop/' + encodeURIComponent('hysafe动图') + '/viewer.html';
const page = await pickBlankPage();
const c = await CDP.connect(page.webSocketDebuggerUrl);
await c.send('Page.enable'); await c.send('Runtime.enable'); await c.send('Page.bringToFront');
await c.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await c.send('Page.navigate', { url });
await sleep(2500);
fs.writeFileSync('v_mobile.png', await c.screenshot());
console.log('title', await c.eval('document.title'));
console.log('gallery', await c.eval("JSON.stringify({imgs:[...document.images].map(i=>({src:i.getAttribute('src'),w:i.clientWidth,h:i.clientHeight})),h:document.documentElement.scrollHeight})"));
// tap first image
const box = JSON.parse(await c.eval("(()=>{const r=document.querySelector('.shot').getBoundingClientRect();return JSON.stringify({x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)})})()"));
for (const type of ['mousePressed','mouseReleased']) await c.send('Input.dispatchMouseEvent', { type, x: box.x, y: box.y, button: 'left', buttons: type==='mousePressed'?1:0, clickCount: 1 });
await sleep(900);
console.log('viewer on', await c.eval("document.getElementById('viewer').classList.contains('on')"));
fs.writeFileSync('v_viewer.png', await c.screenshot());
// simulate pinch-ish: wheel zoom
await c.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 195, y: 400, deltaX: 0, deltaY: -240 });
await sleep(500);
console.log('transform', await c.eval("document.getElementById('vimg').style.transform"));
fs.writeFileSync('v_zoom.png', await c.screenshot());
// done button
const d = JSON.parse(await c.eval("(()=>{const r=document.getElementById('vdone').getBoundingClientRect();return JSON.stringify({x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)})})()"));
console.log('doneBtn', JSON.stringify(d));
c.close();

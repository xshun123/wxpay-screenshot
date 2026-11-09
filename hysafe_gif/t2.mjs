import { CDP, pickBlankPage, sleep } from './cdp.mjs';
const page = await pickBlankPage();
const c = await CDP.connect(page.webSocketDebuggerUrl);
await c.send('Page.enable'); await c.send('Page.bringToFront');
await c.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
await c.send('Page.navigate', { url: 'https://hysafe.top/' });
await sleep(4000);
const ts = [];
for (let i = 0; i < 15; i++) { const a = performance.now(); await c.screenshot(); ts.push(Math.round(performance.now() - a)); }
console.log('capture ms:', ts.join(','));
console.log('avg', Math.round(ts.reduce((a,b)=>a+b,0)/ts.length));
c.close();

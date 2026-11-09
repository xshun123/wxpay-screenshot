import { CDP, listTargets, sleep } from './cdp.mjs';

const targets = await listTargets();
const page = targets.find(t => t.type === 'page');
const c = await CDP.connect(page.webSocketDebuggerUrl);
await c.send('Page.enable');
await c.send('Runtime.enable');
await c.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
await c.send('Page.navigate', { url: 'https://hysafe.top/' });
await sleep(6000);
const t = await c.eval('document.title');
const txt = await c.eval('document.body.innerText.slice(0,3000)');
const info = await c.eval(`JSON.stringify({
  href: location.href,
  scrollH: document.documentElement.scrollHeight,
  innerH: window.innerHeight,
  buttons: [...document.querySelectorAll('a,button')].slice(0,80).map(e=>({tag:e.tagName,text:(e.innerText||'').trim().slice(0,30),href:e.getAttribute('href')})),
})`);
console.log('TITLE:', t);
console.log('INFO:', info);
console.log('TEXT:\n' + txt);
c.close();

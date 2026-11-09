import { CDP, listTargets, sleep } from './cdp.mjs';
import fs from 'node:fs';

const targets = await listTargets();
const page = targets.find(t => t.type === 'page');
const c = await CDP.connect(page.webSocketDebuggerUrl);
await c.send('Page.enable');
await c.send('Runtime.enable');
await c.send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });

async function go(hash, file, wait = 3500) {
  await c.send('Page.navigate', { url: 'https://hysafe.top/' + hash });
  await sleep(wait);
  const png = await c.screenshot();
  fs.writeFileSync(file, png);
  const txt = await c.eval('document.body.innerText.slice(0,1500)');
  const meta = await c.eval("JSON.stringify({h:document.documentElement.scrollHeight,w:document.documentElement.scrollWidth})");
  console.log('=== ' + hash + ' ' + meta);
  console.log(txt);
}

await go('', 'shot_home.png');
await go('#/services', 'shot_services.png');
await go('#/orders', 'shot_orders.png').catch(e=>console.log('orders fail', e.message));
c.close();

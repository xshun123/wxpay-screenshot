import { CDP, pickBlankPage, sleep } from './cdp.mjs';
const page = await pickBlankPage();
const c = await CDP.connect(page.webSocketDebuggerUrl);
await c.send('Page.enable'); await c.send('Runtime.enable');
await c.send('Network.enable');
await c.send('Page.navigate', { url: 'https://hysafe.top/' });
for (let i = 0; i < 8; i++) {
  await sleep(2500);
  const s = await c.eval("JSON.stringify({href:location.href,title:document.title,ready:document.readyState,body:document.body?document.body.innerText.slice(0,200):null})");
  console.log(i, s);
  if (s && s.includes('浏览服务')) break;
}
const errs = c.events.filter(e => ['Network.loadingFailed','Runtime.exceptionThrown','Page.javascriptDialogOpening'].includes(e.method));
console.log('events', JSON.stringify(errs).slice(0, 1200));
c.close();

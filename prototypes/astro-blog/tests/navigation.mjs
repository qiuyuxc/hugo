import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = process.env.PREVIEW_ORIGIN || 'http://127.0.0.1:8085';
const browser = process.env.CDP_URL || 'http://127.0.0.1:9227';
const artifacts = new URL('../../../.local/astro-navigation-qa/', import.meta.url);
const target = await (await fetch(`${browser}/json/new?about:blank`, { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let sequence = 0;
const pending = new Map();
const errors = [];
const heldRequests = [];
const consoleErrors = [];
const pause = duration => new Promise(resolve => setTimeout(resolve, duration));
function command(method, params = {}, sessionId) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
}
socket.addEventListener('message', async event => {
  const message = JSON.parse(event.data);
  if (message.id) {
    const handler = pending.get(message.id);
    if (!handler) return;
    clearTimeout(handler.timer);
    pending.delete(message.id);
    if (message.error) handler.reject(new Error(JSON.stringify(message.error)));
    else handler.resolve(message.result);
  }
  if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') consoleErrors.push(message.params.args);
  if (message.method === 'Fetch.requestPaused') heldRequests.push(message.params.requestId);
});
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(expression, label, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(expression)) return;
    await pause(100);
  }
  throw new Error(`Timeout: ${label}`);
}
async function go(path) {
  await command('Page.navigate', { url: origin + path });
  await waitFor(`location.pathname === ${JSON.stringify(path.split('?')[0])} && document.readyState === 'complete'`, path);
  await pause(300);
}
async function click(selector) {
  await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
}
async function spa(selector, path) {
  await evaluate('window.__sameDocument = 173; window.__loaded = false; document.addEventListener("astro:page-load", () => window.__loaded = true, {once: true})');
  await click(selector);
  await waitFor(`location.pathname === ${JSON.stringify(path)} && window.__loaded`, `SPA ${path}`);
  assert.equal(await evaluate('window.__sameDocument'), 173, 'Unexpected full reload');
  await pause(150);
}
async function screenshot(name) {
  await mkdir(artifacts, { recursive: true });
  const result = await command('Page.captureScreenshot', { format: 'png' });
  await writeFile(new URL(`${name}.png`, artifacts), Buffer.from(result.data, 'base64'));
}


const evidence = [];
try {
 await command('Page.enable'); await command('Runtime.enable'); await command('Network.enable');
 await command('Network.setCacheDisabled',{cacheDisabled:true});
 await command('Network.setBypassServiceWorker',{bypass:true});
 await command('Storage.clearDataForOrigin',{origin,storageTypes:'all'});
 await command('Page.addScriptToEvaluateOnNewDocument',{source:`
  localStorage.setItem('kukie-announcement-dismissed-date',new Date().toLocaleDateString('sv'));
  window.__sameDocument=735;
  window.__marks=[];
  new PerformanceObserver(list=>list.getEntries().forEach(e=>window.__marks.push({name:'longtask',time:e.startTime,duration:e.duration}))).observe({type:'longtask',buffered:true});
  const animate = Element.prototype.animate;
  Element.prototype.animate = function(keyframes, options) {
    if (options?.id === 'page-enter') window.__marks.push({name:'entry-start',time:performance.now()});
    return animate.call(this,keyframes,options);
  };
  for(const name of ['astro:before-preparation','astro:after-preparation','astro:before-swap','astro:after-swap','astro:page-load'])document.addEventListener(name,()=>{
    const loader=document.querySelector('#page-loader');
    const mark={name,time:performance.now(),loaderVisible:loader ? !loader.hidden : false,sameLoader:window.__routeLoader ? loader===window.__routeLoader : undefined};
    window.__marks.push(mark);
    if(name==='astro:before-swap' && window.__loaderSpin) mark.spinTime=window.__loaderSpin.currentTime;
    if(name==='astro:after-swap' && window.__loaderSpin) queueMicrotask(()=>{mark.spinTime=document.querySelector('.page-loader-cube-outer').getAnimations()[0]?.currentTime});
  });
 `});
 await command('Emulation.setDeviceMetricsOverride',{width:375,height:900,deviceScaleFactor:1,mobile:false});
 await go('/'); await pause(500);
 assert.equal(await evaluate('document.querySelector("#page-loader").hidden'),true,'No idle loading overlay');
 await evaluate('document.querySelector(".post-row h3 a").scrollIntoView({block:"center",behavior:"instant"})');
 await command('Fetch.enable',{patterns:[{urlPattern:`${origin}/posts/axisnow-cdn/*`}]});
 await evaluate('window.__marks=[];window.__clicked=performance.now()');
 await click('.post-row h3 a');
 await pause(120);
 const pending = await evaluate('({path:location.pathname,opacity:+getComputedStyle(document.querySelector("main")).opacity,marks:window.__marks})');
 evidence.push({stage:'response still blocked',...pending});
 assert.equal(pending.path,'/');
 assert.ok(pending.opacity < 0.95,'Content must start leaving while article HTML is still pending');
 const requestDeadline = Date.now() + 5000;
 while (!heldRequests.length && Date.now() < requestDeadline) await pause(50);
 assert.ok(heldRequests.length > 0,'Article request must reach the controlled network fixture');
 assert.equal(await evaluate('document.querySelector("#page-loader").hidden'),false,'Show loading feedback while the request is blocked');
 assert.equal(await evaluate('document.querySelector("#page-loader").getAttribute("aria-hidden")'),null);
 const firstAngle = await evaluate('window.__routeLoader=document.querySelector("#page-loader");window.__loaderSpin=document.querySelector(".page-loader-cube-outer").getAnimations()[0];getComputedStyle(document.querySelector(".page-loader-cube-outer")).transform');
 await pause(180);
 assert.notEqual(await evaluate('getComputedStyle(document.querySelector(".page-loader-cube-outer")).transform'),firstAngle,'The 3D cube must rotate during the wait');
 assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'),true);
 const theme = await evaluate('document.documentElement.dataset.theme');
 await click('.theme-toggle');
 assert.equal(await evaluate('document.documentElement.dataset.theme'),theme,'Theme snapshots must wait for pending route transitions');
 await screenshot('request-pending');
 await command('Emulation.setCPUThrottlingRate',{rate:4});
 await evaluate(`window.__samples=[];window.__sampling=true;function sample(t){window.__samples.push({time:t,path:location.pathname,opacity:+getComputedStyle(document.querySelector('main')).opacity,animations:document.getAnimations().map(a=>a.id||a.animationName)});if(window.__sampling)requestAnimationFrame(sample)}requestAnimationFrame(sample)`);
 await Promise.all(heldRequests.splice(0).map(requestId=>command('Fetch.continueRequest',{requestId})));
 await waitFor('location.pathname === "/posts/axisnow-cdn/" && !document.querySelector("main").hasAttribute("data-page-entering")','article revealed');
 await pause(850);
 const samples = await evaluate('window.__sampling=false;window.__samples');
 const entry = samples.filter(s=>s.path==='/posts/axisnow-cdn/' && s.opacity>0 && s.opacity<0.98);
 assert.ok(entry.length >= 3,`New article must paint intermediate frames, got ${entry.length}`);
 assert.equal(await evaluate('window.__sameDocument'),735);
 assert.equal(await evaluate('+getComputedStyle(document.querySelector("main")).opacity'),1);
 assert.equal(await evaluate('document.querySelector("#page-loader").hidden'),true,'Remove loading feedback once content has entered');
 assert.equal(await evaluate('document.querySelector("#page-loader") === window.__routeLoader'),true,'Keep one loader across the DOM swap');
 assert.equal(await evaluate('window.__marks.find(mark=>mark.name==="astro:after-swap").loaderVisible'),true,'Keep the loader visible during page layout');
 assert.equal(await evaluate('window.__marks.find(mark=>mark.name==="astro:after-swap").spinTime >= window.__marks.find(mark=>mark.name==="astro:before-swap").spinTime'),true,'The cube rotation must continue across the DOM swap');
 await click('.theme-toggle');
 await waitFor(`document.documentElement.dataset.theme !== ${JSON.stringify(theme)} && !document.documentElement.classList.contains('theme-transition')`, 'theme available after route entry');
 evidence.push({stage:'four-times CPU slowdown',entryFrames:entry.length,samples:entry.map(s=>({time:s.time,opacity:s.opacity})),entryDuration:entry.at(-1).time-entry[0].time,marks:await evaluate('window.__marks')});
 await command('Emulation.setCPUThrottlingRate',{rate:1});
 await command('Fetch.disable');
 await spa('.primary-links a[href="/"]','/'); await pause(400);
 await command('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 await command('Fetch.enable',{patterns:[{urlPattern:`${origin}/posts/axisnow-cdn/*`}]});
 await click('.post-row h3 a');await pause(250);
 await screenshot('request-pending-dark-desktop');
 await spa('.primary-links a[href="/archives/"]','/archives/');
 await Promise.all(heldRequests.splice(0).map(requestId=>command('Fetch.continueRequest',{requestId}).catch(()=>{})));
 await pause(500);
 assert.equal(await evaluate('location.pathname'),'/archives/');
 assert.equal(await evaluate('+getComputedStyle(document.querySelector("main")).opacity'),1);
 assert.equal(await evaluate('document.querySelector("main").hasAttribute("data-page-entering")'),false);
 assert.equal(await evaluate('document.querySelector("#page-loader").hidden'),true,'Canceled navigation must not leave a loading overlay');
 evidence.push({stage:'superseded navigation',result:'restored visible latest page'});
 await command('Fetch.disable');
 await command('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await spa('.primary-links a[href="/"]','/');
 await command('Fetch.enable',{patterns:[{urlPattern:`${origin}/posts/axisnow-cdn/*`}]});
 await click('.post-row h3 a');await pause(150);
 assert.equal(await evaluate('document.querySelector("#page-loader").hidden'),false);
 assert.equal(await evaluate('document.querySelector("#page-loader").getAnimations({subtree:true}).length'),0,'Reduced motion keeps a static loading indicator');
 await Promise.all(heldRequests.splice(0).map(requestId=>command('Fetch.continueRequest',{requestId})));
 await waitFor('location.pathname === "/posts/axisnow-cdn/" && document.querySelector("#page-loader").hidden','reduced motion completes');
 assert.equal(await evaluate('+getComputedStyle(document.querySelector("main")).opacity'),1);
 assert.equal(await evaluate('document.getAnimations().some(a=>a.id==="page-enter"||a.id==="page-leave")'),false);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({result:'PASS',evidence,consoleErrors},null,2));
} catch(error) {
 console.error(error);console.error(JSON.stringify(evidence,null,2));
 await screenshot('failure').catch(()=>{});process.exitCode=1;
} finally {
 await command('Fetch.disable').catch(()=>{});
 await command('Emulation.setCPUThrottlingRate',{rate:1}).catch(()=>{});
 socket.close();await fetch(`${browser}/json/close/${target.id}`);
}

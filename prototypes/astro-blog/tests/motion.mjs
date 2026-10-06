import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const origin = process.env.PREVIEW_ORIGIN || 'http://127.0.0.1:8085';
const browser = process.env.CDP_URL || 'http://127.0.0.1:9227';
const artifacts = new URL('../../../.local/astro-motion-qa/', import.meta.url);
const target = await (await fetch(`${browser}/json/new?about:blank`, { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let sequence = 0;
const pending = new Map();
const errors = [];
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
  if (message.method === 'Fetch.requestPaused') {
    await command('Fetch.fulfillRequest', {
      requestId: message.params.requestId, responseCode: 200,
      responseHeaders: [{name:'Content-Type',value:'application/json'}, {name:'Access-Control-Allow-Origin',value:'*'}],
      body: Buffer.from(JSON.stringify({enabled:true,badge:'站点公告',text:'这是一段用于检查公告动效的内容。',link:'https://www.kukie.cn/'})).toString('base64')
    });
  }
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

const routes = [
  ['.primary-links a[href="/archives/"]', '/archives/'],
  ['.primary-links a[href="/categories/"]', '/categories/'],
  ['.primary-links a[href="/links/"]', '/links/'],
  ['a[href="/about/"]', '/about/'],
  ['.search-trigger', '/search/'],
  ['.primary-links a[href="/"]', '/'],
  ['.post-row h3 a', '/posts/axisnow-cdn/'],
  ['.article-back', '/'],
];
const checks = [];
try {
  await command('Page.enable');
  await command('Runtime.enable');
  await command('Network.enable');
  await command('Fetch.enable', {patterns:[{urlPattern:'*notice.json*'}]});
  // The browser profile must be dedicated to QA; never use a personal browser profile.
  await command('Storage.clearDataForOrigin', { origin, storageTypes: 'all' });
  await command('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__animations = [];
    const animate = Element.prototype.animate;
    Element.prototype.animate = function(keyframes, options) {
      const animation = animate.call(this, keyframes, options);
      window.__animations.push({name:animation.id, frames:animation.effect?.getKeyframes()});
      return animation;
    };
    document.addEventListener('animationstart', event => window.__animations.push({name:event.animationName, target:event.target.id}));
    for (const name of ['astro:after-swap', 'astro:page-load']) document.addEventListener(name, () => {
      requestAnimationFrame(() => requestAnimationFrame(() => {
        for (const animation of document.getAnimations()) window.__animations.push({name:animation.animationName, frames:animation.effect?.getKeyframes()});
      }));
    });
  ` });
  await command('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1040, deviceScaleFactor: 1, mobile: false });
  await go('/');
  assert.ok(await evaluate('window.__animations.some(a=>a.name==="page-enter" && a.target==="main")'), 'Cold page entry must animate');
  await waitFor('document.querySelector("#announcement-dialog")?.open', 'announcement');
  await waitFor('document.querySelector("#announcement-dialog").dataset.state === "ready"', 'announcement ready');
  await evaluate('document.querySelector("#announcement-today").checked=true');
  await click('[data-dismiss-announcement]');
  assert.equal(await evaluate('document.querySelector("#announcement-dialog").dataset.state'), 'closing');
  await waitFor('!document.querySelector("#announcement-dialog").open', 'animated close');
  checks.push('cold entry and animated dismissal');
  for (const fallback of [false, true]) {
    let override;
    if (fallback) override = await command('Page.addScriptToEvaluateOnNewDocument', {source:'document.startViewTransition = undefined;'});
    await go('/');
    for (const [selector, path] of routes) {
      await evaluate('window.__animations=[]');
      await spa(selector, path);
      await pause(400);
      assert.ok(await evaluate('window.__animations.some(a=>a.name==="page-enter")'), `Missing entry: ${path}, fallback=${fallback}`);
      assert.ok(await evaluate('window.__animations.some(a=>a.name==="page-leave")'), `Missing exit: ${path}, fallback=${fallback}`);
      assert.equal(await evaluate('document.documentElement.hasAttribute("data-page-entry")'), false, 'SPA must not replay refresh animation');
    }
    checks.push(fallback ? 'eight routes with CSS fallback' : 'eight routes with native transitions');
    if (override) await command('Page.removeScriptToEvaluateOnNewDocument', override);
  }
  await go('/');
  await click('[data-category="CDN"]');
  assert.ok(await evaluate('document.getAnimations().some(a=>a.id==="result-enter")'), 'Category results must animate');
  await click('[data-category="all"]');
  assert.equal(await evaluate('document.querySelectorAll("[data-post][hidden]").length'), 0);
  await spa('.search-trigger', '/search/');
  await evaluate('const input=document.querySelector("#search-input");input.value="Cloudflare";input.dispatchEvent(new Event("input"));');
  assert.ok(await evaluate('document.getAnimations().some(a=>a.id==="result-enter")'), 'Search results must animate');
  checks.push('category and search result motion');
  for (const width of [375, 1440]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await evaluate('document.querySelector("[data-open-announcement]").click()');
    await waitFor('document.querySelector("#announcement-dialog").dataset.state === "intro"', 'geometry intro');
    assert.equal(await evaluate('document.querySelector("[data-announcement-body]").inert'), true);
    assert.ok(await evaluate('document.getAnimations().some(a=>a.animationName==="notice-orbit")'));
    await pause(300);
    await screenshot(`geometry-${width}`);
    await waitFor('document.querySelector("#announcement-dialog").dataset.state === "ready"', 'notice reveal');
    await pause(400);
    assert.equal(await evaluate('document.querySelector("[data-announcement-body]").inert'), false);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    await screenshot(`notice-${width}`);
    await click('[data-dismiss-announcement]');
    await waitFor('!document.querySelector("#announcement-dialog").open', 'close');
  }
  checks.push('geometry then content at phone and desktop widths');
  // Close while the geometry is running; the delayed reveal must not reopen it.
  await click('[data-open-announcement]');
  await waitFor('document.querySelector("#announcement-dialog").dataset.state === "intro"', 'early dismissal');
  await click('[data-dismiss-announcement]');
  await pause(950);
  assert.equal(await evaluate('document.querySelector("#announcement-dialog").open'), false);
  assert.equal(await evaluate('document.documentElement.classList.contains("announcement-open")'), false);
  checks.push('early dismissal cancels reveal');
  await click('[data-open-announcement]');
  await waitFor('document.querySelector("#announcement-dialog").dataset.state === "intro"', 'navigation during intro');
  await spa('.primary-links a[href="/archives/"]', '/archives/');
  await pause(800);
  assert.equal(await evaluate('document.querySelector("#announcement-dialog").open'), false);
  assert.equal(await evaluate('document.documentElement.classList.contains("announcement-open")'), false);
  checks.push('navigation cancels pending reveal');
  await command('Page.reload'); await pause(900);
  assert.ok(await evaluate('window.__animations.some(a=>a.name==="page-enter"&&a.target==="main")'), 'Reload must animate');
  assert.equal(await evaluate('document.querySelector("#announcement-dialog").open'), false, 'Daily suppression survives reload');
  await command('Emulation.setEmulatedMedia', { features: [{name:'prefers-reduced-motion',value:'reduce'}] });
  await click('[data-open-announcement]');
  await waitFor('document.querySelector("#announcement-dialog").open', 'reduced motion announcement');
  assert.equal(await evaluate('document.querySelector("#announcement-dialog").dataset.state'), 'ready');
  assert.equal(await evaluate('document.querySelector("#announcement-dialog").getAnimations({subtree:true}).length'), 0);
  await click('[data-dismiss-announcement]');
  assert.equal(await evaluate('document.querySelector("#announcement-dialog").open'), false);
  checks.push('reload and reduced motion');
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({result:'PASS',checks,consoleErrors},null,2));
} catch(error) {
  console.error(error);
  await screenshot('failure').catch(()=>{});
  process.exitCode = 1;
} finally {
  socket.close();
  await fetch(`${browser}/json/close/${target.id}`);
}

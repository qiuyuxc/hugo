import assert from 'node:assert/strict';

const origin = process.env.PREVIEW_ORIGIN || 'http://127.0.0.1:8085';
const browser = process.env.CDP_URL || 'http://127.0.0.1:9227';
const target = await (await fetch(`${browser}/json/new?about:blank`, { method: 'PUT' })).json();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let sequence = 0;
const pending = new Map();
const errors = [];
const evidence = [];
const pause = duration => new Promise(resolve => setTimeout(resolve, duration));
function command(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve, reject, timer });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
socket.addEventListener('message', event => {
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
});
async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function waitFor(expression, label) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await evaluate(expression)) return;
    await pause(80);
  }
  throw new Error(`Timeout: ${label}`);
}
async function freshPage(action) {
  const previous = await evaluate('window.__documentId');
  await action();
  await waitFor(`window.__documentId !== ${JSON.stringify(previous)} && window.__ready && document.readyState === 'complete'`, 'new document loaded');
  await pause(500);
}
async function go(path) {
  await freshPage(() => command('Page.navigate', { url: origin + path }));
}
async function reload() {
  await freshPage(() => command('Page.reload'));
}
async function route(action, path) {
  await evaluate(`window.__routeLoaded = false; document.addEventListener('astro:page-load', () => window.__routeLoaded = true, { once: true }); ${action}`);
  await waitFor(`location.pathname === ${JSON.stringify(path)} && window.__routeLoaded && !document.documentElement.hasAttribute('data-page-transition')`, path);
}
async function scrollTo(top) {
  await evaluate(`scrollTo({ top: ${top}, behavior: 'instant' })`);
  await pause(250);
}
async function state() {
  return evaluate('({ url: location.href, type: performance.getEntriesByType("navigation")[0].type, y: scrollY, history: history.state, saved: window.__savedAtLoad, scrollCalls: window.__scrollCalls })');
}

try {
  await command('Page.enable');
  await command('Runtime.enable');
  await command('Network.enable');
  await command('Network.setBypassServiceWorker', { bypass: true });
  await command('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__documentId = crypto.randomUUID();
    localStorage.setItem('kukie-announcement-dismissed-date', new Date().toLocaleDateString('sv'));
    window.__savedAtLoad = sessionStorage.getItem('kukie-page-exit-position');
    window.__scrollCalls = [];
    const originalScrollTo = window.scrollTo;
    window.scrollTo = function(...args) {
      window.__scrollCalls.push({ args, behavior: getComputedStyle(document.documentElement).scrollBehavior });
      return originalScrollTo.apply(this, args);
    };
    document.addEventListener('astro:page-load', () => window.__ready = true, { once: true });
  ` });
  for (const width of [1440, 375]) {
    await command('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: width === 375 });
    for (const path of ['/', '/#notes']) {
      await go('/');
      if (path.includes('#')) {
        await evaluate(`document.querySelector('a[href="#notes"]').click()`);
        await waitFor('location.hash === "#notes" && scrollY > 300', 'Notes button reaches the article list');
        await pause(700);
      }
      await evaluate('document.querySelector(".post-row h3 a").scrollIntoView({ block: "center", behavior: "instant" })');
      await pause(250);
      const listY = await evaluate('scrollY');
      assert.ok(listY > 300);
      const articlePath = await evaluate('document.querySelector(".post-row h3 a").pathname');
      await route('document.querySelector(".post-row h3 a").click()', articlePath);
      assert.equal(await evaluate('scrollY'), 0, 'New article starts at top');
      await route('history.back()', '/');
      assert.ok(Math.abs(await evaluate('scrollY') - listY) < 20, 'Back retains the list position');
      const before = await state();
      await reload();
      const after = await state();
      evidence.push({ width, path, before, after });
      assert.equal(after.y, 0, 'Refreshing the homepage after returning from an article starts at top');
      assert.equal(after.scrollCalls[0].args[0].top, 0, 'Initial router restoration must start at top without a later correction');
      assert.equal(after.scrollCalls[0].behavior, 'auto');
      assert.equal(new URL(after.url).hash, '', 'Homepage refresh removes the leftover notes anchor');
      assert.equal(after.history.index, before.history.index, 'Clearing the anchor does not create a history entry');
      await reload();
      assert.equal(await evaluate('scrollY'), 0, 'Repeated homepage refresh stays at top');
      assert.equal(await evaluate('location.hash'), '', 'Repeated refresh keeps the clean homepage URL');
      await route('history.forward()', articlePath);
      if (width === 1440) {
        await scrollTo(1800);
        const readingY = await evaluate('scrollY');
        await reload();
        assert.ok(Math.abs(await evaluate('scrollY') - readingY) < 20, 'Desktop article refresh retains the reading position');
      }
    }
    for (const selector of ['.article-back', '.article-end a']) {
      await go('/posts/axisnow-cdn/');
      await route(`document.querySelector(${JSON.stringify(selector)}).click()`, '/');
      await waitFor('location.hash === "#notes" && scrollY > 300', 'Article return link reaches the notes section');
      const before = await state();
      await reload();
      const after = await state();
      evidence.push({ width, selector, before, after });
      assert.equal(after.y, 0, 'Homepage refresh after an article return link starts at top');
      assert.equal(new URL(after.url).hash, '', 'Article return link leaves no notes anchor after refresh');
      assert.equal(after.history.index, before.history.index, 'Article return refresh keeps the history index');
    }
  }

  await go('/');
  const category = await evaluate('document.querySelector("[data-category]:not([data-category=all])").dataset.category');
  await go(`/?category=${encodeURIComponent(category)}#notes`);
  assert.ok(await evaluate('scrollY') > 300, 'Category link still reaches the notes section');
  await reload();
  assert.equal(await evaluate('scrollY'), 0, 'Filtered homepage refresh starts at top');
  assert.equal(await evaluate('location.hash'), '', 'Filtered homepage refresh removes the notes anchor');
  assert.equal(await evaluate('new URL(location.href).searchParams.get("category")'), category, 'Clearing the anchor preserves query parameters');
  assert.equal(await evaluate('document.querySelector("[data-category].active").dataset.category'), category, 'Refresh retains category selection');

  // Resetting the homepage must not depend on a usable sessionStorage snapshot.
  const blockedStorage = await command('Page.addScriptToEvaluateOnNewDocument', { source: `
    Object.defineProperty(window, 'sessionStorage', { get() { throw new DOMException('Storage unavailable', 'SecurityError'); } });
  ` });
  await go('/');
  await scrollTo(1000);
  await reload();
  assert.equal(await evaluate('scrollY'), 0, 'Homepage refresh works when session storage is unavailable');
  await scrollTo(1000);
  await evaluate('history.replaceState(null, "")');
  await reload();
  assert.equal(await evaluate('scrollY'), 0, 'Homepage refresh works without router history state');
  await command('Page.removeScriptToEvaluateOnNewDocument', { identifier: blockedStorage.identifier });
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ result: 'PASS', checks: ['desktop and mobile article → back → homepage refresh', 'article return and continue links → homepage refresh', 'notes anchor removed on repeated refresh', 'initial restoration starts at top', 'back/forward navigation', 'desktop article refresh position', 'direct notes anchors', 'category retained on refresh', 'storage unavailable and history missing'], evidence }, null, 2));
} catch (error) {
  console.error(error);
  console.error(JSON.stringify({ evidence, errors, state: await state() }, null, 2));
  process.exitCode = 1;
} finally {
  socket.close();
  await fetch(`${browser}/json/close/${target.id}`);
}

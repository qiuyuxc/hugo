import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const output = new URL('../../../public/', import.meta.url);
const read = path => readFile(new URL(path, output), 'utf8');
const home = await read('index.html');
assert.match(home, /id="hero-heading"/);
assert.doesNotMatch(home, /name="generator" content="Hugo|preview-badge|Astro 设计预览/);
assert.match(home, /name="robots" content="index, follow"/);
assert.match(home, /rel="canonical" href="https:\/\/www\.kukie\.cn\/"/);
assert.match(await read('404.html'), /name="robots" content="noindex, nofollow"/);
assert.match(await read('robots.txt'), /Allow: \/[\s\S]*Sitemap: https:\/\/www\.kukie\.cn\/sitemap.xml/);

const sitemap = await read('sitemap.xml');
const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => new URL(match[1]));
assert.ok(locations.length > 5, 'Sitemap contains actual article routes');
for (const location of locations) {
  assert.equal(location.origin, 'https://www.kukie.cn');
  assert.ok(existsSync(new URL(`${decodeURIComponent(location.pathname).slice(1)}index.html`, output)), location.href);
}
const feed = await read('index.xml');
assert.equal([...feed.matchAll(/<item>/g)].length, locations.filter(url => url.pathname.startsWith('/posts/')).length);
assert.ok(existsSync(new URL('kukie-sw.js', output)), 'Production output includes the service worker');

const redirects = new Map((await read('_redirects')).trim().split('\n').map(line => {
  const [from, to, status] = line.split(/\s+/);
  assert.equal(status, '301');
  assert.ok(from.startsWith('/') && to.startsWith('/') && !to.startsWith('//'));
  return [from, to];
}));
const legacy = JSON.parse(await readFile(new URL('./fixtures/legacy-paths.json', import.meta.url), 'utf8'));
for (const path of legacy) {
  const file = `${decodeURIComponent(path).slice(1)}index.html`;
  assert.ok(existsSync(new URL(file, output)) || redirects.has(path), `Missing previous public route: ${path}`);
}
for (const destination of redirects.values()) {
  const url = new URL(destination, 'https://www.kukie.cn');
  assert.ok(existsSync(new URL(`${decodeURIComponent(url.pathname).slice(1)}index.html`, output)), destination);
}
console.log(JSON.stringify({ result: 'PASS', output: 'public/', sitemapPages: locations.length, legacyPaths: legacy.length, redirects: redirects.size }));

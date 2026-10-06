import { providerName } from '../lib/cdn';

const cache = new Map<string, { value: string; expires: number }>();

async function lookupAsn(host: string, signal: AbortSignal): Promise<string | null> {
  for (const resolver of ['https://223.5.5.5/resolve', 'https://dns.google/resolve']) {
    try {
      const response = await fetch(`${resolver}?name=${encodeURIComponent(host)}&type=A`, { headers: { Accept: 'application/dns-json' }, signal, credentials: 'omit' });
      if (!response.ok) continue;
      const data = await response.json();
      const address = data.Answer?.find((answer: { type: number }) => answer.type === 1)?.data;
      if (!address) continue;
      const result = await fetch(`https://ipwho.is/${encodeURIComponent(address)}`, { signal, credentials: 'omit' });
      if (!result.ok) continue;
      const details = await result.json();
      if (details.success && details.connection) {
        return [details.connection.org, details.connection.isp, details.connection.domain].filter(Boolean).join(' ');
      }
    } catch {
      if (signal.aborted) return null;
    }
  }
  return null;
}

export function mountFooter(signal: AbortSignal) {
  const container = document.querySelector<HTMLElement>('[data-footer-network]');
  if (!container) return;
  async function identify(item: HTMLElement) {
    const value = item.querySelector<HTMLElement>('[data-server-value]')!;
    const manual = item.dataset.serverCdn?.trim();
    if (manual) {
      item.title = `${item.dataset.serverUrl || location.origin} · CDN 来自站点配置`;
      return;
    }
    let url: URL;
    try { url = new URL(item.dataset.serverUrl || '/', location.origin); } catch { return; }
    if (!['https:', 'http:'].includes(url.protocol)) return;
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
      value.textContent = '本地预览';
      return;
    }
    const key = `${url.href}:${container!.dataset.asnFallback}`;
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) {
      value.textContent = cached.value;
      return;
    }
    const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(6000)]);
    let server: string | null = null;
    try {
      const response = await fetch(url, { method: 'HEAD', signal: requestSignal, credentials: 'omit', cache: 'no-store' });
      if (response.ok) server = response.headers.get('server');
    } catch {}
    if (!server && container!.dataset.asnFallback === '1' && !requestSignal.aborted) {
      server = await lookupAsn(url.hostname, requestSignal);
    }
    if (signal.aborted || !item.isConnected) return;
    value.textContent = server ? providerName(server) : '未识别';
    item.title = server ? `${url.origin} · 服务提供方识别结果，不代表可用性监测` : `${url.origin} · 响应头不可读或请求未完成，不代表服务离线`;
    if (server) cache.set(key, { value: value.textContent, expires: Date.now() + 300000 });
  }
  const observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    observer.disconnect();
    for (const item of container!.querySelectorAll<HTMLElement>('[data-server-url]')) void identify(item);
  }, { rootMargin: '300px' });
  observer.observe(container);
  signal.addEventListener('abort', () => observer.disconnect(), { once: true });
}

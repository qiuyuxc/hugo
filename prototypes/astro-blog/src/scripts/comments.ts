export function mountComments(signal: AbortSignal) {
  const section = document.querySelector<HTMLElement>('[data-comments]');
  if (!section) return;
  const mount = section.querySelector<HTMLElement>('[data-comment-mount]')!;
  const status = section.querySelector<HTMLElement>('[data-comment-status]')!;
  const retry = section.querySelector<HTMLButtonElement>('[data-retry-comments]')!;
  const config = JSON.parse(section.dataset.config!);
  let widget: HTMLElement | undefined;
  let frame: HTMLIFrameElement | undefined;
  let generation = 0;
  let timer = 0;
  let observer: IntersectionObserver | undefined;
  const theme = () => document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
  function failure() {
    status.hidden = false;
    status.textContent = navigator.onLine ? '评论服务暂未响应，可重试或前往 GitHub 讨论区。' : '当前离线，联网后可以重新加载评论。';
    retry.hidden = false;
  }
  async function load() {
    const current = ++generation;
    clearTimeout(timer);
    observer?.disconnect();
    mount.replaceChildren();
    widget = undefined;
    frame = undefined;
    status.hidden = false;
    status.textContent = '正在加载评论…';
    retry.hidden = true;
    try {
      await import('giscus');
      if (signal.aborted || current !== generation || !mount.isConnected) return;
      const routerState = history.state;
      widget = document.createElement('giscus-widget');
      if (history.state !== routerState) history.replaceState(routerState, '', location.href);
      for (const [key, value] of Object.entries({
        repo: config.repo, repoid: config.repoId, category: config.category,
        categoryid: config.categoryId, mapping: config.mapping, strict: config.strict,
        lang: config.lang, theme: theme(), reactionsenabled: '1', emitmetadata: '0',
        inputposition: 'top', loading: 'lazy'
      })) widget.setAttribute(key, String(value));
      mount.append(widget);
      await (widget as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
      if (signal.aborted || current !== generation) return;
      frame = widget.shadowRoot?.querySelector('iframe') ?? undefined;
      if (!frame) throw new Error('Missing comment frame');
      frame.title = 'GitHub 评论';
      frame.addEventListener('load', () => {
        if (signal.aborted || current !== generation) return;
        clearTimeout(timer);
        status.hidden = true;
        retry.hidden = true;
      }, { signal, once: true });
      observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          observer?.disconnect();
          timer = window.setTimeout(failure, 20000);
        }
      }, { rootMargin: '300px' });
      observer.observe(section!);
    } catch {
      if (!signal.aborted && current === generation) failure();
    }
  }
  retry.addEventListener('click', () => { void load(); }, { signal });
  document.addEventListener('kukie:theme-change', () => widget?.setAttribute('theme', theme()), { signal });
  window.addEventListener('message', event => {
    if (event.origin !== 'https://giscus.app' || event.source !== frame?.contentWindow) return;
    const error = event.data?.giscus?.error;
    if (typeof error === 'string' && !error.includes('Discussion not found')) failure();
  }, { signal });
  signal.addEventListener('abort', () => {
    generation++;
    clearTimeout(timer);
    observer?.disconnect();
    mount.replaceChildren();
  }, { once: true });
  void load();
}

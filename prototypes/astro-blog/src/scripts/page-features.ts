import { navigate } from 'astro:transitions/client';

export function mountPageFeatures(signal: AbortSignal) {
  const buttons = [...document.querySelectorAll<HTMLButtonElement>('[data-category]')];
  const rows = [...document.querySelectorAll<HTMLElement>('[data-post]')];
  let resultAnimations: Animation[] = [];
  function animateResults() {
    resultAnimations.forEach(animation => animation.cancel());
    resultAnimations = [];
    if (signal.aborted || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    resultAnimations = rows.filter(row => !row.hidden).map((row, index) => row.animate([
      { opacity: 0, transform: 'translateY(12px)' },
      { opacity: 1, transform: 'translateY(0)' }
    ], { id: 'result-enter', duration: 260, delay: Math.min(index, 4) * 35, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'backwards' }));
  }
  signal.addEventListener('abort', () => resultAnimations.forEach(animation => animation.cancel()), { once: true });
  function filter() {
    const category = new URL(location.href).searchParams.get('category') || 'all';
    const selected = buttons.some(button => button.dataset.category === category) ? category : 'all';
    for (const button of buttons) {
      const active = button.dataset.category === selected;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', String(active));
    }
    let count = 0;
    for (const row of rows) {
      row.hidden = selected !== 'all' && !JSON.parse(row.dataset.categories || '[]').includes(selected);
      if (!row.hidden) count++;
    }
    const label = document.querySelector('#post-count');
    if (label) label.textContent = `共 ${count} 篇记录，慢慢读。`;
  }
  if (buttons.length) {
    filter();
    for (const button of buttons) button.addEventListener('click', () => {
      const url = new URL(location.href);
      const category = button.dataset.category || 'all';
      if ((url.searchParams.get('category') || 'all') === category) return;
      if (category === 'all') url.searchParams.delete('category');
      else url.searchParams.set('category', category);
      history.replaceState(history.state, '', url);
      filter();
      animateResults();
    }, { signal });
    window.addEventListener('popstate', filter, { signal });
  }
  document.querySelector('#random-post')?.addEventListener('click', event => {
    const links = rows.map(row => row.querySelector<HTMLAnchorElement>('h3 a')?.href).filter(Boolean);
    if (!links.length) return;
    event.preventDefault();
    void navigate(links[Math.floor(Math.random() * links.length)]!);
  }, { signal });

  const input = document.querySelector<HTMLInputElement>('#search-input');
  if (input) {
    function search(updateUrl = true) {
      const query = input!.value.trim().toLowerCase();
      const terms = query.split(/\s+/).filter(Boolean);
      let count = 0;
      let changed = false;
      for (const row of rows) {
        const hidden = !terms.every(term => row.dataset.search?.includes(term));
        changed ||= row.hidden !== hidden;
        row.hidden = hidden;
        if (!row.hidden) count++;
      }
      document.querySelector('#search-status')!.textContent = query ? `找到 ${count} 篇相关笔记` : `全部 ${count} 篇文章`;
      document.querySelector<HTMLElement>('#search-empty')!.hidden = count !== 0;
      if (updateUrl) {
        const url = new URL(location.href);
        if (query) url.searchParams.set('q', input!.value.trim());
        else url.searchParams.delete('q');
        history.replaceState(history.state, '', url);
        if (changed) animateResults();
      }
    }
    input.value = new URL(location.href).searchParams.get('q') || '';
    search(false);
    input.addEventListener('input', () => search(), { signal });
    document.querySelector('.search-form')?.addEventListener('submit', event => { event.preventDefault(); search(); }, { signal });
    document.querySelector('#clear-search')?.addEventListener('click', () => { input.value = ''; search(); input.focus(); }, { signal });
  }

  const body = document.querySelector<HTMLElement>('#article-body');
  if (body) {
    const toc = document.querySelector<HTMLDetailsElement>('.article-toc');
    if (toc && matchMedia('(max-width: 760px)').matches) toc.open = false;
    let size = parseFloat(getComputedStyle(body).fontSize);
    function resize(delta: number) {
      size = Math.min(22, Math.max(14, size + delta));
      body!.style.setProperty('--reading-size', `${size}px`);
    }
    document.querySelector('#font-smaller')?.addEventListener('click', () => resize(-1), { signal });
    document.querySelector('#font-larger')?.addEventListener('click', () => resize(1), { signal });
    document.querySelector('#back-top')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }), { signal });
    const links = [...document.querySelectorAll<HTMLAnchorElement>('.toc-list a')];
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) {
        for (const link of links) link.classList.toggle('active', decodeURIComponent(link.hash.slice(1)) === entry.target.id);
      }
    }, { rootMargin: '-5% 0px -65% 0px' });
    body.querySelectorAll('h2').forEach(heading => observer.observe(heading));
    signal.addEventListener('abort', () => observer.disconnect(), { once: true });
  }

  const menu = document.querySelector<HTMLDetailsElement>('#navigation-more');
  document.addEventListener('click', event => {
    if (menu?.open && !menu.contains(event.target as Node)) menu.open = false;
  }, { signal });
  menu?.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      menu.open = false;
      menu.querySelector('summary')?.focus();
    }
  }, { signal });
}

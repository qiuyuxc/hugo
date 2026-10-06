let busy = false;
let transition: ViewTransition | undefined;

function syncTheme() {
  const dark = document.documentElement.dataset.theme === 'dark';
  document.querySelector('.theme-toggle')?.setAttribute('aria-label', dark ? '切换浅色模式' : '切换深色模式');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#17201b' : '#f8f9f5');
  document.dispatchEvent(new CustomEvent('kukie:theme-change', { detail: dark ? 'dark' : 'light' }));
}

export function cancelThemeTransition() {
  transition?.skipTransition();
  document.documentElement.classList.remove('theme-transition');
}

async function toggleTheme() {
  if (busy || document.documentElement.hasAttribute('data-astro-transition') || document.documentElement.hasAttribute('data-page-transition')) return;
  const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  const apply = () => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('kukie-theme', theme); } catch {}
    syncTheme();
  };
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    apply();
    return;
  }
  busy = true;
  document.documentElement.classList.add('theme-transition');
  transition = document.startViewTransition(apply);
  try {
    await transition.ready;
    const animation = document.documentElement.animate({
      clipPath: [
        'polygon(-35% 0, -5% 0, -35% 100%, -65% 100%)',
        'polygon(-35% 0, 135% 0, 105% 100%, -65% 100%)'
      ]
    }, { duration: 650, easing: 'cubic-bezier(.4,0,.15,1)', fill: 'both', pseudoElement: '::view-transition-new(root)' });
    await animation.finished;
  } catch {
    transition.skipTransition();
  } finally {
    await transition.finished.catch(() => {});
    transition = undefined;
    document.documentElement.classList.remove('theme-transition');
    busy = false;
  }
}

export function mountTheme(signal: AbortSignal) {
  syncTheme();
  document.querySelector('.theme-toggle')?.addEventListener('click', () => { void toggleTheme(); }, { signal });
}

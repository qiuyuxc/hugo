export function initializeScroll() {
  function savePosition() {
    if (!history.state || typeof history.state.index !== 'number') return;
    try {
      sessionStorage.setItem('kukie-page-exit-position', JSON.stringify({ url: location.href, index: history.state.index, scrollX, scrollY }));
    } catch {}
    history.replaceState({ ...history.state, scrollX, scrollY }, '');
  }
  window.addEventListener('pagehide', savePosition);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') savePosition();
  });
  document.addEventListener('astro:before-preparation', () => {
    delete document.documentElement.dataset.smoothScroll;
  });
  document.addEventListener('astro:page-load', () => {
    document.documentElement.dataset.smoothScroll = '';
  });
}

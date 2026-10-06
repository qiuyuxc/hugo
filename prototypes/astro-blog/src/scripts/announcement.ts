const dismissalKey = 'kukie-announcement-dismissed-date';
let shownThisVisit = false;
let cachedNotice: Notice | undefined;

interface Notice { enabled?: boolean; badge?: string; text?: string; link?: string; }

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function suppressed() {
  try { return localStorage.getItem(dismissalKey) === today(); } catch { return false; }
}

export function mountAnnouncement(signal: AbortSignal) {
  const dialog = document.querySelector<HTMLDialogElement>('#announcement-dialog');
  if (!dialog) return;
  const content = dialog.querySelector<HTMLElement>('[data-announcement-content]')!;
  const link = dialog.querySelector<HTMLAnchorElement>('[data-announcement-link]')!;
  const checkbox = dialog.querySelector<HTMLInputElement>('#announcement-today')!;
  const body = dialog.querySelector<HTMLElement>('[data-announcement-body]')!;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  let revealTimer = 0;
  let closeTimer = 0;
  let requesting = false;
  let returnFocus: HTMLElement | null = null;
  function reveal() {
    clearTimeout(revealTimer);
    if (signal.aborted || !dialog?.open || dialog.dataset.state !== 'intro') return;
    dialog.dataset.state = 'ready';
    body.inert = false;
    body.removeAttribute('aria-hidden');
    body.setAttribute('aria-busy', 'false');
  }
  function show(notice?: Notice) {
    if (signal.aborted || !dialog?.isConnected || dialog.open) return;
    content.textContent = notice?.text || '暂时没有可显示的公告，稍后再来看看。';
    dialog.querySelector('#announcement-title')!.textContent = notice?.badge || '站点公告';
    link.hidden = true;
    if (notice?.link) {
      try {
        const url = new URL(notice.link, location.origin);
        if (['http:', 'https:'].includes(url.protocol)) {
          link.href = url.href;
          link.hidden = false;
        }
      } catch {}
    }
    checkbox.checked = suppressed();
    shownThisVisit = true;
    returnFocus = document.activeElement as HTMLElement;
    dialog.dataset.state = 'intro';
    body.inert = true;
    body.setAttribute('aria-hidden', 'true');
    body.setAttribute('aria-busy', 'true');
    dialog.showModal();
    document.documentElement.classList.add('announcement-open');
    if (reducedMotion.matches) reveal();
    else revealTimer = window.setTimeout(reveal, 720);
  }
  function finishClose() {
    clearTimeout(closeTimer);
    dialog!.close();
    delete dialog!.dataset.state;
    document.documentElement.classList.remove('announcement-open');
    if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }
  function dismiss() {
    if (!dialog!.open || dialog!.dataset.state === 'closing') return;
    clearTimeout(revealTimer);
    try {
      if (checkbox.checked) localStorage.setItem(dismissalKey, today());
      else localStorage.removeItem(dismissalKey);
    } catch {}
    if (reducedMotion.matches) finishClose();
    else {
      dialog!.dataset.state = 'closing';
      // The timeout also releases the modal if an animation is interrupted.
      closeTimer = window.setTimeout(finishClose, 240);
    }
  }
  async function load(manual = false) {
    if (requesting || (!manual && (shownThisVisit || suppressed()))) return;
    if (cachedNotice && !manual) { show(cachedNotice); return; }
    if (!dialog!.dataset.endpoint) { if (manual) show(); return; }
    requesting = true;
    const controller = new AbortController();
    const cancel = () => controller.abort();
    signal.addEventListener('abort', cancel, { once: true });
    const timeout = setTimeout(cancel, Number(dialog!.dataset.timeout) || 5000);
    try {
      const response = await fetch(dialog!.dataset.endpoint, { cache: 'no-store', credentials: 'omit', signal: controller.signal });
      if (!response.ok) throw new Error('Notice unavailable');
      const notice = await response.json() as Notice;
      if (signal.aborted) return;
      if (notice.enabled !== false && typeof notice.text === 'string' && notice.text.trim()) {
        cachedNotice = notice;
        show(notice);
      } else if (manual) show();
      else shownThisVisit = true;
    } catch {
      if (manual && !signal.aborted) show({ text: '暂时无法获取公告，请检查网络后重试。' });
    } finally {
      clearTimeout(timeout);
      signal.removeEventListener('abort', cancel);
      requesting = false;
    }
  }
  for (const button of dialog.querySelectorAll('[data-dismiss-announcement]')) button.addEventListener('click', dismiss, { signal });
  dialog.addEventListener('animationend', event => {
    if (event.target === dialog && event.animationName === 'notice-close' && dialog.dataset.state === 'closing') finishClose();
  }, { signal });
  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches) return;
    if (dialog.dataset.state === 'closing') finishClose();
    else reveal();
  }, { signal });
  dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss(); }, { signal });
  dialog.addEventListener('click', event => {
    if (event.target !== dialog) return;
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dismiss();
  }, { signal });
  document.querySelector('[data-open-announcement]')?.addEventListener('click', () => {
    const menu = document.querySelector<HTMLDetailsElement>('#navigation-more');
    if (menu) menu.open = false;
    void load(true);
  }, { signal });
  signal.addEventListener('abort', () => {
    clearTimeout(revealTimer);
    clearTimeout(closeTimer);
    dialog.close();
    document.documentElement.classList.remove('announcement-open');
  }, { once: true });
  void load();
}

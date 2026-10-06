interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let installPrompt: InstallPrompt | undefined;
let statusMessage = '';

function renderStatus() {
  document.querySelectorAll<HTMLElement>('[data-install-status]').forEach(element => { element.textContent = statusMessage; });
  const installed = matchMedia('(display-mode: standalone)').matches;
  document.querySelectorAll<HTMLElement>('[data-install-app]').forEach(element => { element.hidden = installed; });
}

export function initializePwa() {
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event as InstallPrompt;
    renderStatus();
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = undefined;
    statusMessage = '已添加到桌面。';
    renderStatus();
  });
  if (import.meta.env.DEV || !('serviceWorker' in navigator) || !window.isSecureContext) return;
  void (async () => {
    try {
      const existing = await navigator.serviceWorker.getRegistration('/');
      const worker = existing?.active || existing?.waiting || existing?.installing;
      if (worker && new URL(worker.scriptURL).pathname !== '/kukie-sw.js') {
        statusMessage = '此地址已有其他离线应用，未覆盖其缓存。';
        renderStatus();
        return;
      }
      await navigator.serviceWorker.register('/kukie-sw.js', { scope: '/', updateViaCache: 'none' });
      renderStatus();
    } catch {
      statusMessage = '离线应用暂未启用，不影响在线阅读。';
      renderStatus();
    }
  })();
}

export function mountPwa(signal: AbortSignal) {
  renderStatus();
  document.querySelector('[data-install-app]')?.addEventListener('click', async () => {
    if (installPrompt) {
      const prompt = installPrompt;
      installPrompt = undefined;
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        statusMessage = choice.outcome === 'accepted' ? '安装已确认，请留意系统提示。' : '已取消，随时可以从浏览器菜单安装。';
      } catch { statusMessage = '请使用浏览器菜单中的“安装应用”或“添加到主屏幕”。'; }
    } else if (!window.isSecureContext) {
      statusMessage = '安装需要 HTTPS 或 localhost；局域网 HTTP 可预览，但不能安装 PWA。';
    } else {
      statusMessage = '使用浏览器菜单中的“安装应用”或“添加到主屏幕”；iPhone 请在 Safari 分享菜单中添加。';
    }
    if (!signal.aborted) renderStatus();
  }, { signal });
}

export function mountFriends(signal: AbortSignal) {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-copy-template]')) {
    button.addEventListener('click', async () => {
      const template = document.getElementById(button.dataset.copyTemplate!) as HTMLTextAreaElement;
      const status = button.parentElement!.querySelector<HTMLElement>('[data-copy-status]')!;
      const text = template.value;
      let copied = false;
      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(text);
          copied = true;
        } else {
          template.focus();
          template.select();
          copied = document.execCommand('copy');
        }
      } catch {}
      if (signal.aborted) return;
      if (copied) {
        status.textContent = '已复制，可以粘贴使用。';
        button.focus({ preventScroll: true });
      } else {
        template.focus();
        template.select();
        status.textContent = '浏览器未开放剪贴板，已选中模板，请长按或按 Ctrl+C 复制。';
      }
    }, { signal });
  }
}

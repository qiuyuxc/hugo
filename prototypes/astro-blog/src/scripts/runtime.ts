import { navigate } from 'astro:transitions/client';
import { mountPageFeatures } from './page-features';
import { mountTheme, cancelThemeTransition } from './theme';
import { mountComments } from './comments';
import { mountAnnouncement } from './announcement';
import { mountFriends } from './friends';
import { initializePwa, mountPwa } from './pwa';
import { mountFooter } from './footer';
import { initializeScroll } from './scroll';
import { initializePageTransitions } from './page-transitions';

let pageController: AbortController | undefined;

document.addEventListener('astro:before-preparation', cancelThemeTransition);
document.addEventListener('astro:before-swap', event => {
  pageController?.abort();
  event.newDocument.documentElement.dataset.theme = document.documentElement.dataset.theme || 'light';
});
document.addEventListener('astro:page-load', () => {
  pageController?.abort();
  pageController = new AbortController();
  const { signal } = pageController;
  mountTheme(signal);
  mountPageFeatures(signal);
  mountComments(signal);
  mountAnnouncement(signal);
  mountFriends(signal);
  mountPwa(signal);
  mountFooter(signal);
});
document.addEventListener('keydown', event => {
  const target = event.target as HTMLElement;
  if (document.querySelector('dialog[open]') || target.closest('input, textarea, select, [contenteditable="true"]') || event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === '/') {
    event.preventDefault();
    const input = document.querySelector<HTMLInputElement>('#search-input');
    if (input) input.focus();
    else void navigate('/search/');
  }
});
initializeScroll();
initializePageTransitions();
initializePwa();

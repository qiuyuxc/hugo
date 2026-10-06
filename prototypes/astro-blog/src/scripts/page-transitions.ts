interface PageTransition {
  signal: AbortSignal;
  outgoing: HTMLElement;
  incoming?: HTMLElement;
  exit?: Animation;
  enter?: Animation;
  frame?: number;
  abort: () => void;
}

export function initializePageTransitions() {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const loader = document.querySelector<HTMLElement>('#page-loader');
  let loaderExit: Animation | undefined;
  let loaderTimelines: { target: Element; name: string; startTime: Animation['startTime'] }[] = [];
  let current: PageTransition | undefined;

  function showLoader() {
    loaderExit?.cancel();
    loaderExit = undefined;
    if (!loader) return;
    loader.hidden = false;
    loader.removeAttribute('aria-hidden');
  }

  function hideLoader(immediate = false) {
    if (!loader || loader.hidden) return;
    loader.setAttribute('aria-hidden', 'true');
    loaderExit?.cancel();
    loaderExit = undefined;
    if (immediate || reducedMotion.matches) {
      loader.hidden = true;
      return;
    }
    const animation = loader.animate([{ opacity: 1 }, { opacity: 0 }], {
      id: 'page-loader-exit', duration: 160, easing: 'ease-out', fill: 'forwards'
    });
    loaderExit = animation;
    void animation.finished.then(() => {
      if (loaderExit !== animation) return;
      loader.hidden = true;
      animation.cancel();
      loaderExit = undefined;
    }, () => {});
  }

  function clear(transition: PageTransition) {
    if (transition.frame !== undefined) cancelAnimationFrame(transition.frame);
    transition.exit?.cancel();
    transition.enter?.cancel();
    transition.outgoing.removeAttribute('aria-busy');
    transition.incoming?.removeAttribute('data-page-entering');
    transition.signal.removeEventListener('abort', transition.abort);
    if (current === transition) {
      current = undefined;
      delete document.documentElement.dataset.pageTransition;
      hideLoader(true);
    }
  }

  document.addEventListener('astro:before-preparation', event => {
    if (current) clear(current);
    const outgoing = document.querySelector<HTMLElement>('#main');
    if (!outgoing) return;
    const transition: PageTransition = {
      signal: event.signal, outgoing, abort: () => clear(transition)
    };
    current = transition;
    document.documentElement.dataset.pageTransition = '';
    showLoader();
    event.signal.addEventListener('abort', transition.abort, { once: true });
    outgoing.setAttribute('aria-busy', 'true');
    if (!reducedMotion.matches) {
      transition.exit = outgoing.animate([
        { opacity: 1, transform: 'translateY(0)' },
        { opacity: 0, transform: 'translateY(16px)' }
      ], { id: 'page-leave', duration: 200, easing: 'ease', fill: 'forwards' });
    }
    const exitFinished = transition.exit?.finished.catch(() => {});
    const load = event.loader;
    // Fetch and exit run together, so even an uncached link responds immediately.
    event.loader = async () => {
      try {
        await Promise.all([load(), exitFinished]);
      } catch (error) {
        clear(transition);
        throw error;
      } finally {
        if (event.defaultPrevented || event.signal.aborted) clear(transition);
      }
    };
    queueMicrotask(() => { if (event.defaultPrevented) clear(transition); });
  });

  document.addEventListener('astro:before-swap', event => {
    loaderTimelines = (loader?.getAnimations({ subtree: true }) ?? []).flatMap(animation => {
      const target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
      return animation instanceof CSSAnimation && target && animation.startTime !== null
        ? [{ target, name: animation.animationName, startTime: animation.startTime }]
        : [];
    });
    // Animate live content, keeping snapshot transitions available for the theme sweep.
    void event.viewTransition.ready.catch(() => {});
    event.viewTransition.skipTransition();
    if (!current || current.signal.aborted) return;
    event.newDocument.documentElement.dataset.pageTransition = '';
    current.incoming = event.newDocument.querySelector<HTMLElement>('#main') ?? undefined;
    if (!reducedMotion.matches) current.incoming?.setAttribute('data-page-entering', '');
  });

  document.addEventListener('astro:after-swap', () => {
    // Persisting a node moves it between bodies, which can restart CSS animations.
    for (const timeline of loaderTimelines) {
      const animation = timeline.target.getAnimations().find(animation =>
        animation instanceof CSSAnimation && animation.animationName === timeline.name
      );
      if (animation) animation.startTime = timeline.startTime;
    }
    loaderTimelines = [];
  });

  document.addEventListener('astro:page-load', () => {
    const transition = current;
    if (!transition) return;
    if (!transition.incoming) { clear(transition); return; }
    if (reducedMotion.matches) { clear(transition); return; }
    // Let layout and page hooks finish before starting the visible entry duration.
    transition.frame = requestAnimationFrame(() => {
      transition.frame = requestAnimationFrame(() => {
        if (current !== transition || transition.signal.aborted) return;
        const incoming = transition.incoming!;
        hideLoader();
        incoming.removeAttribute('data-page-entering');
        transition.enter = incoming.animate([
          { opacity: 0, transform: 'translateY(32px)' },
          { opacity: 1, transform: 'translateY(0)' }
        ], { id: 'page-enter', duration: 300, easing: 'ease', fill: 'backwards' });
        void transition.enter.finished.then(() => clear(transition), () => {});
      });
    });
  });

  reducedMotion.addEventListener('change', () => {
    if (!reducedMotion.matches || !current) return;
    current.exit?.cancel();
    if (current.incoming) clear(current);
  });
  window.addEventListener('pagehide', () => { if (current) clear(current); });
}

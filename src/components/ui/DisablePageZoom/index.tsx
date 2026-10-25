'use client';

import { useEffect } from 'react';

/** Tablet + mobile: bloqueia pinch-zoom da página (Safari gesture + touch). */
const PAGE_ZOOM_MQ = '(max-width: 1099px)';

export function DisablePageZoom() {
  useEffect(() => {
    const mq = window.matchMedia(PAGE_ZOOM_MQ);

    function preventGesture(e: Event) {
      e.preventDefault();
    }

    /** Bloqueia pinch nativo fora do FlowCanvas (que usa touch-action: none). */
    function preventMultiTouch(e: TouchEvent) {
      if (e.touches.length < 2) return;
      const target = e.target;
      if (target instanceof Element && target.closest('.react-flow')) return;
      e.preventDefault();
    }

    function enable() {
      document.addEventListener('gesturestart', preventGesture, { passive: false });
      document.addEventListener('gesturechange', preventGesture, { passive: false });
      document.addEventListener('gestureend', preventGesture, { passive: false });
      document.addEventListener('touchmove', preventMultiTouch, { passive: false });
    }

    function disable() {
      document.removeEventListener('gesturestart', preventGesture);
      document.removeEventListener('gesturechange', preventGesture);
      document.removeEventListener('gestureend', preventGesture);
      document.removeEventListener('touchmove', preventMultiTouch);
    }

    function sync() {
      if (mq.matches) enable();
      else disable();
    }

    sync();
    mq.addEventListener('change', sync);
    return () => {
      disable();
      mq.removeEventListener('change', sync);
    };
  }, []);

  return null;
}

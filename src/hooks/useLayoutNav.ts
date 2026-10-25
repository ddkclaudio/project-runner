import { useLocation } from 'react-router-dom';
import { useEffect } from 'react';

import { useLayoutNavStore, type MobileNavPanel } from '@/stores/layout-nav';

export type { MobileNavPanel };

/** Side effects for mobile nav (Escape + body scroll lock). Mount once in the shell. */
export function LayoutNavEffects() {
  const { pathname } = useLocation();
  const navOpen = useLayoutNavStore((s) => s.navOpen);
  const openPath = useLayoutNavStore((s) => s.openPath);
  const mobilePanel = useLayoutNavStore((s) => s.mobilePanel);
  const closeNav = useLayoutNavStore((s) => s.closeNav);
  const showNavPanel = useLayoutNavStore((s) => s.showNavPanel);

  const isOpen = navOpen && openPath === pathname;

  useEffect(() => {
    if (!isOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (mobilePanel === 'profile') {
        showNavPanel();
      } else {
        closeNav();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, mobilePanel, closeNav, showNavPanel]);

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  return null;
}

export function useLayoutNav() {
  const { pathname } = useLocation();
  const navOpen = useLayoutNavStore((s) => s.navOpen);
  const openPath = useLayoutNavStore((s) => s.openPath);
  const mobilePanel = useLayoutNavStore((s) => s.mobilePanel);
  const openNavStore = useLayoutNavStore((s) => s.openNav);
  const closeNav = useLayoutNavStore((s) => s.closeNav);
  const toggleNavStore = useLayoutNavStore((s) => s.toggleNav);
  const showProfilePanel = useLayoutNavStore((s) => s.showProfilePanel);
  const showNavPanel = useLayoutNavStore((s) => s.showNavPanel);

  const isOpen = navOpen && openPath === pathname;

  return {
    navOpen: isOpen,
    mobilePanel: (isOpen ? mobilePanel : 'nav') as MobileNavPanel,
    openNav: () => openNavStore(pathname),
    closeNav,
    toggleNav: () => toggleNavStore(pathname),
    showProfilePanel,
    showNavPanel,
  };
}

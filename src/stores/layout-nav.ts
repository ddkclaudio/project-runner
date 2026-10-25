import { create } from 'zustand';

export type MobileNavPanel = 'nav' | 'profile';

interface LayoutNavState {
  navOpen: boolean;
  openPath: string | null;
  mobilePanel: MobileNavPanel;
  openNav: (pathname: string) => void;
  closeNav: () => void;
  toggleNav: (pathname: string) => void;
  showProfilePanel: () => void;
  showNavPanel: () => void;
}

export const useLayoutNavStore = create<LayoutNavState>((set, get) => ({
  navOpen: false,
  openPath: null,
  mobilePanel: 'nav',

  openNav: (pathname) => set({ navOpen: true, openPath: pathname, mobilePanel: 'nav' }),

  closeNav: () => set({ navOpen: false, mobilePanel: 'nav' }),

  toggleNav: (pathname) => {
    const { navOpen, openPath } = get();
    if (navOpen && openPath === pathname) {
      set({ navOpen: false, mobilePanel: 'nav' });
    } else {
      set({ navOpen: true, openPath: pathname, mobilePanel: 'nav' });
    }
  },

  showProfilePanel: () => set({ mobilePanel: 'profile' }),
  showNavPanel: () => set({ mobilePanel: 'nav' }),
}));

'use client';

import { useLayoutNav } from '@/hooks/useLayoutNav';
import { ProfileMenuContent } from '@/components/ui/ProfileMenu';
import styles from './Sidebar.module.css';

export function SidebarMobileBody({ children }: { children: React.ReactNode }) {
  const { mobilePanel, closeNav } = useLayoutNav();

  return (
    <div className={styles.nav} aria-label={mobilePanel === 'profile' ? 'Menu de perfil' : undefined}>
      {mobilePanel === 'profile' ? <ProfileMenuContent onNavigate={closeNav} /> : children}
    </div>
  );
}

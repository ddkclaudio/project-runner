import { useLocation } from 'react-router-dom';
import { LayoutNavEffects, useLayoutNav } from '@/hooks/useLayoutNav';
import { AppSidebar } from './AppSidebar';
import { SidebarComponents } from './SidebarComponents';
import { Topbar, TopbarBrand, TopbarMenuButton, TopbarRightControls, TopbarSeparator } from '@/components/ui/Topbar';
import styles from './shell.module.css';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { navOpen, toggleNav, closeNav } = useLayoutNav();
  const isComponents = pathname.startsWith('/components');

  return (
    <div className={styles.shell}>
      <LayoutNavEffects />
      <Topbar
        left={
          <>
            <TopbarMenuButton open={navOpen} onClick={toggleNav} />
            <TopbarBrand />
            <TopbarSeparator />
          </>
        }
        right={<TopbarRightControls />}
      />
      <div className={styles.body}>
        <AppSidebar />
        {isComponents ? <SidebarComponents /> : null}
        {navOpen ? (
          <button type="button" className={styles.backdrop} aria-label="Fechar menu de navegação" onClick={closeNav} />
        ) : null}
        <main className={styles.main} id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}

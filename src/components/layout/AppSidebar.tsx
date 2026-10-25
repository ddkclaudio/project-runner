import { IconHome, IconComponents, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from '@tabler/icons-react';
import { useLocation } from 'react-router-dom';
import { NavMenuItem } from '@/components/ui/NavMenuItem';
import { useLayoutNav } from '@/hooks/useLayoutNav';
import { SidebarMobileHeader } from './SidebarMobileHeader';
import { SidebarMobileBody } from './SidebarMobileBody';
import { cx } from '@/utils';
import styles from './Sidebar.module.css';

const NAV = [
  { label: 'Início', href: '/', Icon: IconHome, exact: true },
  { label: 'Componentes', href: '/components', Icon: IconComponents, exact: false },
];

export function AppSidebar() {
  const { pathname } = useLocation();
  const { navOpen, toggleNav } = useLayoutNav();

  return (
    <nav
      id="app-sidebar"
      className={cx(styles.sidebar, navOpen && styles.sidebarOpen)}
      aria-label="Navegação"
    >
      <div className={styles.sidebarPanel} data-sidebar-panel data-sidebar-open={navOpen ? '' : undefined}>
        <SidebarMobileHeader />
        <SidebarMobileBody>
          {NAV.map(({ label, href, Icon, exact }) => {
            const active = exact ? pathname === href : pathname.startsWith(href);
            return (
              <NavMenuItem
                key={href}
                label={label}
                href={href}
                icon={<Icon size={18} aria-hidden="true" />}
                active={active}
                variant="sidebar"
                aria-current={active ? 'page' : undefined}
              />
            );
          })}
        </SidebarMobileBody>
        <div className={styles.foot}>
          <button
            type="button"
            className={cx(styles.footBtn, navOpen && styles.footBtnActive)}
            aria-label={navOpen ? 'Desafixar menu' : 'Fixar menu aberto'}
            title={navOpen ? 'Desafixar menu' : 'Fixar menu aberto'}
            aria-pressed={navOpen}
            onClick={toggleNav}
          >
            {navOpen ? (
              <IconLayoutSidebarLeftCollapse size={16} aria-hidden="true" />
            ) : (
              <IconLayoutSidebarLeftExpand size={16} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}

import { IconHome, IconBooks, IconSettings, IconComponents, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand, IconLayoutDashboard, IconVersions, IconTerminal2, IconLink, IconNotes, IconAdjustments } from '@tabler/icons-react';
import { useLocation } from 'react-router-dom';
import { NavMenuItem } from '@/components/ui/NavMenuItem';
import { useLayoutNav } from '@/hooks/useLayoutNav';
import { SidebarMobileHeader } from './SidebarMobileHeader';
import { SidebarMobileBody } from './SidebarMobileBody';
import { appHref } from '@/lib/launcher-api';
import { cx } from '@/utils';
import styles from './Sidebar.module.css';

type NavItem = {
  label: string;
  href: string;
  Icon: typeof IconHome;
  exact: boolean;
};

function ShellSidebar({ label, items }: { label: string; items: NavItem[] }) {
  const { pathname } = useLocation();
  const { navOpen, toggleNav } = useLayoutNav();

  return (
    <nav id="app-sidebar" className={cx(styles.sidebar, navOpen && styles.sidebarOpen)} aria-label={label}>
      <div className={styles.sidebarPanel} data-sidebar-panel data-sidebar-open={navOpen ? '' : undefined}>
        <SidebarMobileHeader />
        <SidebarMobileBody>
          {items.map(({ label: itemLabel, href, Icon, exact }) => {
            const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <NavMenuItem
                key={href}
                label={itemLabel}
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
            {navOpen ? <IconLayoutSidebarLeftCollapse size={16} aria-hidden="true" /> : <IconLayoutSidebarLeftExpand size={16} aria-hidden="true" />}
          </button>
        </div>
      </div>
    </nav>
  );
}

const LIBRARY: NavItem[] = [
  { label: 'Biblioteca', href: '/', Icon: IconHome, exact: true },
  { label: 'Catálogo', href: '/catalog', Icon: IconBooks, exact: false },
  { label: 'Definições', href: '/settings/profile', Icon: IconSettings, exact: false },
  { label: 'Componentes', href: '/components', Icon: IconComponents, exact: false },
];

export function LibrarySidebar() {
  return <ShellSidebar label="Navegação da biblioteca" items={LIBRARY} />;
}

/** `folder` = pasta da app (identidade); `appHref` trata string sem `/` como pasta. */
export function AppMenuSidebar({ repository: folder }: { repository: string }) {
  const items: NavItem[] = [
    { label: 'Visão geral', href: appHref(folder), Icon: IconLayoutDashboard, exact: true },
    { label: 'Versões', href: appHref(folder, 'versions'), Icon: IconVersions, exact: true },
    { label: 'Executável', href: appHref(folder, 'executable'), Icon: IconTerminal2, exact: true },
    { label: 'Atalhos', href: appHref(folder, 'shortcuts'), Icon: IconLink, exact: true },
    { label: 'Changelog', href: appHref(folder, 'changelog'), Icon: IconNotes, exact: true },
    { label: 'Configuração', href: appHref(folder, 'settings'), Icon: IconAdjustments, exact: true },
  ];
  return <ShellSidebar label="Navegação da app" items={items} />;
}

import { IconHome, IconAffiliate, IconBooks, IconSettings, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand, IconLayoutDashboard, IconTerminal2, IconAdjustments, IconCloud } from '@tabler/icons-react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { NavMenuItem } from '@/components/ui/NavMenuItem';
import { useLayoutNav } from '@/hooks/useLayoutNav';
import { SidebarMobileHeader } from './SidebarMobileHeader';
import { SidebarMobileBody } from './SidebarMobileBody';
import { appCloudflareGet, appHref } from '@/lib/launcher-api';
import { useOrg } from '@/contexts/OrgContext';
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
  { label: 'Comunicações', href: '/comunicacoes', Icon: IconAffiliate, exact: true },
  { label: 'Catálogo', href: '/catalog', Icon: IconBooks, exact: false },
  { label: 'Definições', href: '/settings/profile', Icon: IconSettings, exact: false },
];

export function LibrarySidebar() {
  return <ShellSidebar label="Navegação da biblioteca" items={LIBRARY} />;
}

/** `folder` = pasta da app (identidade); `appHref` trata string sem `/` como pasta. */
export function AppMenuSidebar({ repository: folder }: { repository: string }) {
  const { activeOrg } = useOrg();
  const cloudflare = useQuery({
    queryKey: ['launcher', 'cloudflare', activeOrg?.id, folder],
    queryFn: () => appCloudflareGet(folder),
    enabled: Boolean(activeOrg?.id && folder),
    staleTime: 10_000,
  });
  /** Túnel só faz sentido se o Launchfile (ou URL) define uma porta local. */
  const showCloudflare = Boolean(cloudflare.data?.effectivePort);

  const items: NavItem[] = [
    { label: 'Visão geral', href: appHref(folder), Icon: IconLayoutDashboard, exact: true },
    { label: 'Executável', href: appHref(folder, 'executable'), Icon: IconTerminal2, exact: true },
    ...(showCloudflare
      ? [{ label: 'Cloudflare', href: appHref(folder, 'cloudflare'), Icon: IconCloud, exact: true } satisfies NavItem]
      : []),
    { label: 'Configuração', href: appHref(folder, 'settings'), Icon: IconAdjustments, exact: true },
  ];
  return <ShellSidebar label="Navegação da app" items={items} />;
}

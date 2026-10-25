'use client';

import { useSearchParams } from 'next/navigation';
import { SectionSidebar, type SectionSidebarGroup } from '@/components/ui/SectionSidebar';

const ITEMS: { label: string; href: string; badge?: string; external?: boolean }[] = [
  { label: 'Todos', href: '' },
  { label: 'Botões', href: '?secao=botoes' },
  { label: 'Inputs', href: '?secao=inputs' },
  { label: 'Checkboxes', href: '?secao=checkboxes' },
  { label: 'Selects', href: '?secao=selects' },
  { label: 'Toggles', href: '?secao=toggles' },
  { label: 'Sliders', href: '?secao=sliders' },
  { label: 'Filtros', href: '?secao=filtros' },
  { label: 'FormCard', href: '?secao=form-card' },
  { label: 'PageShell', href: '?secao=page-shell' },
  { label: 'PageLoading', href: '?secao=page-loading' },
  { label: 'Skeleton', href: '?secao=skeleton' },
  { label: 'SectionSidebar', href: '?secao=section-sidebar' },
  { label: 'ComingSoon', href: '?secao=coming-soon' },
  { label: 'AuthPage / AuthCard', href: '?secao=auth-card' },
  { label: 'BrandMark', href: '?secao=brand-mark' },
  { label: 'RozttaLogo', href: '?secao=roztta-logo' },
  { label: 'InlineAlert', href: '?secao=inline-alert' },
  { label: 'Toast', href: '?secao=toast' },
  { label: 'MarkdownEditor', href: '?secao=markdown-editor' },
  { label: 'Divider', href: '?secao=divider' },
  { label: 'Autocomplete', href: '?secao=autocomplete' },
  { label: 'PricingTooltip', href: '?secao=pricing-tooltip' },
  { label: 'TextLink', href: '?secao=text-link' },
  { label: 'Switchers', href: '?secao=switchers' },
  { label: 'Modais', href: '?secao=modais' },
  { label: 'Status badges', href: '?secao=status-badges' },
  { label: 'Tab filter', href: '?secao=tab-filter' },
  { label: 'NavMenuItem', href: '?secao=nav-menu-item' },
  { label: 'DropdownMenu', href: '?secao=dropdown-menu' },
  { label: 'TopbarActionButton', href: '?secao=topbar-action-button' },
  { label: 'Topbar', href: '?secao=topbar' },
  { label: 'AlertButton', href: '?secao=alert-button' },
  { label: 'SideDrawer', href: '?secao=side-drawer' },
  { label: 'NotificationsDrawer', href: '?secao=notifications-drawer' },
  { label: 'FlowCanvas', href: '?secao=flow-canvas' },
  { label: 'ThemeSelector', href: '?secao=theme-selector' },
  { label: 'ThemeModeGrid', href: '?secao=theme-mode-grid' },
  { label: 'TimezonePicker', href: '?secao=timezone-picker' },
  { label: 'ServiceRow', href: '?secao=service-row' },
  { label: 'DangerZone', href: '?secao=danger-zone' },
  { label: 'Kbd', href: '?secao=kbd' },
  { label: 'PreferenceToggleRow', href: '?secao=preference-toggle-row' },
  { label: 'SearchableListPanel', href: '?secao=searchable-list-panel' },
  { label: 'CommandPalette', href: '?secao=command-palette' },
  { label: 'ProfileMenu', href: '?secao=profile-menu' },
  { label: 'PieChart', href: '?secao=pie-chart' },
];

export function SidebarComponents() {
  const searchParams = useSearchParams();
  const activeSecao = searchParams.get('secao') ?? '';
  const base = '/components';

  const groups: SectionSidebarGroup[] = [
    {
      title: 'COMPONENTES',
      items: ITEMS.map((item) => ({
        label: item.label,
        href: `${base}${item.href}`,
        active: item.href === '' ? activeSecao === '' : item.href.includes(`secao=${activeSecao}`),
        badge: item.badge,
        external: item.external,
      })),
    },
  ];

  return (
    <SectionSidebar title="Componentes" ariaLabel="Navegação de componentes" groups={groups} />
  );
}

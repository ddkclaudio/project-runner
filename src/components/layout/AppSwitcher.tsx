import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { IconApps, IconPlus, IconArrowRight } from '@tabler/icons-react';
import { SwitcherDropdown } from '@/components/ui/SwitcherDropdown';
import { libraryList } from '@/lib/launcher-api';
import { parseAppRoute } from '@/lib/launcher-nav';
import { resolveSwitcherNavigation } from '@/lib/contextSwitchers';
import { useOrg } from '@/contexts/OrgContext';

export function AppSwitcher({ pathname }: { pathname: string }) {
  const navigate = useNavigate();
  const { activeOrg } = useOrg();
  const route = parseAppRoute(pathname);
  const library = useQuery({
    queryKey: ['launcher', 'library', activeOrg?.id],
    queryFn: libraryList,
    enabled: Boolean(activeOrg?.id),
  });
  const items = useMemo(
    () =>
      (library.data?.apps ?? []).map((app) => ({
        id: app.folderName || app.repository,
        label: app.name,
        searchText: `${app.name} ${app.repository} ${app.folderName || ''}`,
      })),
    [library.data],
  );
  if (!route) return null;
  const routeKey = (route.folder || route.repository).toLowerCase();
  const current =
    library.data?.apps.find((app) => (app.folderName || '').toLowerCase() === routeKey) ??
    (route.folder
      ? undefined
      : library.data?.apps.find((app) => app.repository.toLowerCase() === routeKey));

  return (
    <SwitcherDropdown
      aria-label="Trocar app"
      panelLabel="Apps"
      searchPlaceholder="Buscar app..."
      searchAriaLabel="Buscar apps"
      items={items}
      selectedId={route.folder || current?.folderName || route.repository}
      loading={library.isLoading}
      onSelect={(id) => {
        const href = resolveSwitcherNavigation('app', id, pathname);
        if (href) navigate(href);
      }}
      actions={[
        { label: 'Nova app', icon: <IconPlus size={14} />, onClick: () => navigate('/apps/new') },
        { label: 'Voltar à biblioteca', icon: <IconArrowRight size={14} />, onClick: () => navigate('/') },
      ]}
      trigger={
        <>
          <IconApps size={14} aria-hidden="true" />
          <span>{current?.name || route.repository}</span>
        </>
      }
    />
  );
}

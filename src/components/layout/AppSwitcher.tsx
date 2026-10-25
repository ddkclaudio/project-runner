import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { IconApps, IconPlus, IconArrowRight } from '@tabler/icons-react';
import { SwitcherDropdown } from '@/components/ui/SwitcherDropdown';
import { libraryList, appHref } from '@/lib/launcher-api';
import { parseAppRoute } from '@/lib/launcher-nav';

export function AppSwitcher({ pathname }: { pathname: string }) {
  const navigate = useNavigate();
  const route = parseAppRoute(pathname);
  const library = useQuery({ queryKey: ['launcher', 'library'], queryFn: libraryList });
  const items = useMemo(
    () => (library.data?.apps ?? []).map((app) => ({ id: app.repository, label: app.name, searchText: `${app.name} ${app.repository}` })),
    [library.data],
  );
  if (!route) return null;
  const current = library.data?.apps.find((app) => app.repository.toLowerCase() === route.repository.toLowerCase());

  return (
    <SwitcherDropdown
      aria-label="Trocar app"
      panelLabel="Apps"
      searchPlaceholder="Buscar app..."
      searchAriaLabel="Buscar apps"
      items={items}
      selectedId={route.repository}
      loading={library.isLoading}
      onSelect={(id) => navigate(appHref(id, route.section))}
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

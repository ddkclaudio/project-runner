import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IconArrowsSort, IconCircle, IconPlus } from '@tabler/icons-react';
import { PageShell } from '@/components/ui/PageShell';
import { Button } from '@/components/ui/Button';
import { GridView } from '@/components/ui/GridView';
import { ViewToolbar, type ViewMode } from '@/components/ui/ViewToolbar';
import { FilterDropdown, type FilterOption } from '@/components/ui/FilterDropdown';
import { libraryList, libraryRefresh, librarySetFilter, librarySetSort, settingsGet, settingsSave, type AppView } from '@/lib/launcher-api';
import { isEditableTarget } from '@/lib/hotkeys';
import { appId, LibraryCard, useLibraryMutations } from '@/components/launcher/LibraryCard';
import { LibraryListView } from '@/components/launcher/LibraryListView';
import { useToast } from '@/components/ui/Toast';
import { launcherError } from '@/lib/launcher-api';
import { useAppProgressStore } from '@/stores/app-progress';
import { useOrg } from '@/contexts/OrgContext';

type LibraryStatus = 'all' | 'installed' | 'not_installed' | 'update' | 'hidden';

const STATUS_FILTERS: { value: LibraryStatus; label: string; color: string }[] = [
  { value: 'installed', label: 'Instalada', color: 'var(--brand-green)' },
  { value: 'update', label: 'Atualização', color: 'var(--status-amber)' },
  { value: 'not_installed', label: 'Por instalar', color: 'var(--text-muted)' },
  { value: 'hidden', label: 'Oculta', color: 'var(--text-disabled)' },
];

const SORT_OPTIONS: FilterOption[] = [
  { value: 'Name', label: 'Nome', icon: <IconArrowsSort size={13} aria-hidden="true" /> },
  { value: 'NameDesc', label: 'Nome inverso', icon: <IconArrowsSort size={13} aria-hidden="true" /> },
  { value: 'Installed', label: 'Instaladas primeiro', icon: <IconArrowsSort size={13} aria-hidden="true" /> },
  { value: 'NotInstalled', label: 'Por instalar primeiro', icon: <IconArrowsSort size={13} aria-hidden="true" /> },
  { value: 'LastPlayed', label: 'Último uso', icon: <IconArrowsSort size={13} aria-hidden="true" /> },
];

export function HomePage() {
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeOrg } = useOrg();
  const actions = useLibraryMutations();
  const library = useQuery({
    queryKey: ['launcher', 'library', activeOrg?.id],
    queryFn: libraryList,
    refetchInterval: 3000,
    enabled: Boolean(activeOrg?.id),
  });
  const settings = useQuery({
    queryKey: ['launcher', 'settings', activeOrg?.id],
    queryFn: settingsGet,
    enabled: Boolean(activeOrg?.id),
  });
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LibraryStatus>('all');
  const statusSynced = useRef(false);
  const [focus, setFocus] = useState(-1);
  const progressById = useAppProgressStore((s) => s.byId);

  useEffect(() => {
    let cancelled = false;
    void libraryRefresh(false)
      .then(() => {
        if (!cancelled) void library.refetch();
      })
      .catch((err) => {
        if (!cancelled) toast.error(launcherError(err));
      });
    return () => {
      cancelled = true;
    };
    // Corre uma vez ao abrir a biblioteca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!library.data || statusSynced.current) return;
    statusSynced.current = true;
    if (library.data.installedOnly) setStatusFilter('installed');
  }, [library.data]);

  const apps = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (library.data?.apps ?? []).filter((app) => {
      if (statusFilter === 'hidden') {
        if (!app.manuallyHidden) return false;
      } else if (app.manuallyHidden || app.filterHidden) {
        return false;
      } else if (statusFilter === 'installed' && app.status === 'not_installed') {
        return false;
      } else if (statusFilter === 'not_installed' && app.status !== 'not_installed') {
        return false;
      } else if (statusFilter === 'update' && app.status !== 'update') {
        return false;
      }
      if (!q) return true;
      return (
        app.name.toLowerCase().includes(q) ||
        app.repository.toLowerCase().includes(q) ||
        app.folderName.toLowerCase().includes(q)
      );
    });
  }, [library.data, query, statusFilter]);

  useEffect(() => {
    if (settings.data && !settings.data.enableGamepadInput) return;
    let index = 0;
    let axisHeld = false;
    let axisSince = 0;
    let buttonSince = 0;
    const cards = () => Array.from(document.querySelectorAll<HTMLElement>('[data-library-card]'));
    const move = (delta: number) => {
      const items = cards();
      if (!items.length) return;
      index = (index + delta + items.length) % items.length;
      setFocus(index);
      items[index]?.focus();
    };
    const onKey = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        move(1);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        move(-1);
      } else if (event.key === ' ') {
        event.preventDefault();
        cards()[index]?.querySelector<HTMLElement>('[role="button"]')?.click();
      } else if (event.key === 'Shift' && event.location === 1) {
        (document.activeElement as HTMLElement | null)?.blur();
      }
    };
    let frame = 0;
    const poll = (time: number) => {
      frame = requestAnimationFrame(poll);
      if (document.hidden) return;
      const pad = navigator.getGamepads?.().find(Boolean);
      if (!pad) return;
      const axis = pad.axes[0] ?? 0;
      const pressed = Math.abs(axis) > 0.3 || pad.buttons[14]?.pressed || pad.buttons[15]?.pressed;
      if (!pressed) {
        axisHeld = false;
        return;
      }
      const delay = axisHeld ? 150 : 500;
      if (time - axisSince < delay) return;
      axisHeld = true;
      axisSince = time;
      move(axis > 0 || pad.buttons[15]?.pressed ? 1 : -1);
      if (pad.buttons[0]?.pressed && time - buttonSince > 300) {
        buttonSince = time;
        cards()[index]?.querySelector<HTMLElement>('[role="button"]')?.click();
      }
    };
    window.addEventListener('keydown', onKey);
    frame = requestAnimationFrame(poll);
    return () => {
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(frame);
    };
  }, [apps.length, settings.data?.enableGamepadInput]);

  async function primary(app: AppView) {
    if (app.running && app.status !== 'not_installed') {
      await actions.restart(app);
      return;
    }
    if (app.status === 'installed') {
      await actions.launch(app);
      return;
    }
    await actions.install(app);
  }

  async function changeSort(sortBy: string) {
    try {
      await librarySetSort(sortBy);
      await library.refetch();
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  async function changeFilter(installedOnly: boolean) {
    try {
      await librarySetFilter(installedOnly);
      await library.refetch();
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  async function changeStatus(value: string | null) {
    const next = (value ?? 'all') as LibraryStatus;
    setStatusFilter(next);
    const installedOnly = next === 'installed';
    if (installedOnly !== Boolean(library.data?.installedOnly)) await changeFilter(installedOnly);
  }

  async function changeView(mode: ViewMode) {
    const current = settings.data;
    if (!current) return;
    const { dataDir: _dataDir, appVersion: _appVersion, ...rest } = current;
    try {
      await settingsSave({ ...rest, useGridView: mode === 'grid' });
      await queryClient.invalidateQueries({ queryKey: ['launcher'] });
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  const snapshot = library.data;
  const sortBy = snapshot?.sortBy || 'LastPlayed';
  const view: ViewMode = snapshot?.useGrid === false ? 'list' : 'grid';
  const appCount = snapshot ? snapshot.apps.length : 0;
  const listLoading = library.isLoading && appCount === 0;
  const emptyMessage = query || statusFilter !== 'all' ? 'Nenhuma app corresponde aos filtros.' : 'Nenhuma app na biblioteca. Adicione uma para descarregar e lançar.';

  return (
    <PageShell>
      <PageShell.Heading>Biblioteca</PageShell.Heading>
      <ViewToolbar
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="Buscar app"
        searchAriaLabel="Buscar apps"
        view={view}
        onViewChange={(mode) => void changeView(mode)}
        ariaLabel="Barra de apps"
        filters={[
          {
            key: 'filters',
            label: 'Filtros',
            content: (
              <FilterDropdown
                title="Filtros e ordenação"
                aria-label="Filtros e ordenação"
                active={statusFilter !== 'all' || sortBy !== 'LastPlayed'}
                sections={[
                  {
                    id: 'status',
                    title: 'Status',
                    value: statusFilter === 'all' ? null : statusFilter,
                    onChange: (value) => void changeStatus(value),
                    options: STATUS_FILTERS.map((item) => ({
                      value: item.value,
                      label: item.label,
                      icon: (
                        <IconCircle size={8} fill={item.color} style={{ color: item.color }} aria-hidden="true" />
                      ),
                    })),
                  },
                  {
                    id: 'sort',
                    title: 'Ordenar por',
                    value: sortBy,
                    onChange: (value) => void changeSort(value ?? 'LastPlayed'),
                    options: SORT_OPTIONS,
                    clearable: false,
                  },
                ]}
              />
            ),
          },
        ]}
        rightSlot={
          <Button variant="secondary" size="sm" leftIcon={<IconPlus size={14} />} aria-label="Criar nova app" onClick={() => navigate('/apps/new')}>
            Nova app
          </Button>
        }
      />
      {view === 'grid' ? (
        <GridView
          items={apps}
          keyField="folderName"
          loading={listLoading}
          emptyMessage={emptyMessage}
          renderItem={(app) => (
            <LibraryCard
              app={app}
              focused={focus >= 0 && apps[focus] != null && appId(apps[focus]) === appId(app)}
              progress={progressById[appId(app)]}
              onPrimary={(item) => void primary(item)}
            />
          )}
        />
      ) : (
        <LibraryListView apps={apps} loading={listLoading} onPrimary={(item) => void primary(item)} onOpen={(item) => actions.open(item)} />
      )}
    </PageShell>
  );
}

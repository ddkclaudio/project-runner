import { useQuery, useQueryClient } from '@tanstack/react-query';
import { openUrl } from '@tauri-apps/plugin-opener';
import { IconExternalLink, IconPlayerPlay, IconPlayerStop } from '@tabler/icons-react';
import { SwitcherDropdown } from '@/components/ui/SwitcherDropdown';
import { useLibraryMutations } from '@/components/launcher/LibraryCard';
import { appDetail, appStop, launcherError } from '@/lib/launcher-api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';

export function ActionSwitcher({ repository }: { repository: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const actions = useLibraryMutations();
  const detail = useQuery({
    queryKey: ['launcher', 'app', repository],
    queryFn: () => appDetail(repository),
    refetchInterval: 2500,
  });
  const app = detail.data;
  const running = Boolean(app?.running);
  const openAppUrl = app?.openUrl?.trim() || '';
  const installed = app?.status !== 'not_installed';

  const items = running
    ? [
        ...(openAppUrl ? [{ id: 'open', label: 'Abrir no browser', searchText: 'abrir browser url site' }] : []),
        { id: 'stop', label: 'Stop', searchText: 'stop parar' },
      ]
    : [{ id: 'start', label: 'Start', searchText: 'start executar lançar' }];

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <SwitcherDropdown
        aria-label="Acções da app"
        panelLabel="Acção"
        searchPlaceholder="Buscar acção..."
        searchAriaLabel="Buscar acções"
        items={installed ? items : []}
        selectedId={running ? 'stop' : 'start'}
        loading={detail.isLoading}
        onSelect={(id) => {
          if (!app) return;
          if (id === 'open' && openAppUrl) {
            void openUrl(openAppUrl).catch((err) => toast.error(launcherError(err)));
            return;
          }
          if (id === 'stop') {
            void appStop(repository)
              .then(() => queryClient.invalidateQueries({ queryKey: ['launcher'] }))
              .then(() => toast.success('App parada.'))
              .catch((err) => toast.error(launcherError(err)));
            return;
          }
          void actions.launch(app);
        }}
        getEmptyMessage={() => (installed ? 'Sem acções.' : 'Instale a app para Start/Stop.')}
        trigger={
          <>
            {running ? <IconPlayerStop size={14} aria-hidden="true" /> : <IconPlayerPlay size={14} aria-hidden="true" />}
            <span>{running ? 'Em execução' : 'Parada'}</span>
          </>
        }
      />
      {running && openAppUrl ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          aria-label={`Abrir ${openAppUrl}`}
          onClick={() => void openUrl(openAppUrl).catch((err) => toast.error(launcherError(err)))}
        >
          <IconExternalLink size={14} aria-hidden="true" />
          Abrir
        </Button>
      ) : null}
    </div>
  );
}

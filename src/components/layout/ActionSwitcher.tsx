import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  IconBrandGithub,
  IconExternalLink,
  IconFolder,
  IconLoader2,
  IconPlayerPlay,
  IconPlayerStop,
  IconPlayerSkipForward,
} from '@tabler/icons-react';
import { SwitcherDropdown, type SwitcherItem } from '@/components/ui/SwitcherDropdown';
import { appId, useLibraryMutations } from '@/components/launcher/LibraryCard';
import { appDetail, appSkipUpdate, appStop, launcherError } from '@/lib/launcher-api';
import { useToast } from '@/components/ui/Toast';
import { useAppProgressStore } from '@/stores/app-progress';

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
  const id = app ? appId(app) : repository;
  const progress = useAppProgressStore((s) => s.byId[id]);
  const busy = Boolean(progress);
  const running = Boolean(app?.running);
  const openAppUrl = app?.openUrl?.trim() || '';
  const installed = app?.status !== 'not_installed';

  const items: SwitcherItem[] = useMemo(() => {
    if (!app || !installed) return [];
    const list: SwitcherItem[] = [
      {
        id: 'primary',
        label: actions.primaryLabel(app),
        searchText: 'lançar start descarregar atualizar instalar',
        leading: <IconPlayerPlay size={14} aria-hidden="true" />,
        disabled: busy,
      },
    ];
    if (running) {
      list.push({
        id: 'stop',
        label: 'Stop',
        searchText: 'stop parar',
        leading: <IconPlayerStop size={14} aria-hidden="true" />,
        disabled: busy,
      });
    }
    if (openAppUrl) {
      list.push({
        id: 'open-browser',
        label: 'Abrir no browser',
        searchText: 'abrir browser url site',
        leading: <IconExternalLink size={14} aria-hidden="true" />,
      });
    }
    list.push({
      id: 'open-folder',
      label: 'Abrir pasta',
      searchText: 'pasta folder abrir',
      leading: <IconFolder size={14} aria-hidden="true" />,
    });
    list.push({
      id: 'github',
      label: 'GitHub',
      searchText: 'github repositório repo',
      leading: <IconBrandGithub size={14} aria-hidden="true" />,
    });
    if (app.status === 'update' && app.remoteVersion) {
      list.push({
        id: 'skip-update',
        label: `Saltar ${app.remoteVersion}`,
        searchText: `saltar skip ${app.remoteVersion}`,
        leading: <IconPlayerSkipForward size={14} aria-hidden="true" />,
        disabled: busy,
      });
    }
    return list;
  }, [app, actions, busy, installed, openAppUrl, running]);

  const selectedId = busy ? 'primary' : running ? 'stop' : 'primary';

  return (
    <SwitcherDropdown
      aria-label="Acções da app"
      panelLabel="Acção"
      searchPlaceholder="Buscar acção..."
      searchAriaLabel="Buscar acções"
      items={items}
      selectedId={selectedId}
      loading={detail.isLoading}
      onSelect={(itemId) => {
        if (!app) return;
        if (itemId === 'primary') {
          if (busy) {
            toast.error('Já em curso…');
            return;
          }
          if (app.status === 'installed') void actions.launch(app);
          else void actions.install(app);
          return;
        }
        if (itemId === 'stop') {
          void appStop(appId(app))
            .then(() => queryClient.invalidateQueries({ queryKey: ['launcher'] }))
            .then(() => toast.success('App parada.'))
            .catch((err) => toast.error(launcherError(err)));
          return;
        }
        if (itemId === 'open-browser' && openAppUrl) {
          void openUrl(openAppUrl).catch((err) => toast.error(launcherError(err)));
          return;
        }
        if (itemId === 'open-folder') {
          void actions.openFolder(app);
          return;
        }
        if (itemId === 'github') {
          void openUrl(`https://github.com/${app.repository}`).catch((err) => toast.error(launcherError(err)));
          return;
        }
        if (itemId === 'skip-update' && app.remoteVersion) {
          void appSkipUpdate(appId(app), app.remoteVersion)
            .then(() => queryClient.invalidateQueries({ queryKey: ['launcher'] }))
            .catch((err) => toast.error(launcherError(err)));
        }
      }}
      getEmptyMessage={() => (installed ? 'Sem acções.' : 'Instale a app para ver acções.')}
      trigger={
        <>
          {busy ? (
            <IconLoader2
              size={14}
              aria-hidden="true"
              style={{ animation: 'appProgressSpin 1s linear infinite' }}
            />
          ) : running ? (
            <IconPlayerStop size={14} aria-hidden="true" />
          ) : (
            <IconPlayerPlay size={14} aria-hidden="true" />
          )}
          <span>
            {busy
              ? progress?.phase?.slice(0, 28) || 'A trabalhar…'
              : running
                ? 'Em execução'
                : 'Parada'}
          </span>
        </>
      }
    />
  );
}

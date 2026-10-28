import { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { openUrl } from '@tauri-apps/plugin-opener';
import {
  IconBrandGithub,
  IconBrandCloudflare,
  IconCloud,
  IconExternalLink,
  IconFolder,
  IconLoader2,
  IconPlayerPlay,
  IconPlayerStop,
  IconPlayerSkipForward,
} from '@tabler/icons-react';
import { SwitcherDropdown, type SwitcherItem } from '@/components/ui/SwitcherDropdown';
import { appId, useLibraryMutations } from '@/components/launcher/LibraryCard';
import {
  appCloudflareGet,
  appDetail,
  appSkipUpdate,
  appStop,
  launcherError,
} from '@/lib/launcher-api';
import { useToast } from '@/components/ui/Toast';
import { useAppProgressStore } from '@/stores/app-progress';
import { useOrg } from '@/contexts/OrgContext';

function isQuickCloudflareUrl(url: string) {
  return url.includes('trycloudflare.com');
}

export function ActionSwitcher({ repository }: { repository: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { activeOrg } = useOrg();
  const actions = useLibraryMutations();
  const detail = useQuery({
    queryKey: ['launcher', 'app', activeOrg?.id, repository],
    queryFn: () => appDetail(repository),
    refetchInterval: 2500,
    enabled: Boolean(activeOrg?.id),
  });
  const app = detail.data;
  const id = app ? appId(app) : repository;
  const progress = useAppProgressStore((s) => s.byId[id]);
  const busy = Boolean(progress);
  const running = Boolean(app?.running);
  const openAppUrl = app?.openUrl?.trim() || '';
  const installed = app?.status !== 'not_installed';

  const cloudflare = useQuery({
    queryKey: ['launcher', 'cloudflare', activeOrg?.id, id],
    queryFn: () => appCloudflareGet(id),
    enabled: Boolean(activeOrg?.id && app && installed),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data?.running) return 8000;
      return data.publicUrl ? 5000 : 1500;
    },
  });

  const cloudflareUrl =
    cloudflare.data?.running && running ? cloudflare.data.publicUrl?.trim() || '' : '';
  const tunnelRunning = Boolean(cloudflareUrl);
  const cloudflareMode = cloudflare.data?.mode ?? cloudflare.data?.config?.mode;
  const showQuickOpen =
    tunnelRunning && (cloudflareMode === 'quick' || isQuickCloudflareUrl(cloudflareUrl));
  const showDnsOpen =
    tunnelRunning &&
    (cloudflareMode === 'named' || (!isQuickCloudflareUrl(cloudflareUrl) && Boolean(cloudflareUrl)));

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
    if (running && openAppUrl) {
      list.push({
        id: 'open-browser',
        label: 'Abrir',
        searchText: 'abrir browser url site local localhost',
        leading: <IconExternalLink size={14} aria-hidden="true" />,
      });
    }
    if (running && showQuickOpen) {
      list.push({
        id: 'open-cloudflare-quick',
        label: 'Abrir Cloudflare Quick',
        searchText: 'abrir cloudflare quick trycloudflare túnel tunnel',
        leading: <IconBrandCloudflare size={14} aria-hidden="true" />,
      });
    }
    if (running && showDnsOpen) {
      list.push({
        id: 'open-cloudflare-dns',
        label: 'Abrir Cloudflare DNS',
        searchText: 'abrir cloudflare dns domínio domain hostname túnel tunnel',
        leading: <IconCloud size={14} aria-hidden="true" />,
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
  }, [app, actions, busy, installed, openAppUrl, running, showDnsOpen, showQuickOpen]);

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
            .then(() =>
              Promise.all([
                queryClient.invalidateQueries({ queryKey: ['launcher'] }),
                queryClient.invalidateQueries({ queryKey: ['launcher', 'cloudflare'] }),
              ]),
            )
            .then(() => toast.success('App e túnel Cloudflare parados.'))
            .catch((err) => toast.error(launcherError(err)));
          return;
        }
        if (itemId === 'open-browser' && openAppUrl) {
          void openUrl(openAppUrl).catch((err) => toast.error(launcherError(err)));
          return;
        }
        if (itemId === 'open-cloudflare-quick' && cloudflareUrl) {
          void openUrl(cloudflareUrl).catch((err) => toast.error(launcherError(err)));
          return;
        }
        if (itemId === 'open-cloudflare-dns' && cloudflareUrl) {
          void openUrl(cloudflareUrl).catch((err) => toast.error(launcherError(err)));
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

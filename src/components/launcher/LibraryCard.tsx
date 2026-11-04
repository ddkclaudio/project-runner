import { convertFileSrc } from '@tauri-apps/api/core';
import { openUrl } from '@tauri-apps/plugin-opener';
import { IconPlayerPlay, IconPlayerStop, IconDownload, IconRefresh, IconFolder, IconEyeOff, IconEye, IconExternalLink } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ItemCard, gridCardStyles as gc } from '@/components/ui/ItemCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import type { ContextMenuItem } from '@/components/ui/ContextMenu';
import { useToast } from '@/components/ui/Toast';
import {
  appHide,
  appHref,
  appInstall,
  appLaunch,
  appOpenFolder,
  appStop,
  launcherError,
  windowClose,
  type AppView,
  type InstallResult,
  type LaunchResult,
} from '@/lib/launcher-api';
import { useAppProgressStore } from '@/stores/app-progress';
import styles from '@/pages/library.module.css';

export function appIconSrc(app: { iconPath?: string | null; appIconUrl?: string | null }) {
  if (app.iconPath) return convertFileSrc(app.iconPath);
  return app.appIconUrl || '';
}

/** Identidade estável da app (pasta no disco); permite o mesmo repositório várias vezes. */
export function appId(app: { folderName?: string | null; repository: string }) {
  return app.folderName?.trim() || app.repository;
}

export function useLibraryMutations() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['launcher'] });
  }

  async function afterLaunch(result: LaunchResult) {
    const url = result.openUrl?.trim();
    toast.success(result.message, url ? { description: `Acesso: ${url}`, durationMs: 8000 } : undefined);
    if (result.started) {
      window.dispatchEvent(new CustomEvent('painel-fade-music'));
      if (url) {
        // Pequena pausa para o servidor Node subir antes de abrir o browser.
        window.setTimeout(() => {
          void import('@tauri-apps/plugin-opener').then(({ openUrl }) => openUrl(url)).catch(() => undefined);
        }, 2500);
      }
      if (result.closeAfterLaunch) {
        try {
          await windowClose();
        } catch (err) {
          toast.error(launcherError(err));
        }
      }
    }
    await refresh();
    return result;
  }

  return {
    async install(app: AppView, options?: { assetName?: string; tag?: string; confirmWine?: boolean }) {
      const id = appId(app);
      const { isBusy, setProgress, clearProgress } = useAppProgressStore.getState();
      if (isBusy(id)) {
        toast.error('Já em curso…');
        return null;
      }
      setProgress(id, { percent: 1, phase: 'A iniciar instalação…', kind: 'install' });
      try {
        const result = await appInstall(id, options);
        if (result.needsChoice || result.needsConfirm) {
          window.dispatchEvent(
            new CustomEvent('painel-install-choice', {
              detail: {
                app,
                assets: result.assets,
                warning: result.warning ?? null,
                confirm: result.needsConfirm,
                tag: options?.tag ?? null,
              },
            }),
          );
        } else {
          toast.success(result.message);
        }
        await refresh();
        return result;
      } catch (err) {
        toast.error(launcherError(err));
        return null;
      } finally {
        clearProgress(id);
      }
    },
    async launch(
      app: AppView,
      executable?: string,
      options?: { force?: boolean },
    ): Promise<LaunchResult | null> {
      const id = appId(app);
      const { isBusy, setProgress, clearProgress } = useAppProgressStore.getState();
      if (isBusy(id) && !options?.force) {
        toast.error('Já em curso…');
        return null;
      }
      setProgress(id, {
        percent: 1,
        phase: options?.force ? 'A forçar inicialização…' : 'A iniciar…',
        kind: 'launch',
      });
      try {
        const result = await appLaunch(id, executable, options?.force ?? false);
        if (result.needsChoice) {
          window.dispatchEvent(
            new CustomEvent('painel-exe-choice', {
              detail: { app, executables: result.executables },
            }),
          );
          return result;
        }
        if (result.needsForce && !options?.force) {
          clearProgress(id);
          window.dispatchEvent(
            new CustomEvent('painel-port-busy', {
              detail: {
                app,
                executable,
                port: result.forcePort,
                pid: result.forcePid,
                processName: result.forceProcessName,
                message: result.message,
              },
            }),
          );
          return result;
        }
        return await afterLaunch(result);
      } catch (err) {
        toast.error(launcherError(err));
        return null;
      } finally {
        window.setTimeout(() => clearProgress(id), 700);
      }
    },
    async stop(app: AppView) {
      try {
        const result = await appStop(appId(app));
        await refresh();
        await queryClient.invalidateQueries({ queryKey: ['launcher', 'cloudflare'] });
        toast.success(result.tunnelStopped ? 'App e túnel Cloudflare parados.' : 'App parada.');
        return true;
      } catch (err) {
        toast.error(launcherError(err));
        return false;
      }
    },
    async restart(app: AppView) {
      const id = appId(app);
      const { isBusy } = useAppProgressStore.getState();
      if (isBusy(id)) {
        toast.error('Já em curso…');
        return null;
      }
      try {
        await appStop(id);
        await refresh();
        await queryClient.invalidateQueries({ queryKey: ['launcher', 'cloudflare'] });
      } catch (err) {
        toast.error(launcherError(err));
        return null;
      }
      return this.launch(app);
    },
    async hide(app: AppView) {
      try {
        await appHide(appId(app), !app.manuallyHidden);
        await refresh();
      } catch (err) {
        toast.error(launcherError(err));
      }
    },
    async openFolder(app: AppView) {
      try {
        await appOpenFolder(appId(app));
      } catch (err) {
        toast.error(launcherError(err));
      }
    },
    open(app: AppView) {
      navigate(appHref(app));
    },
    primaryLabel(app: AppView) {
      if (app.running && app.status !== 'not_installed') return 'Reiniciar';
      if (app.status === 'update') return 'Atualizar';
      if (app.status === 'installed') return 'Lançar';
      return 'Descarregar';
    },
  };
}

export function appStatusMeta(status: string): { label: string; tone: StatusTone } {
  if (status === 'installed') return { label: 'Instalada', tone: 'success' };
  if (status === 'update') return { label: 'Atualização', tone: 'warning' };
  return { label: 'Por instalar', tone: 'muted' };
}

export function versionBadge(app: AppView): { label: string; variant: 'green' | 'amber' | 'neutral' } | null {
  if (app.installedVersion) return { label: app.installedVersion, variant: app.status === 'update' ? 'amber' : 'green' };
  return null;
}

export function libraryMenu(
  app: AppView,
  actions: ReturnType<typeof useLibraryMutations>,
  onPrimary: (app: AppView) => void,
): ContextMenuItem[] {
  const primary = actions.primaryLabel(app);
  const restarting = Boolean(app.running && app.status !== 'not_installed');
  const PrimaryIcon = restarting || app.status === 'update' ? IconRefresh : app.status === 'installed' ? IconPlayerPlay : IconDownload;
  const items: ContextMenuItem[] = [
    { label: 'Abrir no Project Runner', icon: <IconEye size={15} />, onClick: () => actions.open(app) },
    { label: primary, icon: <PrimaryIcon size={15} />, onClick: () => onPrimary(app) },
  ];
  if (app.running) {
    items.push({
      label: 'Parar',
      icon: <IconPlayerStop size={15} />,
      onClick: () => void actions.stop(app),
    });
  }
  if (restarting && app.status === 'update') {
    items.push({
      label: 'Atualizar',
      icon: <IconRefresh size={15} />,
      onClick: () => void actions.install(app),
    });
  }
  if (app.running && app.openUrl) {
    items.push({
      label: 'Abrir no browser',
      icon: <IconExternalLink size={15} />,
      onClick: () => void openUrl(app.openUrl!).catch(() => undefined),
    });
  }
  items.push(
    { label: 'Pasta', icon: <IconFolder size={15} />, onClick: () => void actions.openFolder(app) },
    {
      label: app.manuallyHidden ? 'Mostrar' : 'Ocultar',
      icon: <IconEyeOff size={15} />,
      onClick: () => void actions.hide(app),
    },
  );
  return items;
}

export function LibraryCard({
  app,
  focused,
  progress,
  onPrimary,
}: {
  app: AppView;
  focused?: boolean;
  progress?: { percent: number; phase: string };
  onPrimary: (app: AppView) => void;
}) {
  const actions = useLibraryMutations();
  const version = versionBadge(app);
  const status = progress
    ? { label: `${progress.phase} ${progress.percent}%`, tone: 'info' as const }
    : appStatusMeta(app.status);

  const hostClass = [
    styles.cardHost,
    focused ? styles.focused : '',
    app.running ? styles.running : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div data-library-card tabIndex={0} className={hostClass}>
      <ItemCard
        aria-label={`Abrir app ${app.name}`}
        highlight={focused || Boolean(app.running)}
        onClick={() => actions.open(app)}
        actions={{
          label: `Ações para ${app.name}`,
          items: libraryMenu(app, actions, onPrimary),
        }}
      >
        <div className={gc.body}>
          <div className={gc.title}>{app.name}</div>
          <div className={gc.sub} title={app.repository}>
            {app.repository}
          </div>
          <div className={gc.meta}>
            {version ? <Badge variant={version.variant}>{version.label}</Badge> : null}
            <StatusBadge label={status.label} tone={status.tone} />
            {app.running ? <StatusBadge label="Em execução" tone="success" /> : null}
          </div>
          {progress ? (
            <div className={styles.progress} aria-valuenow={progress.percent} role="progressbar">
              <span style={{ width: `${progress.percent}%` }} />
            </div>
          ) : null}
        </div>
      </ItemCard>
    </div>
  );
}

export function ChoiceList({
  options,
  onPick,
}: {
  options: string[];
  onPick: (value: string) => void;
}) {
  return (
    <div className={styles.choice}>
      {options.map((option) => (
        <Button key={option} onClick={() => onPick(option)}>
          {option}
        </Button>
      ))}
    </div>
  );
}

export type { InstallResult };

import { convertFileSrc } from '@tauri-apps/api/core';
import { IconPlayerPlay, IconDownload, IconRefresh, IconFolder, IconEyeOff, IconEye } from '@tabler/icons-react';
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
  launcherError,
  windowClose,
  type AppView,
  type InstallResult,
  type LaunchResult,
} from '@/lib/launcher-api';
import styles from '@/pages/library.module.css';

export function appIconSrc(app: { iconPath?: string | null; appIconUrl?: string | null }) {
  if (app.iconPath) return convertFileSrc(app.iconPath);
  return app.appIconUrl || '';
}

export function useLibraryMutations() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ['launcher'] });
  }

  async function afterLaunch(result: LaunchResult) {
    toast.success(result.message);
    if (result.started) {
      window.dispatchEvent(new CustomEvent('painel-fade-music'));
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
      try {
        const result = await appInstall(app.repository, options);
        if (!result.needsChoice && !result.needsConfirm) toast.success(result.message);
        await refresh();
        return result;
      } catch (err) {
        toast.error(launcherError(err));
        return null;
      }
    },
    async launch(app: AppView, executable?: string): Promise<LaunchResult | null> {
      try {
        return await afterLaunch(await appLaunch(app.repository, executable));
      } catch (err) {
        toast.error(launcherError(err));
        return null;
      }
    },
    async hide(app: AppView) {
      try {
        await appHide(app.repository, !app.manuallyHidden);
        await refresh();
      } catch (err) {
        toast.error(launcherError(err));
      }
    },
    async openFolder(app: AppView) {
      try {
        await appOpenFolder(app.repository);
      } catch (err) {
        toast.error(launcherError(err));
      }
    },
    open(app: AppView) {
      navigate(appHref(app.repository));
    },
    primaryLabel(app: AppView) {
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
  const PrimaryIcon = app.status === 'update' ? IconRefresh : app.status === 'installed' ? IconPlayerPlay : IconDownload;
  return [
    { label: 'Abrir', icon: <IconEye size={15} />, onClick: () => actions.open(app) },
    { label: primary, icon: <PrimaryIcon size={15} />, onClick: () => onPrimary(app) },
    { label: 'Pasta', icon: <IconFolder size={15} />, onClick: () => void actions.openFolder(app) },
    {
      label: app.manuallyHidden ? 'Mostrar' : 'Ocultar',
      icon: <IconEyeOff size={15} />,
      onClick: () => void actions.hide(app),
    },
  ];
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

  return (
    <div data-library-card tabIndex={0} className={focused ? `${styles.cardHost} ${styles.focused}` : styles.cardHost}>
      <ItemCard
        aria-label={`Abrir app ${app.name}`}
        highlight={focused}
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

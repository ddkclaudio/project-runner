import { convertFileSrc } from '@tauri-apps/api/core';
import { IconPlayerPlay, IconDownload, IconRefresh, IconFolder, IconEyeOff, IconEye } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ItemCard } from '@/components/ui/ItemCard';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import {
  appHide,
  appHref,
  appInstall,
  appLaunch,
  appOpenFolder,
  launcherError,
  statusLabel,
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
  const icon = appIconSrc(app);
  const primary = actions.primaryLabel(app);
  const PrimaryIcon = app.status === 'update' ? IconRefresh : app.status === 'installed' ? IconPlayerPlay : IconDownload;

  return (
    <div data-library-card tabIndex={0} className={focused ? styles.focused : undefined}>
      <ItemCard
        aria-label={app.name}
        onClick={() => actions.open(app)}
        actions={{
          label: `Ações de ${app.name}`,
          items: [
            { label: 'Abrir', icon: <IconEye size={15} />, onClick: () => actions.open(app) },
            { label: primary, icon: <PrimaryIcon size={15} />, onClick: () => onPrimary(app) },
            { label: 'Pasta', icon: <IconFolder size={15} />, onClick: () => void actions.openFolder(app) },
            {
              label: app.manuallyHidden ? 'Mostrar' : 'Ocultar',
              icon: <IconEyeOff size={15} />,
              onClick: () => void actions.hide(app),
            },
          ],
        }}
      >
        <div className={styles.cardBody}>
          {icon ? <img className={styles.icon} src={icon} alt="" /> : <span className={styles.icon} />}
          <h2 className={styles.title}>{app.name}</h2>
          <p className={styles.meta}>{app.repository}</p>
          <p className={styles.meta}>
            {app.installedVersion ? `Instalada ${app.installedVersion}` : 'Ainda não instalada'}
            {app.remoteVersion ? ` · remota ${app.remoteVersion}` : ''}
          </p>
          {progress ? (
            <div>
              <div className={styles.progress} aria-valuenow={progress.percent} role="progressbar">
                <span style={{ width: `${progress.percent}%` }} />
              </div>
              <p className={styles.meta}>{progress.phase} {progress.percent}%</p>
            </div>
          ) : null}
          <div className={styles.row}>
            <StatusBadge
              label={statusLabel(app.status)}
              tone={app.status === 'update' ? 'warning' : app.status === 'installed' ? 'success' : 'muted'}
            />
            <Button
              size="sm"
              variant="primary"
              onClick={(event) => {
                event.stopPropagation();
                onPrimary(app);
              }}
            >
              {primary}
            </Button>
          </div>
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

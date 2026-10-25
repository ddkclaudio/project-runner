import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageShell } from '@/components/ui/PageShell';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { PreferenceToggleRow } from '@/components/ui/PreferenceToggleRow';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { useToast } from '@/components/ui/Toast';
import {
  launcherApplyUpdate,
  launcherCheckUpdate,
  launcherError,
  settingsGet,
  settingsSave,
  type PublicSettings,
  type UpdateStatus,
} from '@/lib/launcher-api';
import styles from './library.module.css';

type Draft = Omit<PublicSettings, 'dataDir' | 'appVersion'>;

const EMPTY: Draft = {
  appsPath: '',
  githubApiToken: '',
  platform: 'Auto',
  sortBy: 'LastPlayed',
  useGridView: true,
  startFullscreen: false,
  closeAfterLaunch: false,
  backgroundImagePath: '',
  launcherMusicPath: '',
  musicVolume: 0.2,
  backgroundOpacity: 0.15,
  enableGamepadInput: true,
  linuxWindowsLaunchCommand: '',
  appListRepository: 'SirDiabo/GHLAppList',
  painelUpdateRepository: '',
};

export function SettingsPage({ section }: { section: 'general' | 'github' | 'appearance' | 'launch' }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['launcher', 'settings'], queryFn: settingsGet });
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [update, setUpdate] = useState<UpdateStatus | null>(null);

  useEffect(() => {
    if (!settings.data) return;
    const { dataDir: _dataDir, appVersion: _appVersion, ...rest } = settings.data;
    setDraft(rest);
  }, [settings.data]);

  function patch(partial: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  async function save() {
    try {
      await settingsSave(draft);
      await queryClient.invalidateQueries({ queryKey: ['launcher'] });
      toast.success('Definições guardadas.');
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  return (
    <PageShell>
      <PageShell.Heading subtitle={settings.data ? `Dados em ${settings.data.dataDir} · Painel ${settings.data.appVersion}` : 'A carregar definições…'}>
        {section === 'github' ? 'GitHub' : section === 'appearance' ? 'Aparência' : section === 'launch' ? 'Lançamento' : 'Geral'}
      </PageShell.Heading>
      <div className={styles.stack}>
        {section === 'general' ? (
          <>
            <Input label="Pasta das apps" value={draft.appsPath} onChange={(event) => patch({ appsPath: event.target.value })} hint="Vazio usa a pasta Apps ao lado do executável." />
            <Select
              aria-label="Plataforma"
              value={draft.platform}
              onChange={(value) => patch({ platform: value })}
              options={[
                { value: 'Auto', label: 'Automática' },
                { value: 'Windows', label: 'Windows' },
                { value: 'macOS', label: 'macOS' },
                { value: 'Linux-X64', label: 'Linux x64' },
                { value: 'Linux-ARM64', label: 'Linux ARM64' },
              ]}
            />
            <Select
              aria-label="Ordenação"
              value={draft.sortBy}
              onChange={(value) => patch({ sortBy: value })}
              options={[
                { value: 'LastPlayed', label: 'Último uso' },
                { value: 'Name', label: 'Nome' },
                { value: 'NameDesc', label: 'Nome inverso' },
                { value: 'Installed', label: 'Instaladas primeiro' },
                { value: 'NotInstalled', label: 'Por instalar primeiro' },
              ]}
            />
            <PreferenceToggleRow title="Grelha" description="Desligado, a biblioteca fica em lista." checked={draft.useGridView} onChange={(useGridView) => patch({ useGridView })} />
            <PreferenceToggleRow title="Ecrã cheio ao abrir" checked={draft.startFullscreen} onChange={(startFullscreen) => patch({ startFullscreen })} />
          </>
        ) : null}
        {section === 'github' ? (
          <>
            <Input label="Token" type="password" value={draft.githubApiToken} onChange={(event) => patch({ githubApiToken: event.target.value })} hint="Token clássico, sem permissões. Serve para passar das 60 consultas anónimas por hora." />
            <Input label="Repositório do catálogo" value={draft.appListRepository} onChange={(event) => patch({ appListRepository: event.target.value })} />
            <Input label="Repositório de atualização do Painel" value={draft.painelUpdateRepository} onChange={(event) => patch({ painelUpdateRepository: event.target.value })} hint="Vazio desliga a atualização. Não use o repositório Avalonia do GithubLauncher." />
            {update ? <InlineAlert variant={update.updateAvailable ? 'warning' : 'info'}>{update.message}</InlineAlert> : null}
            <div style={{ display: 'flex', gap: 8 }}>
              <Button onClick={() => void launcherCheckUpdate(true).then(setUpdate).catch((err) => toast.error(launcherError(err)))}>Procurar atualização</Button>
              <Button variant="primary" disabled={!update?.updateAvailable} onClick={() => void launcherApplyUpdate().catch((err) => toast.error(launcherError(err)))}>Aplicar</Button>
            </div>
          </>
        ) : null}
        {section === 'appearance' ? (
          <>
            <Input label="Imagem de fundo" value={draft.backgroundImagePath} onChange={(event) => patch({ backgroundImagePath: event.target.value })} />
            <label className={styles.meta}>Opacidade do fundo</label>
            <Slider aria-label="Opacidade do fundo" min={0} max={100} value={Math.round(draft.backgroundOpacity * 100)} onChange={(value) => patch({ backgroundOpacity: value / 100 })} />
            <Input label="Música" value={draft.launcherMusicPath} onChange={(event) => patch({ launcherMusicPath: event.target.value })} />
            <label className={styles.meta}>Volume</label>
            <Slider aria-label="Volume" min={0} max={100} value={Math.round(draft.musicVolume * 100)} onChange={(value) => patch({ musicVolume: value / 100 })} />
          </>
        ) : null}
        {section === 'launch' ? (
          <>
            <PreferenceToggleRow title="Fechar depois de lançar" checked={draft.closeAfterLaunch} onChange={(closeAfterLaunch) => patch({ closeAfterLaunch })} />
            <PreferenceToggleRow title="Comando" description="Setas, Espaço e gamepad movem o foco na biblioteca." checked={draft.enableGamepadInput} onChange={(enableGamepadInput) => patch({ enableGamepadInput })} />
            <Input label="Comando Linux para executáveis Windows" value={draft.linuxWindowsLaunchCommand} onChange={(event) => patch({ linuxWindowsLaunchCommand: event.target.value })} hint="{exe}, {gamePath} e {exeDir}" />
          </>
        ) : null}
        <Button variant="primary" onClick={() => void save()}>Guardar</Button>
      </div>
    </PageShell>
  );
}

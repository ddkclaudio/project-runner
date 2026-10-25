import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageShell } from '@/components/ui/PageShell';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { PreferenceToggleRow } from '@/components/ui/PreferenceToggleRow';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { FormCard, FormRow } from '@/components/ui/FormCard';
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

  async function save(event?: React.FormEvent) {
    event?.preventDefault();
    try {
      await settingsSave(draft);
      await queryClient.invalidateQueries({ queryKey: ['launcher'] });
      toast.success('Definições guardadas.');
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  const title =
    section === 'github' ? 'GitHub' : section === 'appearance' ? 'Aparência' : section === 'launch' ? 'Lançamento' : 'Geral';

  return (
    <PageShell>
      <PageShell.Heading subtitle={settings.data ? `Dados em ${settings.data.dataDir} · Painel ${settings.data.appVersion}` : 'A carregar definições…'}>
        {title}
      </PageShell.Heading>

      <FormCard onSubmit={(event) => void save(event)} aria-label={`Definições · ${title}`}>
        {section === 'general' ? (
          <>
            <FormCard.Header title="Geral" subtitle="Pastas, plataforma e vista da biblioteca." />
            <FormRow label="Pasta das apps">
              <Input value={draft.appsPath} onChange={(event) => patch({ appsPath: event.target.value })} />
              <FormCard.Hint>Vazio usa a pasta Apps ao lado do executável.</FormCard.Hint>
            </FormRow>
            <FormRow label="Plataforma">
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
            </FormRow>
            <FormRow label="Ordenação">
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
            </FormRow>
            <PreferenceToggleRow title="Grelha" description="Desligado, a biblioteca fica em lista." checked={draft.useGridView} onChange={(useGridView) => patch({ useGridView })} />
            <PreferenceToggleRow title="Ecrã cheio ao abrir" checked={draft.startFullscreen} onChange={(startFullscreen) => patch({ startFullscreen })} />
          </>
        ) : null}

        {section === 'github' ? (
          <>
            <FormCard.Header title="GitHub" subtitle="Token e repositórios remotos." />
            <FormRow label="Token">
              <Input type="password" value={draft.githubApiToken} onChange={(event) => patch({ githubApiToken: event.target.value })} />
              <FormCard.Hint>Token clássico, sem permissões. Serve para passar das 60 consultas anónimas por hora.</FormCard.Hint>
            </FormRow>
            <FormRow label="Catálogo">
              <Input value={draft.appListRepository} onChange={(event) => patch({ appListRepository: event.target.value })} />
            </FormRow>
            <FormRow label="Atualização">
              <Input value={draft.painelUpdateRepository} onChange={(event) => patch({ painelUpdateRepository: event.target.value })} />
              <FormCard.Hint>Vazio desliga a atualização. Não use o repositório Avalonia do GithubLauncher.</FormCard.Hint>
            </FormRow>
            <FormRow label="Versão" alignStart>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {update ? <InlineAlert variant={update.updateAvailable ? 'warning' : 'info'}>{update.message}</InlineAlert> : null}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Button type="button" onClick={() => void launcherCheckUpdate(true).then(setUpdate).catch((err) => toast.error(launcherError(err)))}>
                    Procurar atualização
                  </Button>
                  <Button type="button" variant="secondary" disabled={!update?.updateAvailable} onClick={() => void launcherApplyUpdate().catch((err) => toast.error(launcherError(err)))}>
                    Aplicar
                  </Button>
                </div>
              </div>
            </FormRow>
          </>
        ) : null}

        {section === 'appearance' ? (
          <>
            <FormCard.Header title="Aparência" subtitle="Fundo e música do launcher." />
            <FormRow label="Imagem de fundo">
              <Input value={draft.backgroundImagePath} onChange={(event) => patch({ backgroundImagePath: event.target.value })} />
            </FormRow>
            <FormRow label="Opacidade">
              <Slider aria-label="Opacidade do fundo" min={0} max={100} value={Math.round(draft.backgroundOpacity * 100)} onChange={(value) => patch({ backgroundOpacity: value / 100 })} />
            </FormRow>
            <FormRow label="Música">
              <Input value={draft.launcherMusicPath} onChange={(event) => patch({ launcherMusicPath: event.target.value })} />
            </FormRow>
            <FormRow label="Volume">
              <Slider aria-label="Volume" min={0} max={100} value={Math.round(draft.musicVolume * 100)} onChange={(value) => patch({ musicVolume: value / 100 })} />
            </FormRow>
          </>
        ) : null}

        {section === 'launch' ? (
          <>
            <FormCard.Header title="Lançamento" subtitle="Comportamento ao abrir apps." />
            <PreferenceToggleRow title="Fechar depois de lançar" checked={draft.closeAfterLaunch} onChange={(closeAfterLaunch) => patch({ closeAfterLaunch })} />
            <PreferenceToggleRow title="Comando" description="Setas, Espaço e gamepad movem o foco na biblioteca." checked={draft.enableGamepadInput} onChange={(enableGamepadInput) => patch({ enableGamepadInput })} />
            <FormRow label="Linux / Windows">
              <Input value={draft.linuxWindowsLaunchCommand} onChange={(event) => patch({ linuxWindowsLaunchCommand: event.target.value })} />
              <FormCard.Hint>{'{exe}'}, {'{gamePath}'} e {'{exeDir}'}</FormCard.Hint>
            </FormRow>
          </>
        ) : null}

        <FormCard.Footer right={<Button type="submit" variant="secondary">Guardar</Button>} />
      </FormCard>
    </PageShell>
  );
}

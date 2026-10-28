import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { IconAlertTriangle, IconFolder } from '@tabler/icons-react';
import { PageShell } from '@/components/ui/PageShell';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { Slider } from '@/components/ui/Slider';
import { PreferenceToggleRow } from '@/components/ui/PreferenceToggleRow';
import { FormCard, FormRow } from '@/components/ui/FormCard';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountLocalPrefs } from '@/hooks/useAccountLocalPrefs';
import { authErrorMessage } from '@/lib/auth-api';
import {
  getDataLocation,
  launcherApplyUpdate,
  launcherCheckUpdate,
  launcherError,
  setDataLocation,
  settingsGet,
  settingsSave,
  type PublicSettings,
  type UpdateStatus,
} from '@/lib/launcher-api';
import { logOpenFolder, logPath } from '@/lib/activity-log';

type Draft = Omit<PublicSettings, 'dataDir' | 'appVersion'>;

const EMPTY: Draft = {
  appsPath: '',
  githubApiToken: '',
  deepseekApiToken: '',
  cloudflareApiToken: '',
  cloudflaredPath: '',
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

export function ProfileSettingsPage() {
  const { user, updateDisplayName } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const usernameFallback = user?.email?.split('@')[0] ?? '';
  const { prefs, patch: patchPrefs } = useAccountLocalPrefs(user?.uid, usernameFallback);
  const location = useQuery({ queryKey: ['data-location'], queryFn: getDataLocation });
  const settings = useQuery({ queryKey: ['launcher', 'settings'], queryFn: settingsGet });
  const activityLog = useQuery({ queryKey: ['activity-log-path'], queryFn: logPath });

  const [name, setName] = useState(user?.displayName ?? '');
  const [dataPath, setDataPath] = useState('');
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [update, setUpdate] = useState<UpdateStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [folderAlert, setFolderAlert] = useState<string | null>(null);

  function showFolderError(err: unknown) {
    const message = launcherError(err);
    setFolderAlert(message);
    setError(null);
  }

  function patchDraft(partial: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  useEffect(() => {
    setName(user?.displayName ?? '');
  }, [user?.displayName]);

  useEffect(() => {
    if (location.data) setDataPath(location.data.current);
  }, [location.data]);

  useEffect(() => {
    if (!settings.data) return;
    const { dataDir: _dataDir, appVersion: _appVersion, ...rest } = settings.data;
    setDraft(rest);
  }, [settings.data]);

  const cloudflareDirty = Boolean(
    settings.data &&
      (draft.cloudflareApiToken.trim() !== (settings.data.cloudflareApiToken ?? '').trim() ||
        draft.cloudflaredPath.trim() !== (settings.data.cloudflaredPath ?? '').trim()),
  );

  async function saveDeepseek(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await settingsSave({ ...draft, deepseekApiToken: draft.deepseekApiToken.trim() });
      await queryClient.invalidateQueries({ queryKey: ['launcher', 'settings'] });
      toast.success('Token DeepSeek salvo.');
    } catch (err) {
      setError(launcherError(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveCloudflare(event: React.FormEvent) {
    event.preventDefault();
    if (!cloudflareDirty) return;
    setBusy(true);
    setError(null);
    try {
      await settingsSave({
        ...draft,
        cloudflareApiToken: draft.cloudflareApiToken.trim(),
        cloudflaredPath: draft.cloudflaredPath.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ['launcher', 'settings'] });
      toast.success('Definições Cloudflare salvas.');
    } catch (err) {
      setError(launcherError(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveLauncher(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await settingsSave(draft);
      await queryClient.invalidateQueries({ queryKey: ['launcher'] });
      toast.success('Definições salvas.');
    } catch (err) {
      setError(launcherError(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await updateDisplayName(name);
      toast.success('Perfil actualizado.');
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveLocation(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await setDataLocation(dataPath);
      setDataPath(result.current);
      await queryClient.invalidateQueries({ queryKey: ['data-location'] });
      toast.success(`Pasta das apps: ${result.current}`);
    } catch (err) {
      showFolderError(err);
    } finally {
      setBusy(false);
    }
  }

  async function pickFolder() {
    setError(null);
    try {
      const selected = await openDialog({
        directory: true,
        multiple: false,
        title: 'Escolher pasta das aplicações (tem de estar vazia)',
        defaultPath: dataPath || location.data?.current || location.data?.default,
      });
      if (typeof selected === 'string' && selected) {
        try {
          await setDataLocation(selected);
          setDataPath(selected);
          await queryClient.invalidateQueries({ queryKey: ['data-location'] });
          toast.success(`Pasta das apps: ${selected}`);
        } catch (err) {
          showFolderError(err);
        }
      }
    } catch (err) {
      showFolderError(err);
    }
  }

  const subtitle = settings.data
    ? `Conta e preferências do painel · Dados em ${settings.data.dataDir} · Painel ${settings.data.appVersion}`
    : 'Conta, DeepSeek, pasta das apps e preferências do painel.';

  return (
    <PageShell>
      <PageShell.Heading subtitle={subtitle}>Configurações do perfil</PageShell.Heading>
      {error ? <InlineAlert>{error}</InlineAlert> : null}

      <FormCard onSubmit={(event) => void saveProfile(event)} aria-label="Conta">
        <FormCard.Header title="Conta" subtitle="Dados do utilizador." />
        <FormRow label="Nome">
          <Input value={name} onChange={(event) => setName(event.target.value)} required />
        </FormRow>
        <FormRow label="E-mail">
          <Input value={user?.email ?? ''} readOnly />
        </FormRow>
        <FormRow label="Username">
          <Input value={prefs.username} onChange={(event) => patchPrefs({ username: event.target.value })} />
        </FormRow>
        <FormCard.Footer right={<Button type="submit" variant="secondary" disabled={busy}>Salvar perfil</Button>} />
      </FormCard>

      <FormCard onSubmit={(event) => void saveDeepseek(event)} aria-label="DeepSeek" style={{ marginTop: 20 }}>
        <FormCard.Header
          title="DeepSeek"
          subtitle="Token para o agente criar/actualizar o Launchfile ao estudar o repositório no cliente."
        />
        <FormRow label="Token da API">
          <Input
            type="password"
            value={draft.deepseekApiToken}
            onChange={(event) => patchDraft({ deepseekApiToken: event.target.value })}
            placeholder="sk-…"
            autoComplete="off"
          />
          <FormCard.Hint>
            Sem token, o arranque bloqueia se a app ainda não tiver Launchfile. Obtenha a chave em platform.deepseek.com.
          </FormCard.Hint>
        </FormRow>
        <FormCard.Footer
          right={
            <Button type="submit" variant="secondary" disabled={busy || settings.isLoading}>
              Salvar token
            </Button>
          }
        />
      </FormCard>

      <FormCard onSubmit={(event) => void saveCloudflare(event)} aria-label="Cloudflare" style={{ marginTop: 20 }}>
        <FormCard.Header
          title="Cloudflare"
          subtitle="Credenciais globais desta organização — usadas por todas as apps. Modo Quick/DNS e hostname escolhem-se em cada app."
        />
        <FormRow label="Token da API">
          <Input
            type="password"
            value={draft.cloudflareApiToken}
            onChange={(event) => patchDraft({ cloudflareApiToken: event.target.value })}
            placeholder="Cloudflare API token…"
            autoComplete="off"
          />
          <FormCard.Hint>
            Custom Token em{' '}
            <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noreferrer">
              dash.cloudflare.com/profile/api-tokens
            </a>
            : <strong>Account → Cloudflare Tunnel → Edit</strong>, <strong>Zone → DNS → Edit</strong>,{' '}
            <strong>Zone → Zone → Read</strong>. Quick (trycloudflare) não precisa de token; Domínio sim.
          </FormCard.Hint>
        </FormRow>
        <FormRow label="Caminho cloudflared">
          <Input
            value={draft.cloudflaredPath}
            onChange={(event) => patchDraft({ cloudflaredPath: event.target.value })}
            placeholder="Vazio = detectar automaticamente (where/which)"
          />
          <FormCard.Hint>
            Binário do agente de túnel. Se vazio, o Painel tenta <code>where cloudflared</code> (Windows) ou pastas
            comuns. Necessário para Quick e Domínio.
          </FormCard.Hint>
        </FormRow>
        <FormCard.Footer
          right={
            cloudflareDirty ? (
              <Button type="submit" variant="secondary" disabled={busy || settings.isLoading}>
                Salvar Cloudflare
              </Button>
            ) : null
          }
        />
      </FormCard>

      <FormCard onSubmit={(event) => void saveLocation(event)} aria-label="Pasta das aplicações" style={{ marginTop: 20 }}>
        <FormCard.Header
          title="Pasta das aplicações"
          subtitle="Só onde ficam as apps ({org}/{app}/repositories/…). Conta, organizações e biblioteca continuam no AppData."
        />
        <FormRow label="Caminho">
          <Input
            value={dataPath}
            onChange={(event) => setDataPath(event.target.value)}
            placeholder={location.data?.default}
            rightIcon={<IconFolder size={16} aria-hidden="true" />}
            rightIconLabel="Escolher pasta"
            onRightIconClick={() => void pickFolder()}
          />
          <FormCard.Hint>
            A pasta tem de estar vazia. Predefinida: {location.data?.default ?? '…'}. Estrutura:{' '}
            {'{pasta}/{orgSlug}/{appFolder}/repositories/{repo}/'}. Conta e orgs ficam no AppData.
          </FormCard.Hint>
        </FormRow>
        <FormCard.Footer
          right={
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  setDataPath('');
                  void setDataLocation('')
                    .then(async (result) => {
                      await queryClient.invalidateQueries({ queryKey: ['data-location'] });
                      setDataPath(result.current);
                      toast.success(`Apps na pasta predefinida: ${result.current}`);
                    })
                    .catch((err) => showFolderError(err));
                }}
              >
                Usar predefinida (AppData)
              </Button>
              <Button type="submit" variant="secondary" disabled={busy}>
                Salvar pasta
              </Button>
            </div>
          }
        />
      </FormCard>

      <FormCard aria-label="Log de actividade" style={{ marginTop: 20 }}>
        <FormCard.Header
          title="Log de actividade"
          subtitle="Navegações, Lançar/Parar, force de porta e erros com stack — útil para diagnosticar falhas."
        />
        <FormRow label="Ficheiro">
          <Input value={activityLog.data ?? 'A carregar…'} readOnly />
          <FormCard.Hint>Ficheiro: painel.log (roda automaticamente ~5 MB).</FormCard.Hint>
        </FormRow>
        <FormCard.Footer
          right={
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() =>
                void logOpenFolder()
                  .then((dir) => toast.success(`Pasta aberta: ${dir}`))
                  .catch((err) => toast.error(launcherError(err)))
              }
            >
              Abrir pasta dos logs
            </Button>
          }
        />
      </FormCard>

      <FormCard onSubmit={(event) => void saveLauncher(event)} aria-label="Definições do painel" style={{ marginTop: 20 }}>
        <FormCard.Header title="Geral" subtitle="Plataforma e vista da biblioteca." />
        <FormRow label="Plataforma">
          <Select
            aria-label="Plataforma"
            value={draft.platform}
            onChange={(value) => patchDraft({ platform: value })}
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
            onChange={(value) => patchDraft({ sortBy: value })}
            options={[
              { value: 'LastPlayed', label: 'Último uso' },
              { value: 'Name', label: 'Nome' },
              { value: 'NameDesc', label: 'Nome inverso' },
              { value: 'Installed', label: 'Instaladas primeiro' },
              { value: 'NotInstalled', label: 'Por instalar primeiro' },
            ]}
          />
        </FormRow>
        <PreferenceToggleRow
          title="Grelha"
          description="Desligado, a biblioteca fica em lista."
          checked={draft.useGridView}
          onChange={(useGridView) => patchDraft({ useGridView })}
        />
        <PreferenceToggleRow
          title="Ecrã cheio ao abrir"
          checked={draft.startFullscreen}
          onChange={(startFullscreen) => patchDraft({ startFullscreen })}
        />

        <FormCard.Header title="GitHub" subtitle="Token e repositórios remotos." />
        <FormRow label="Token">
          <Input
            type="password"
            value={draft.githubApiToken}
            onChange={(event) => patchDraft({ githubApiToken: event.target.value })}
          />
          <FormCard.Hint>Token clássico, sem permissões. Serve para passar das 60 consultas anónimas por hora.</FormCard.Hint>
        </FormRow>
        <FormRow label="Catálogo">
          <Input
            value={draft.appListRepository}
            onChange={(event) => patchDraft({ appListRepository: event.target.value })}
          />
        </FormRow>
        <FormRow label="Atualização">
          <Input
            value={draft.painelUpdateRepository}
            onChange={(event) => patchDraft({ painelUpdateRepository: event.target.value })}
          />
          <FormCard.Hint>Vazio desliga a atualização. Não use o repositório Avalonia do GithubLauncher.</FormCard.Hint>
        </FormRow>
        <FormRow label="Versão" alignStart>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {update ? (
              <InlineAlert variant={update.updateAvailable ? 'warning' : 'info'}>{update.message}</InlineAlert>
            ) : null}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button
                type="button"
                onClick={() =>
                  void launcherCheckUpdate(true)
                    .then(setUpdate)
                    .catch((err) => toast.error(launcherError(err)))
                }
              >
                Procurar atualização
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!update?.updateAvailable}
                onClick={() => void launcherApplyUpdate().catch((err) => toast.error(launcherError(err)))}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </FormRow>

        <FormCard.Header title="Aparência" subtitle="Fundo e música do launcher." />
        <FormRow label="Imagem de fundo">
          <Input
            value={draft.backgroundImagePath}
            onChange={(event) => patchDraft({ backgroundImagePath: event.target.value })}
          />
        </FormRow>
        <FormRow label="Opacidade">
          <Slider
            aria-label="Opacidade do fundo"
            min={0}
            max={100}
            value={Math.round(draft.backgroundOpacity * 100)}
            onChange={(value) => patchDraft({ backgroundOpacity: value / 100 })}
          />
        </FormRow>
        <FormRow label="Música">
          <Input
            value={draft.launcherMusicPath}
            onChange={(event) => patchDraft({ launcherMusicPath: event.target.value })}
          />
        </FormRow>
        <FormRow label="Volume">
          <Slider
            aria-label="Volume"
            min={0}
            max={100}
            value={Math.round(draft.musicVolume * 100)}
            onChange={(value) => patchDraft({ musicVolume: value / 100 })}
          />
        </FormRow>

        <FormCard.Header title="Lançamento" subtitle="Comportamento ao abrir apps." />
        <PreferenceToggleRow
          title="Fechar depois de lançar"
          checked={draft.closeAfterLaunch}
          onChange={(closeAfterLaunch) => patchDraft({ closeAfterLaunch })}
        />
        <PreferenceToggleRow
          title="Comando"
          description="Setas, Espaço e gamepad movem o foco na biblioteca."
          checked={draft.enableGamepadInput}
          onChange={(enableGamepadInput) => patchDraft({ enableGamepadInput })}
        />
        <FormCard.Footer
          right={
            <Button type="submit" variant="secondary" disabled={busy || settings.isLoading}>
              Salvar definições
            </Button>
          }
        />
      </FormCard>

      <Modal
        isOpen={Boolean(folderAlert)}
        onClose={() => setFolderAlert(null)}
        title="Pasta inválida"
        icon={<IconAlertTriangle size={18} aria-hidden="true" />}
        leftBorderColor="var(--status-amber)"
        maxWidth={440}
      >
        <Modal.Content>
          <Modal.Text>{folderAlert}</Modal.Text>
        </Modal.Content>
        <Modal.Footer>
          <Button type="button" variant="secondary" onClick={() => setFolderAlert(null)}>
            Entendi
          </Button>
        </Modal.Footer>
      </Modal>
    </PageShell>
  );
}

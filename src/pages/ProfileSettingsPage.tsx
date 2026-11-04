import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
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
  launcherError,
  setDataLocation,
  settingsGet,
  settingsSave,
  type PublicSettings,
  type ServiceAccount,
} from '@/lib/launcher-api';
import { logOpenFolder, logPath } from '@/lib/activity-log';
import { AccountForm, AccountLibrary, accountTitle, GithubVersionRow, type AccountLibraryExtra } from '@/components/settings/AccountLibrary';
import libraryStyles from './library.module.css';

type Draft = Omit<PublicSettings, 'dataDir' | 'appVersion'>;

const EMPTY: Draft = {
  appsPath: '',
  githubApiToken: '',
  githubAccounts: [],
  deepseekApiToken: '',
  cloudflareApiToken: '',
  cloudflareAccounts: [],
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
  appListAccountName: '',
  appListApiToken: '',
};

function firstToken(accounts: ServiceAccount[] | undefined) {
  return (accounts ?? []).find((account) => account.token.trim())?.token.trim() ?? '';
}

function githubCatalogExtra(draft: Draft): AccountLibraryExtra {
  const repository = draft.appListRepository.trim();
  const name = draft.appListAccountName.trim();
  return {
    id: 'catalog',
    title: 'Catálogo',
    subtitle: [name, repository].filter(Boolean).join(' · ') || 'Sem repositório',
    badge: repository ? 'Configurado' : 'Sem repositório',
    tone: repository ? 'success' : 'muted',
    href: '/settings/github/catalog',
  };
}

const GITHUB_HINT =
  'Token em github.com/settings/tokens. Repositório privado pede o âmbito repo. Sem âmbito, a lista pública e o limite de pedidos continuam a funcionar.';
const CLOUDFLARE_HINT =
  'Custom Token em dash.cloudflare.com/profile/api-tokens: Account → Cloudflare Tunnel → Edit, Zone → DNS → Edit e Zone → Zone → Read. Quick não precisa de token.';

export function ProfileSettingsPage() {
  const { pathname } = useLocation();
  const { accountId } = useParams();
  const navigate = useNavigate();
  const section = pathname.startsWith('/settings/cloudflare')
    ? 'cloudflare'
    : pathname.startsWith('/settings/github')
      ? 'github'
      : 'geral';
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
    setDraft({
      ...rest,
      githubAccounts: rest.githubAccounts ?? [],
      cloudflareAccounts: rest.cloudflareAccounts ?? [],
      appListAccountName: rest.appListAccountName ?? '',
      appListApiToken: rest.appListApiToken ?? '',
    });
  }, [settings.data]);

  const deepseekDirty = Boolean(
    settings.data && draft.deepseekApiToken.trim() !== (settings.data.deepseekApiToken ?? '').trim(),
  );
  const profileDirty = name.trim() !== (user?.displayName ?? '').trim();
  const locationDirty = Boolean(location.data && dataPath.trim() !== location.data.current.trim());
  const launcherDirty = Boolean(
    settings.data &&
      (draft.platform !== settings.data.platform ||
        draft.sortBy !== settings.data.sortBy ||
        draft.useGridView !== settings.data.useGridView ||
        draft.startFullscreen !== settings.data.startFullscreen ||
        draft.backgroundImagePath.trim() !== (settings.data.backgroundImagePath ?? '').trim() ||
        Math.abs(draft.backgroundOpacity - settings.data.backgroundOpacity) > 0.0001 ||
        draft.launcherMusicPath.trim() !== (settings.data.launcherMusicPath ?? '').trim() ||
        Math.abs(draft.musicVolume - settings.data.musicVolume) > 0.0001 ||
        draft.closeAfterLaunch !== settings.data.closeAfterLaunch ||
        draft.enableGamepadInput !== settings.data.enableGamepadInput),
  );
  const githubDirty = Boolean(
    settings.data &&
      (draft.appListAccountName.trim() !== (settings.data.appListAccountName ?? '').trim() ||
        draft.appListApiToken.trim() !== (settings.data.appListApiToken ?? '').trim() ||
        draft.appListRepository.trim() !== (settings.data.appListRepository ?? '').trim() ||
        draft.painelUpdateRepository.trim() !== (settings.data.painelUpdateRepository ?? '').trim()),
  );

  async function saveDeepseek(event: React.FormEvent) {
    event.preventDefault();
    if (!deepseekDirty) return;
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

  async function commitAccounts(kind: 'github' | 'cloudflare', accounts: ServiceAccount[], message: string) {
    const current = settings.data;
    if (!current) return false;
    const { dataDir: _dataDir, appVersion: _appVersion, ...rest } = current;
    const cleaned = accounts
      .map((account) => ({
        id: account.id,
        label: account.label.trim(),
        token: account.token.trim(),
        updateRepository: (account.updateRepository ?? '').trim(),
      }))
      .filter((account) => account.token);
    setBusy(true);
    setError(null);
    try {
      await settingsSave(
        kind === 'github'
          ? { ...rest, githubAccounts: cleaned, githubApiToken: firstToken(cleaned) }
          : { ...rest, cloudflareAccounts: cleaned, cloudflareApiToken: firstToken(cleaned) },
      );
      await queryClient.invalidateQueries({ queryKey: ['launcher', 'settings'] });
      toast.success(message);
      return true;
    } catch (err) {
      setError(launcherError(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function saveLauncher(event: React.FormEvent) {
    event.preventDefault();
    if (!launcherDirty) return;
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

  async function saveGithub(event: React.FormEvent) {
    event.preventDefault();
    if (!githubDirty || !settings.data) return;
    setBusy(true);
    setError(null);
    try {
      const accounts = settings.data.githubAccounts ?? [];
      await settingsSave({
        ...draft,
        githubAccounts: accounts,
        githubApiToken: firstToken(accounts),
        appListAccountName: draft.appListAccountName.trim(),
        appListApiToken: draft.appListApiToken.trim(),
        appListRepository: draft.appListRepository.trim(),
        painelUpdateRepository: draft.painelUpdateRepository.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ['launcher', 'settings'] });
      toast.success('Definições GitHub salvas.');
    } catch (err) {
      setError(launcherError(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!profileDirty) return;
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
    if (!locationDirty) return;
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

  const subtitle =
    section === 'geral'
      ? settings.data
        ? `Dados em ${settings.data.dataDir} · Painel ${settings.data.appVersion}`
        : 'Conta, DeepSeek, pasta das apps e preferências do painel.'
      : undefined;
  const title = section === 'cloudflare' ? 'Cloudflare' : section === 'github' ? 'GitHub' : 'Geral';
  const serviceKind = section === 'github' || section === 'cloudflare' ? section : null;
  const savedAccounts =
    serviceKind === 'github'
      ? (settings.data?.githubAccounts ?? [])
      : serviceKind === 'cloudflare'
        ? (settings.data?.cloudflareAccounts ?? [])
        : [];
  const basePath = serviceKind === 'github' ? '/settings/github' : '/settings/cloudflare';

  if (accountId === 'catalog' && serviceKind === 'github') {
    return (
      <PageShell>
        <PageShell.Heading subtitle="GitHub">Catálogo</PageShell.Heading>
        {error ? <InlineAlert>{error}</InlineAlert> : null}
        <FormCard onSubmit={(event) => void saveGithub(event)} aria-label="Catálogo e atualização">
          <FormCard.Header
            title="Catálogo e atualização"
            subtitle="A Nova app lista os repositórios de todas as contas."
          />
          <FormRow label="Nome da conta">
            <Input
              value={draft.appListAccountName}
              onChange={(event) => patchDraft({ appListAccountName: event.target.value })}
              placeholder="Trabalho"
            />
          </FormRow>
          <FormRow label="Token">
            <Input
              type="password"
              value={draft.appListApiToken}
              onChange={(event) => patchDraft({ appListApiToken: event.target.value })}
              autoComplete="off"
            />
            <FormCard.Hint>O nome aparece na lista. O token fica só nesta conta.</FormCard.Hint>
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
          <GithubVersionRow repository={draft.painelUpdateRepository} />
          {githubDirty ? (
            <FormCard.Footer
              right={
                <Button type="submit" variant="secondary" disabled={busy || settings.isLoading}>
                  Salvar
                </Button>
              }
            />
          ) : null}
        </FormCard>
      </PageShell>
    );
  }

  if (accountId && serviceKind) {
    const isNew = accountId === 'new';
    const account = isNew ? undefined : savedAccounts.find((item) => item.id === accountId);
    const kindLabel = serviceKind === 'github' ? 'GitHub' : 'Cloudflare';
    return (
      <PageShell>
        <PageShell.Heading subtitle={kindLabel}>
          {isNew ? 'Nova conta' : account ? accountTitle(account, savedAccounts) : kindLabel}
        </PageShell.Heading>
        {error ? <InlineAlert>{error}</InlineAlert> : null}
        {!isNew && settings.isLoading ? <p className={libraryStyles.empty}>A carregar conta…</p> : null}
        {!isNew && !settings.isLoading && !account ? (
          <p className={libraryStyles.empty}>Esta conta já não está nas definições.</p>
        ) : null}
        {isNew || account ? (
          <AccountForm
            key={isNew ? 'new' : account?.id}
            mode={isNew ? 'new' : 'edit'}
            account={account}
            hint={serviceKind === 'github' ? GITHUB_HINT : CLOUDFLARE_HINT}
            githubExtras={serviceKind === 'github'}
            busy={busy || settings.isLoading}
            onSubmit={(next) => {
              const list = isNew ? [...savedAccounts, next] : savedAccounts.map((item) => (item.id === next.id ? next : item));
              void commitAccounts(serviceKind, list, isNew ? 'Conta adicionada.' : 'Conta salva.').then((ok) => {
                if (ok && isNew) navigate(basePath);
              });
            }}
            onRemove={
              account
                ? () => {
                    void commitAccounts(
                      serviceKind,
                      savedAccounts.filter((item) => item.id !== account.id),
                      'Conta removida.',
                    ).then((ok) => {
                      if (ok) navigate(basePath);
                    });
                  }
                : undefined
            }
          />
        ) : null}
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageShell.Heading subtitle={subtitle}>{title}</PageShell.Heading>
      {error ? <InlineAlert>{error}</InlineAlert> : null}

      {section === 'geral' ? (
      <>
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
        {profileDirty ? (
          <FormCard.Footer right={<Button type="submit" variant="secondary" disabled={busy}>Salvar</Button>} />
        ) : null}
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
        {deepseekDirty ? (
          <FormCard.Footer
            right={
              <Button type="submit" variant="secondary" disabled={busy || settings.isLoading}>
                Salvar
              </Button>
            }
          />
        ) : null}
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
              {locationDirty ? (
                <Button type="submit" variant="secondary" disabled={busy}>
                  Salvar
                </Button>
              ) : null}
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
        {launcherDirty ? (
          <FormCard.Footer
            right={
              <Button type="submit" variant="secondary" disabled={busy || settings.isLoading}>
                Salvar
              </Button>
            }
          />
        ) : null}
      </FormCard>
      </>
      ) : null}

      {section === 'cloudflare' ? (
        <>
          <AccountLibrary
            accounts={savedAccounts}
            loading={settings.isLoading && savedAccounts.length === 0}
            basePath="/settings/cloudflare"
            emptyMessage="Nenhuma conta Cloudflare. Adicione uma para listar domínios."
            onRemove={(account) => {
              void commitAccounts(
                'cloudflare',
                savedAccounts.filter((item) => item.id !== account.id),
                'Conta removida.',
              );
            }}
          />
        </>
      ) : null}

      {section === 'github' ? (
        <AccountLibrary
          accounts={savedAccounts}
          extras={[githubCatalogExtra(draft)]}
          loading={settings.isLoading && savedAccounts.length === 0}
          basePath="/settings/github"
          emptyMessage="Nenhuma conta GitHub. Adicione uma para listar repositórios."
          onRemove={(account) => {
            void commitAccounts(
              'github',
              savedAccounts.filter((item) => item.id !== account.id),
              'Conta removida.',
            );
          }}
        />
      ) : null}

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

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { openUrl } from '@tauri-apps/plugin-opener';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { IconCopy, IconDownload, IconExternalLink, IconFolder, IconPhoto, IconX } from '@tabler/icons-react';
import { PageShell } from '@/components/ui/PageShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Checkbox } from '@/components/ui/Checkbox';
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Modal } from '@/components/ui/Modal';
import { DangerZone } from '@/components/ui/DangerZone';
import { FormCard, FormRow } from '@/components/ui/FormCard';
import { Textarea } from '@/components/ui/Textarea';
import { GridView } from '@/components/ui/GridView';
import { ViewToolbar } from '@/components/ui/ViewToolbar';
import { DataTable, type TableColumn } from '@/components/ui/DataTable';
import { RowActions } from '@/components/ui/RowActions';
import { ItemCard, gridCardStyles as gc } from '@/components/ui/ItemCard';
import { useToast } from '@/components/ui/Toast';
import { appIconSrc, appId, ChoiceList, useLibraryMutations } from '@/components/launcher/LibraryCard';
import { AppProgressBar } from '@/components/launcher/AppProgressBar';
import { useListingView } from '@/components/launcher/useListingView';
import { formatDate } from '@/utils';
import {
  appChangelog,
  appClearIcon,
  appCloudflareGet,
  appCloudflareSave,
  appCloudflareStart,
  appCloudflareStatus,
  appCloudflareStop,
  appDeleteInstall,
  appDetail,
  appGenerateLaunchfile,
  appLaunchConfigGet,
  appLaunchConfigSave,
  appReleases,
  appSetIcon,
  appShortcutDesktop,
  appShortcutSteam,
  launcherError,
  libraryRemove,
  librarySave,
  settingsGet,
  settingsSave,
  statusLabel,
  type AppView,
  type CloudflareMode,
  type LaunchField,
  type ReleaseInfo,
} from '@/lib/launcher-api';
import { useAppProgressStore } from '@/stores/app-progress';
import { useOrg } from '@/contexts/OrgContext';
import { PreferenceToggleRow } from '@/components/ui/PreferenceToggleRow';
import { Select } from '@/components/ui/Select';
import styles from './library.module.css';

function publishedLabel(value: string) {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return value || '—';
  return formatDate(value);
}

function releaseState(app: AppView, tag: string): { label: string; tone: StatusTone } {
  if (app.installedVersion && app.installedVersion === tag) return { label: 'Instalada', tone: 'success' };
  if (app.skippedUpdateVersion && app.skippedUpdateVersion === tag) return { label: 'A saltar', tone: 'warning' };
  return { label: 'Disponível', tone: 'muted' };
}

export function AppPage() {
  const navigate = useNavigate();
  const params = useParams();
  const { activeOrg } = useOrg();
  const section = params.section ?? '';
  const appKey = params.folder
    ? decodeURIComponent(params.folder)
    : `${params.owner}/${params.repo}`;
  const detail = useQuery({
    queryKey: ['launcher', 'app', activeOrg?.id, appKey],
    queryFn: () => appDetail(appKey),
    enabled: Boolean(activeOrg?.id),
  });
  const app = detail.data;

  useEffect(() => {
    if (!activeOrg?.id) return;
    if (detail.isLoading || detail.isFetching) return;
    if (!app) navigate('/', { replace: true });
  }, [activeOrg?.id, app, detail.isFetching, detail.isLoading, navigate]);

  if (detail.isLoading || !activeOrg?.id) {
    return (
      <PageShell>
        <p className={styles.meta}>A carregar…</p>
      </PageShell>
    );
  }
  if (!app) {
    return (
      <PageShell>
        <p className={styles.meta}>A redirecionar…</p>
      </PageShell>
    );
  }
  if (section === 'versions') return <Versions app={app} />;
  if (section === 'executable') return <Executable app={app} />;
  if (section === 'shortcuts') return <Shortcuts app={app} />;
  if (section === 'cloudflare') return <CloudflareTunnel app={app} />;
  if (section === 'changelog') return <Changelog app={app} />;
  if (section === 'settings') return <AppSettings app={app} />;
  return <Overview app={app} />;
}

function Overview({ app }: { app: AppView }) {
  const actions = useLibraryMutations();
  const queryClient = useQueryClient();
  const progress = useAppProgressStore((s) => s.byId[appId(app)]);
  const [choice, setChoice] = useState<string[] | null>(null);
  const [confirmWine, setConfirmWine] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const iconSrc = appIconSrc(app);
  const initial = (app.name.trim().charAt(0) || '?').toUpperCase();

  async function primary(assetName?: string, wine = false) {
    if (app.status === 'installed' && !assetName) {
      const result = await actions.launch(app);
      if (result?.needsChoice) setChoice(result.executables);
      return;
    }
    const result = await actions.install(app, { assetName, confirmWine: wine });
    if (!result) return;
    setWarning(result.warning ?? null);
    setConfirmWine(result.needsConfirm);
    setChoice(result.needsChoice || result.needsConfirm ? result.assets : null);
    await queryClient.invalidateQueries({ queryKey: ['launcher', 'app', appId(app)] });
  }

  const stats: { label: string; value: string; mono?: boolean }[] = [
    { label: 'Versão instalada', value: app.installedVersion || '—' },
    { label: 'Versão remota', value: app.remoteVersion || '—' },
    { label: 'Último uso', value: app.lastPlayed || 'Nunca' },
    { label: 'Executável', value: app.selectedExecutable || 'Launchfile', mono: true },
  ];

  return (
    <PageShell>
      <header className={styles.overviewHero}>
        {iconSrc ? (
          <img className={styles.overviewIcon} src={iconSrc} alt="" />
        ) : (
          <div className={styles.overviewIconFallback} aria-hidden="true">
            {initial}
          </div>
        )}
        <div className={styles.overviewHeroText}>
          <h1 className={styles.overviewTitle}>{app.name}</h1>
          <p className={styles.overviewRepo}>{app.repository}</p>
          <div className={styles.overviewBadges}>
            <StatusBadge
              label={statusLabel(app.status)}
              tone={app.status === 'update' ? 'warning' : app.status === 'installed' ? 'success' : 'muted'}
            />
            {app.running ? <StatusBadge label="Em execução" tone="success" /> : <StatusBadge label="Parada" tone="muted" />}
            {app.manuallyHidden ? <StatusBadge label="Oculta" tone="warning" /> : null}
          </div>
        </div>
      </header>

      {progress ? <AppProgressBar progress={progress} /> : null}

      <div className={styles.overviewStats} role="list" aria-label="Indicadores">
        {stats.map((stat) => (
          <div key={stat.label} className={styles.overviewStat} role="listitem">
            <p className={styles.overviewStatLabel}>{stat.label}</p>
            <p className={stat.mono ? `${styles.overviewStatValue} ${styles.overviewStatValueMono}` : styles.overviewStatValue}>
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {app.running ? (
        <section className={styles.overviewPanel} aria-label="Processo em execução">
          <h2 className={styles.overviewPanelTitle}>Agora a correr</h2>
          <div className={styles.overviewRunning}>
            <p className={styles.overviewRunningLine}>
              <strong>Gestor de tarefas</strong>
              {' · '}
              <span className={styles.overviewStatValueMono}>{app.runningProcessName || '—'}</span>
            </p>
            <p className={styles.overviewRunningLine}>
              <strong>PID</strong>
              {' · '}
              {app.runningPid != null ? app.runningPid : '—'}
            </p>
            {app.openUrl ? (
              <p className={styles.overviewRunningLine}>
                <strong>URL</strong>
                {' · '}
                {app.openUrl}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {app.installPath ? (
        <section className={styles.overviewPanel} aria-label="Localização">
          <h2 className={styles.overviewPanelTitle}>No disco</h2>
          <p className={`${styles.overviewRunningLine} ${styles.overviewStatValueMono}`}>{app.installPath}</p>
        </section>
      ) : null}

      <Modal isOpen={Boolean(choice)} onClose={() => setChoice(null)} title={confirmWine ? 'Confirmar instalação' : 'Escolher ficheiro'}>
        <Modal.Content>
          {warning ? <InlineAlert variant="warning">{warning}</InlineAlert> : null}
          <ChoiceList
            options={choice ?? []}
            onPick={(asset) => {
              setChoice(null);
              void primary(asset, true);
            }}
          />
        </Modal.Content>
      </Modal>
    </PageShell>
  );
}

function iconFileName(path: string | null | undefined) {
  if (!path) return '';
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

function CloudflareTunnel({ app }: { app: AppView }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { activeOrg } = useOrg();
  const id = appId(app);
  const queryKey = ['launcher', 'cloudflare', activeOrg?.id, id] as const;
  const detail = useQuery({
    queryKey,
    queryFn: () => appCloudflareGet(id),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data?.running) return false;
      // Enquanto corre sem URL, poll rápido para mostrar o link trycloudflare.
      return data.publicUrl ? 4000 : 1000;
    },
    enabled: Boolean(activeOrg?.id),
  });
  const settings = useQuery({
    queryKey: ['launcher', 'settings', activeOrg?.id],
    queryFn: settingsGet,
    enabled: Boolean(activeOrg?.id),
  });
  const view = detail.data;
  const [mode, setMode] = useState<CloudflareMode>('quick');
  const [startWithApp, setStartWithApp] = useState(false);
  const [hostname, setHostname] = useState('');
  const [tunnelName, setTunnelName] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [cloudflaredPath, setCloudflaredPath] = useState('');
  const [busy, setBusy] = useState(false);
  const synced = useRef(false);
  const settingsSynced = useRef(false);

  useEffect(() => {
    synced.current = false;
    settingsSynced.current = false;
  }, [id]);

  useEffect(() => {
    if (!view || synced.current) return;
    synced.current = true;
    setMode(view.config.mode);
    setStartWithApp(Boolean(view.config.startWithApp));
    setHostname(view.config.hostname ?? '');
    setTunnelName(view.config.tunnelName ?? '');
  }, [view]);

  useEffect(() => {
    if (!settings.data || settingsSynced.current) return;
    settingsSynced.current = true;
    setApiToken(settings.data.cloudflareApiToken ?? '');
    const savedPath = settings.data.cloudflaredPath?.trim() ?? '';
    setCloudflaredPath(savedPath);
  }, [settings.data]);

  // Preencher caminho detectado se o campo estiver vazio.
  useEffect(() => {
    if (!view?.cloudflaredDetected) return;
    setCloudflaredPath((current) => current.trim() || view.cloudflaredDetected || '');
  }, [view?.cloudflaredDetected]);

  async function persistCredentials() {
    const current = settings.data;
    if (!current) return;
    const { dataDir: _d, appVersion: _v, ...rest } = current;
    await settingsSave({
      ...rest,
      cloudflareApiToken: apiToken.trim(),
      cloudflaredPath: cloudflaredPath.trim(),
    });
    await queryClient.invalidateQueries({ queryKey: ['launcher', 'settings'] });
    await detail.refetch();
  }

  async function persistConfig() {
    await appCloudflareSave(id, {
      mode,
      startWithApp,
      portOverride: null,
      hostname: hostname.trim() || null,
      tunnelName: tunnelName.trim() || null,
    });
  }

  async function save() {
    setBusy(true);
    try {
      await persistCredentials();
      await persistConfig();
      await detail.refetch();
      toast.success('Configuração Cloudflare guardada.');
    } catch (err) {
      toast.error(launcherError(err));
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    setBusy(true);
    try {
      await persistCredentials();
      await persistConfig();
      const next = await appCloudflareStart(id);
      await detail.refetch();
      if (next.publicUrl) {
        toast.success(`URL pública: ${next.publicUrl}`);
      } else {
        toast.success('Túnel a iniciar… a URL aparece assim que o Cloudflare a publicar.');
      }
    } catch (err) {
      toast.error(launcherError(err));
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    try {
      await appCloudflareStop(id);
      await queryClient.invalidateQueries({ queryKey: ['launcher', 'cloudflare'] });
      await detail.refetch();
      toast.success('Túnel parado. URL pública limpa.');
    } catch (err) {
      toast.error(launcherError(err));
    } finally {
      setBusy(false);
    }
  }

  async function refreshStatus() {
    try {
      await appCloudflareStatus(id);
      await detail.refetch();
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  // URL só conta enquanto o túnel corre — ao parar some do ecrã e do estado.
  const publicUrl = view?.running ? view.publicUrl?.trim() || '' : '';
  const appPort = view?.effectivePort;

  return (
    <PageShell>
      <PageShell.Heading subtitle="Expõe a porta da app (Launchfile) via túnel Cloudflare. A URL pública aparece aqui para acederes ao site.">
        Cloudflare
      </PageShell.Heading>

      <div style={{ marginTop: 12 }}>
        <InlineAlert variant="info">
          <strong>Quick</strong> (recomendado para testar): não precisa de token — só do programa{' '}
          <code>cloudflared</code>. Gera uma URL <code>*.trycloudflare.com</code>.
          <br />
          <strong>Domínio</strong>: precisa de token da API Cloudflare + hostname no teu domínio.
        </InlineAlert>
      </div>

      {!view?.cloudflaredAvailable ? (
        <InlineAlert variant="warning">
          cloudflared não encontrado. Instale-o (
          <a href="https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/" target="_blank" rel="noreferrer">
            instalação
          </a>
          ) ou indique o caminho completo abaixo.
        </InlineAlert>
      ) : null}

      {publicUrl ? (
        <FormCard aria-label="URL pública do túnel" style={{ marginTop: 16 }}>
          <FormCard.Header title="URL pública" subtitle="Acede ao site por este endereço Cloudflare." />
          <FormRow label="Link">
            <Input
              value={publicUrl}
              readOnly
              rightIcon={<IconCopy size={16} aria-hidden="true" />}
              rightIconLabel="Copiar URL"
              onRightIconClick={() => {
                void navigator.clipboard
                  .writeText(publicUrl)
                  .then(() => toast.success('URL copiada.'))
                  .catch(() => toast.error('Não foi possível copiar.'));
              }}
            />
          </FormRow>
          <FormCard.Footer
            right={
              <div className={styles.actions}>
                <Button
                  type="button"
                  variant="secondary"
                  leftIcon={<IconExternalLink size={14} />}
                  onClick={() => void openUrl(publicUrl).catch((err) => toast.error(launcherError(err)))}
                >
                  Abrir no browser
                </Button>
              </div>
            }
          />
        </FormCard>
      ) : null}

      <FormCard
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        aria-label="Credenciais Cloudflare"
        style={{ marginTop: 16 }}
      >
        <FormCard.Header
          title="Credenciais"
          subtitle="Guardadas nas definições da organização. Quick não exige token; Domínio sim."
        />
        <FormRow label="Token da API">
          <Input
            type="password"
            value={apiToken}
            onChange={(event) => setApiToken(event.target.value)}
            placeholder={mode === 'named' ? 'Obrigatório para Domínio…' : 'Opcional no modo Quick'}
            autoComplete="off"
          />
          <FormCard.Hint>
            Obter token:{' '}
            <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" rel="noreferrer">
              dash.cloudflare.com/profile/api-tokens
            </a>
            {' · '}
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() =>
                void openUrl('https://dash.cloudflare.com/profile/api-tokens').catch((err) =>
                  toast.error(launcherError(err)),
                )
              }
            >
              Abrir no browser
            </button>
            . Para Domínio: Create Token → permissões Account.Cloudflare Tunnel (Edit) + Zone.DNS (Edit).
          </FormCard.Hint>
        </FormRow>
        <FormRow label="Caminho cloudflared">
          <Input
            value={cloudflaredPath}
            onChange={(event) => setCloudflaredPath(event.target.value)}
            placeholder={
              view?.cloudflaredDetected
                ? view.cloudflaredDetected
                : view?.cloudflaredAvailable
                  ? view.cloudflaredPath
                  : 'Não encontrado — instale ou indique o .exe'
            }
          />
          <FormCard.Hint>
            {view?.cloudflaredDetected
              ? `Detectado automaticamente: ${view.cloudflaredDetected}`
              : view?.cloudflaredAvailable
                ? `A usar: ${view.cloudflaredPath}`
                : 'Não encontrado no PATH. Instale o cloudflared ou cole o caminho completo do executável.'}{' '}
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => {
                void detail.refetch().then((res) => {
                  const detected = res.data?.cloudflaredDetected || res.data?.cloudflaredPath;
                  if (res.data?.cloudflaredAvailable && detected) {
                    setCloudflaredPath(detected);
                    toast.success(`cloudflared encontrado: ${detected}`);
                  } else {
                    toast.error('cloudflared não encontrado. Instale-o e tente de novo.');
                  }
                });
              }}
            >
              Procurar de novo
            </button>
            {' · '}
            <a
              href="https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
              target="_blank"
              rel="noreferrer"
            >
              Como instalar
            </a>
          </FormCard.Hint>
        </FormRow>
        <FormCard.Footer
          right={
            <div className={styles.actions}>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  const detected = view?.cloudflaredDetected || (view?.cloudflaredAvailable ? view.cloudflaredPath : '');
                  if (detected) {
                    setCloudflaredPath(detected);
                    toast.success(`Caminho preenchido: ${detected}`);
                  } else {
                    void detail.refetch().then((res) => {
                      const path = res.data?.cloudflaredDetected || res.data?.cloudflaredPath;
                      if (res.data?.cloudflaredAvailable && path) {
                        setCloudflaredPath(path);
                        toast.success(`Caminho preenchido: ${path}`);
                      } else {
                        toast.error('cloudflared não encontrado.');
                      }
                    });
                  }
                }}
              >
                Usar detectado
              </Button>
              <Button type="submit" variant="secondary" disabled={busy || settings.isLoading}>
                Guardar credenciais
              </Button>
            </div>
          }
        />
      </FormCard>

      <FormCard
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        aria-label="Configuração do túnel"
        style={{ marginTop: 16 }}
      >
        <FormCard.Header title="Túnel" subtitle="Usa automaticamente a porta do Launchfile da app." />
        <FormRow label="Modo">
          <Select
            value={mode}
            onChange={(value) => setMode(value as CloudflareMode)}
            options={[
              { value: 'quick', label: 'Quick (*.trycloudflare.com) — sem token' },
              { value: 'named', label: 'Domínio Cloudflare — precisa de token' },
            ]}
          />
        </FormRow>
        <FormRow label="Porta da app">
          <Input value={appPort != null ? String(appPort) : '—'} readOnly disabled />
          <FormCard.Hint>
            {appPort != null
              ? `Mesma porta do Launchfile / app em execução (${appPort}).`
              : 'Sem porta no Launchfile — configure o Executável da app primeiro.'}
          </FormCard.Hint>
        </FormRow>
        {mode === 'named' ? (
          <>
            <FormRow label="Hostname">
              <Input
                value={hostname}
                onChange={(event) => setHostname(event.target.value)}
                placeholder="app.meudominio.com"
              />
            </FormRow>
            <FormRow label="Nome do túnel">
              <Input
                value={tunnelName}
                onChange={(event) => setTunnelName(event.target.value)}
                placeholder={`painel-${app.folderName || 'app'}`}
              />
              <FormCard.Hint>Opcional. Na primeira execução cria o túnel na conta Cloudflare.</FormCard.Hint>
            </FormRow>
          </>
        ) : null}
        <FormRow label="Com a app">
          <PreferenceToggleRow
            title="Iniciar com a app"
            description="Quando a app arranca, o túnel Cloudflare também é iniciado e a URL pública aparece aqui."
            checked={startWithApp}
            onChange={setStartWithApp}
          />
        </FormRow>
        <FormCard.Footer
          right={
            <Button type="submit" variant="secondary" disabled={busy || detail.isLoading}>
              Guardar
            </Button>
          }
        />
      </FormCard>

      <FormCard aria-label="Estado do túnel" style={{ marginTop: 20 }}>
        <FormCard.Header
          title="Estado"
          subtitle={
            view?.running
              ? publicUrl
                ? 'Túnel em execução'
                : 'Túnel a ligar… à espera da URL Cloudflare'
              : 'Túnel parado'
          }
        />
        <FormRow label="Estado">
          <StatusBadge
            label={view?.running ? (publicUrl ? 'Em execução' : 'A obter URL…') : 'Parado'}
            tone={view?.running ? 'success' : 'muted'}
          />
        </FormRow>
        {!publicUrl ? (
          <FormRow label="URL pública">
            <Input
              value=""
              readOnly
              placeholder={view?.running ? 'A aguardar URL do Cloudflare…' : 'Inicie o túnel para obter o link'}
            />
          </FormRow>
        ) : null}
        <FormCard.Footer
          right={
            <div className={styles.actions}>
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void refreshStatus()}>
                Actualizar
              </Button>
              {view?.running ? (
                <Button type="button" disabled={busy} onClick={() => void stop()}>
                  Parar
                </Button>
              ) : (
                <Button
                  type="button"
                  disabled={busy || !view?.cloudflaredAvailable || appPort == null}
                  onClick={() => void start()}
                >
                  Iniciar
                </Button>
              )}
            </div>
          }
        />
      </FormCard>
    </PageShell>
  );
}

function AppSettings({ app }: { app: AppView }) {
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const actions = useLibraryMutations();
  const [name, setName] = useState(app.name);
  const hasIcon = Boolean(app.iconPath);

  useEffect(() => {
    setName(app.name);
  }, [app.name]);

  async function saveEntry() {
    try {
      await librarySave({ ...app, name, folderName: app.folderName, appIconUrl: null }, appId(app));
      await queryClient.invalidateQueries({ queryKey: ['launcher'] });
      toast.success('Entrada actualizada.');
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  async function pickIcon() {
    try {
      const selected = await openDialog({
        multiple: false,
        title: 'Escolher ícone',
        filters: [{ name: 'Imagens', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'ico', 'svg', 'bmp'] }],
      });
      if (typeof selected !== 'string' || !selected) return;
      await appSetIcon(appId(app), selected);
      await queryClient.invalidateQueries({ queryKey: ['launcher'] });
      toast.success('Ícone guardado.');
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  async function removeIcon() {
    try {
      await appClearIcon(appId(app));
      await queryClient.invalidateQueries({ queryKey: ['launcher'] });
      toast.success('Ícone removido.');
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  return (
    <PageShell>
      <PageShell.Heading subtitle="Nome, pasta, ícone e gestão da entrada na biblioteca.">Configuração</PageShell.Heading>

      <div className={styles.actions}>
        <Button onClick={() => void actions.hide(app)}>{app.manuallyHidden ? 'Mostrar na biblioteca' : 'Ocultar na biblioteca'}</Button>
      </div>

      <FormCard
        onSubmit={(event) => {
          event.preventDefault();
          void saveEntry();
        }}
        aria-label="Entrada da app"
      >
        <FormCard.Header title="Entrada" subtitle="Dados gravados em apps.json." />
        <FormRow label="Nome">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </FormRow>
        <FormRow label="Repositório">
          <Input
            value={app.repository}
            readOnly
            disabled
            rightIcon={<IconCopy size={16} aria-hidden="true" />}
            rightIconLabel="Copiar repositório"
            onRightIconClick={() => {
              void navigator.clipboard
                .writeText(app.repository)
                .then(() => toast.success('Repositório copiado.'))
                .catch(() => toast.error('Não foi possível copiar.'));
            }}
          />
        </FormRow>
        <FormRow label="Ícone">
          <Input
            value={hasIcon ? iconFileName(app.iconPath) : ''}
            readOnly
            placeholder="Nenhum ícone"
            rightIcon={hasIcon ? <IconX size={16} aria-hidden="true" /> : <IconPhoto size={16} aria-hidden="true" />}
            rightIconLabel={hasIcon ? 'Remover ícone' : 'Escolher ficheiro'}
            onRightIconClick={() => void (hasIcon ? removeIcon() : pickIcon())}
          />
        </FormRow>
        <FormRow label="Pasta instalada">
          <Input
            value={app.installPath || ''}
            readOnly
            placeholder="Ainda sem pasta no disco"
            rightIcon={<IconFolder size={16} aria-hidden="true" />}
            rightIconLabel="Abrir pasta"
            onRightIconClick={() => void actions.openFolder(app)}
          />
        </FormRow>
        <FormCard.Footer right={<Button type="submit" variant="secondary">Guardar entrada</Button>} />
      </FormCard>

      <PageShell.Section className={styles.blockGap}>
        {app.status !== 'not_installed' ? (
          <DangerZone
            title="Apagar a instalação"
            description="Remove a pasta instalada e mantém a entrada na biblioteca."
            action={
              <Button
                variant="danger"
                onClick={() =>
                  void appDeleteInstall(appId(app))
                    .then(() => queryClient.invalidateQueries({ queryKey: ['launcher'] }))
                    .then(() => toast.success('Instalação apagada.'))
                    .catch((err) => toast.error(launcherError(err)))
                }
              >
                Apagar pasta
              </Button>
            }
          />
        ) : null}
        <DangerZone
          title="Remover da biblioteca"
          description="Tira a entrada de apps.json. A pasta instalada fica no disco."
          action={
            <Button
              variant="danger"
              onClick={() => void libraryRemove(appId(app)).then(() => navigate('/')).catch((err) => toast.error(launcherError(err)))}
            >
              Remover
            </Button>
          }
        />
      </PageShell.Section>
    </PageShell>
  );
}

function Versions({ app }: { app: AppView }) {
  const actions = useLibraryMutations();
  const { view, changeView } = useListingView();
  const [query, setQuery] = useState('');
  const releases = useQuery({ queryKey: ['launcher', 'releases', appId(app)], queryFn: () => appReleases(appId(app)) });
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (releases.data ?? []).filter((release) => !q || release.tag.toLowerCase().includes(q) || release.name.toLowerCase().includes(q));
  }, [releases.data, query]);
  const listLoading = releases.isLoading && !releases.data;
  const emptyMessage = query ? 'Nenhuma versão corresponde à busca.' : 'Nenhuma versão publicada.';

  function install(release: ReleaseInfo) {
    void actions.install(app, { tag: release.tag });
  }

  return (
    <PageShell>
      <PageShell.Heading subtitle={app.skippedUpdateVersion ? `A saltar ${app.skippedUpdateVersion}` : 'Tags publicadas no GitHub.'}>Versões</PageShell.Heading>
      {releases.error ? <InlineAlert>{launcherError(releases.error)}</InlineAlert> : null}
      <ViewToolbar
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="Buscar versão"
        searchAriaLabel="Buscar versões"
        view={view}
        onViewChange={(mode) => void changeView(mode)}
        ariaLabel="Barra de versões"
      />
      {view === 'grid' ? (
        <GridView
          items={rows}
          keyField="tag"
          loading={listLoading}
          emptyMessage={emptyMessage}
          renderItem={(release) => {
            const state = releaseState(app, release.tag);
            return (
              <div className={styles.cardHost}>
                <ItemCard
                  aria-label={`Instalar ${release.tag}`}
                  onClick={() => install(release)}
                  actions={{
                    label: `Ações para ${release.tag}`,
                    items: [{ label: 'Instalar', icon: <IconDownload size={15} />, onClick: () => install(release) }],
                  }}
                >
                  <div className={gc.body}>
                    <div className={gc.title}>{release.tag}</div>
                    <div className={gc.sub}>{publishedLabel(release.published)}</div>
                    <div className={gc.meta}>
                      <StatusBadge label={state.label} tone={state.tone} />
                    </div>
                  </div>
                </ItemCard>
              </div>
            );
          }}
        />
      ) : (
        <ReleaseList rows={rows} app={app} loading={listLoading} emptyMessage={emptyMessage} onInstall={install} />
      )}
    </PageShell>
  );
}

function ReleaseList({
  rows,
  app,
  loading,
  emptyMessage,
  onInstall,
}: {
  rows: ReleaseInfo[];
  app: AppView;
  loading: boolean;
  emptyMessage: string;
  onInstall: (release: ReleaseInfo) => void;
}) {
  const columns: TableColumn<ReleaseInfo>[] = [
    {
      key: 'tag',
      label: 'TAG',
      width: '38%',
      render: (row) => (
        <div className={styles.appLink}>
          <span className={styles.appName}>{row.tag}</span>
          {row.name && row.name !== row.tag ? <span className={styles.appRef}>{row.name}</span> : null}
        </div>
      ),
    },
    {
      key: 'published',
      label: 'PUBLICADA',
      render: (row) => <span className={styles.date}>{publishedLabel(row.published)}</span>,
    },
    {
      key: 'state',
      label: 'ESTADO',
      render: (row) => {
        const state = releaseState(app, row.tag);
        return <StatusBadge label={state.label} tone={state.tone} />;
      },
    },
  ];

  return (
    <DataTable
      loading={loading}
      loadingRows={6}
      columns={columns}
      rows={rows}
      keyField="tag"
      onRowClick={onInstall}
      emptyMessage={emptyMessage}
      rowActions={(row) => (
        <RowActions
          label={`Ações para ${row.tag}`}
          items={[{ label: 'Instalar', icon: <IconDownload size={15} />, onClick: () => onInstall(row) }]}
        />
      )}
    />
  );
}

function Executable({ app }: { app: AppView }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [fields, setFields] = useState<LaunchField[]>([]);
  const [configBusy, setConfigBusy] = useState(false);
  const config = useQuery({
    queryKey: ['launcher', 'launch-config', appId(app)],
    queryFn: () => appLaunchConfigGet(appId(app)),
  });

  useEffect(() => {
    if (!config.data) return;
    setFields(config.data.fields.map((item) => ({ ...item })));
  }, [config.data]);

  async function saveFields() {
    setConfigBusy(true);
    try {
      await appLaunchConfigSave(appId(app), { fields });
      await queryClient.invalidateQueries({ queryKey: ['launcher'] });
      await queryClient.invalidateQueries({ queryKey: ['launcher', 'launch-config', appId(app)] });
      await queryClient.invalidateQueries({ queryKey: ['launcher', 'exe', appId(app)] });
      toast.success('Configuração guardada.');
    } catch (err) {
      toast.error(launcherError(err));
    } finally {
      setConfigBusy(false);
    }
  }

  const progress = useAppProgressStore((s) => s.byId[appId(app)]);
  const setProgress = useAppProgressStore((s) => s.setProgress);
  const clearProgress = useAppProgressStore((s) => s.clearProgress);

  async function generateWithDeepseek() {
    const id = appId(app);
    if (useAppProgressStore.getState().isBusy(id) || configBusy) {
      toast.error('Já em curso…');
      return;
    }
    setConfigBusy(true);
    setProgress(id, { percent: 1, phase: 'DeepSeek a analisar…', kind: 'deepseek' });
    try {
      await appGenerateLaunchfile(id);
      await queryClient.invalidateQueries({ queryKey: ['launcher'] });
      await queryClient.invalidateQueries({ queryKey: ['launcher', 'launch-config', id] });
      await queryClient.invalidateQueries({ queryKey: ['launcher', 'exe', id] });
      toast.success('Launchfile gerado com DeepSeek.');
    } catch (err) {
      toast.error(launcherError(err));
    } finally {
      setConfigBusy(false);
      window.setTimeout(() => clearProgress(id), 700);
    }
  }

  return (
    <PageShell>
      <PageShell.Heading subtitle="Manifesto Launchfile — install, start, porta e URL.">
        Executável{' '}
        {config.data ? <StatusBadge label={config.data.runnerLabel} tone="info" /> : null}
      </PageShell.Heading>
      {config.error ? <InlineAlert>{launcherError(config.error)}</InlineAlert> : null}
      {progress ? <AppProgressBar progress={progress} /> : null}

      <LaunchConfigForm
        loaded={config.data}
        fields={fields}
        busy={configBusy || Boolean(progress)}
        onFieldsChange={setFields}
        onSaveFields={() => void saveFields()}
        onGenerateDeepseek={() => void generateWithDeepseek()}
      />
    </PageShell>
  );
}

function isTruthyLaunchValue(value: string) {
  return ['true', 'yes', 'on', '1'].includes(value.trim().toLowerCase());
}

function LaunchFieldControl({
  field,
  onChange,
  onError,
}: {
  field: LaunchField;
  onChange: (value: string) => void;
  onError: (message: string) => void;
}) {
  const type = (field.fieldType || 'text').toLowerCase();

  if (type === 'boolean') {
    return (
      <Checkbox checked={isTruthyLaunchValue(field.value)} onChange={(checked) => onChange(checked ? 'true' : 'false')} />
    );
  }

  if (type === 'multiline' || field.key === 'env') {
    return <Textarea value={field.value} onChange={(event) => onChange(event.target.value)} rows={4} />;
  }

  if (type === 'url') {
    return (
      <Input
        type="url"
        value={field.value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="https://"
        rightIcon={<IconExternalLink size={16} aria-hidden="true" />}
        rightIconLabel="Abrir URL"
        onRightIconClick={() => {
          const raw = field.value.trim();
          if (!raw) {
            onError('Indique uma URL para abrir.');
            return;
          }
          const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
          void openUrl(href).catch((err) => onError(launcherError(err)));
        }}
      />
    );
  }

  if (type === 'number') {
    return (
      <Input type="number" value={field.value} onChange={(event) => onChange(event.target.value)} inputMode="numeric" />
    );
  }

  return <Input value={field.value} onChange={(event) => onChange(event.target.value)} />;
}

function LaunchConfigForm({
  loaded,
  fields,
  busy,
  onFieldsChange,
  onSaveFields,
  onGenerateDeepseek,
}: {
  loaded?: Awaited<ReturnType<typeof appLaunchConfigGet>>;
  fields: LaunchField[];
  busy: boolean;
  onFieldsChange: (fields: LaunchField[]) => void;
  onSaveFields: () => void;
  onGenerateDeepseek: () => void;
}) {
  const toast = useToast();
  if (!loaded) return null;

  const working = fields.length ? fields : loaded.fields;
  const coreFields = working.filter((field) => field.key !== 'hint' && !field.key.startsWith('env.'));
  const envFields = working.filter((field) => field.key.startsWith('env.'));

  function patchField(key: string, value: string) {
    onFieldsChange(working.map((item) => (item.key === key ? { ...item, value } : item)));
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
      <FormCard aria-label="Configuração de execução">
        <FormCard.Header
          title="Launchfile"
          subtitle={
            loaded.relativePath
              ? `Ficheiro: ${loaded.relativePath}. Sem ficheiro, o Start (ou o botão abaixo) usa o DeepSeek.`
              : 'O DeepSeek cria o Launchfile se ainda não existir (token em Perfil).'
          }
        />
        {coreFields.map((field) => (
          <FormRow key={field.key} label={field.label}>
            <LaunchFieldControl
              field={field}
              onChange={(value) => patchField(field.key, value)}
              onError={(message) => toast.error(message)}
            />
          </FormRow>
        ))}
        {envFields.length ? (
          <>
            <FormCard.Header title="Variáveis de ambiente" />
            {envFields.map((field) => (
              <FormRow key={field.key} label={field.label}>
                <LaunchFieldControl
                  field={field}
                  onChange={(value) => patchField(field.key, value)}
                  onError={(message) => toast.error(message)}
                />
              </FormRow>
            ))}
          </>
        ) : null}
        {working.some((field) => field.key === 'hint') ? (
          <FormCard.Hint>{working.find((field) => field.key === 'hint')?.value}</FormCard.Hint>
        ) : null}
        <FormCard.Footer
          right={
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Button type="button" disabled={busy} onClick={onGenerateDeepseek}>
                Gerar com DeepSeek
              </Button>
              <Button type="button" variant="secondary" disabled={busy} onClick={onSaveFields}>
                Guardar campos
              </Button>
            </div>
          }
        />
      </FormCard>
    </div>
  );
}

function Shortcuts({ app }: { app: AppView }) {
  const toast = useToast();
  return (
    <PageShell>
      <PageShell.Heading subtitle="O atalho abre o Painel com o nome desta app.">Atalhos</PageShell.Heading>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="secondary" onClick={() => void appShortcutDesktop(appId(app)).then((path) => toast.success(path)).catch((err) => toast.error(launcherError(err)))}>Ambiente de trabalho</Button>
        <Button onClick={() => void appShortcutSteam(appId(app)).then((path) => toast.success(path)).catch((err) => toast.error(launcherError(err)))}>Steam</Button>
      </div>
    </PageShell>
  );
}

function Changelog({ app }: { app: AppView }) {
  const notes = useQuery({ queryKey: ['launcher', 'notes', appId(app)], queryFn: () => appChangelog(appId(app)) });
  const text = notes.data || app.changelog || 'Ainda não há texto de release em cache. Atualize a biblioteca para o ir buscar.';
  return (
    <PageShell>
      <PageShell.Heading subtitle={app.remoteVersion || 'Release em cache'}>Changelog</PageShell.Heading>
      <div className={styles.stack}>
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
    </PageShell>
  );
}

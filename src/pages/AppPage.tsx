import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { openUrl } from '@tauri-apps/plugin-opener';
import { open as openDialog } from '@tauri-apps/plugin-dialog';
import { IconCopy, IconDownload, IconFolder, IconPhoto, IconX } from '@tabler/icons-react';
import { PageShell } from '@/components/ui/PageShell';
import { Button } from '@/components/ui/Button';
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Modal } from '@/components/ui/Modal';
import { DangerZone } from '@/components/ui/DangerZone';
import { Input } from '@/components/ui/Input';
import { FormCard, FormRow } from '@/components/ui/FormCard';
import { GridView } from '@/components/ui/GridView';
import { ViewToolbar } from '@/components/ui/ViewToolbar';
import { DataTable, type TableColumn } from '@/components/ui/DataTable';
import { RowActions } from '@/components/ui/RowActions';
import { ItemCard, gridCardStyles as gc } from '@/components/ui/ItemCard';
import { useToast } from '@/components/ui/Toast';
import { appIconSrc, appId, useLibraryMutations } from '@/components/launcher/LibraryCard';
import { LaunchConfigPanel } from '@/components/launcher/LaunchConfigForm';
import { AppProgressBar } from '@/components/launcher/AppProgressBar';
import { useListingView } from '@/components/launcher/useListingView';
import { formatDate } from '@/utils';
import {
  appChangelog,
  appClearIcon,
  appCloudflareGet,
  appCloudflareSave,
  appCloudflareStart,
  appCloudflareStop,
  appCloudflareZones,
  appDeleteInstall,
  appDetail,
  appReleases,
  appSetIcon,
  appShortcutDesktop,
  appShortcutSteam,
  launcherError,
  libraryRemove,
  librarySave,
  appHref,
  statusLabel,
  type AppView,
  type CloudflareMode,
  type CloudflareZone,
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
  if (section === 'executable') return <LaunchConfigPanel app={app} showHeading />;
  if (section === 'shortcuts') return <Shortcuts app={app} />;
  if (section === 'cloudflare') return <CloudflareTunnel app={app} />;
  if (section === 'changelog') return <Changelog app={app} />;
  if (section === 'settings') return <AppSettings app={app} />;
  return <Overview app={app} />;
}

function Overview({ app }: { app: AppView }) {
  const toast = useToast();
  const actions = useLibraryMutations();
  const { activeOrg } = useOrg();
  const id = appId(app);
  const progress = useAppProgressStore((s) => s.byId[id]);
  const iconSrc = appIconSrc(app);
  const initial = (app.name.trim().charAt(0) || '?').toUpperCase();

  const cloudflare = useQuery({
    queryKey: ['launcher', 'cloudflare', activeOrg?.id, id],
    queryFn: () => appCloudflareGet(id),
    enabled: Boolean(activeOrg?.id),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data?.running) return 10000;
      return data.publicUrl ? 5000 : 1500;
    },
  });
  const cf = cloudflare.data;
  const cfMode = cf?.mode ?? cf?.config?.mode ?? 'quick';
  const cfHostname = cf?.config?.hostname?.trim() || '';
  const cfLiveUrl = cf?.running ? cf.publicUrl?.trim() || '' : '';
  const cfActionUrl = cf?.running
    ? cfLiveUrl ||
      (cfMode === 'named' && cfHostname
        ? cfHostname.startsWith('http')
          ? cfHostname
          : `https://${cfHostname}`
        : '')
    : '';

  async function runPrimary() {
    if (app.running && app.status !== 'not_installed') {
      await actions.restart(app);
      return;
    }
    if (app.status === 'installed') {
      await actions.launch(app);
      return;
    }
    await actions.install(app);
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
            {cf?.running ? (
              <StatusBadge
                label={cfMode === 'named' ? 'Cloudflare DNS' : 'Cloudflare Quick'}
                tone="success"
              />
            ) : null}
            {app.manuallyHidden ? <StatusBadge label="Oculta" tone="warning" /> : null}
          </div>
        </div>
      </header>

      {progress ? <AppProgressBar progress={progress} /> : null}

      <div className={styles.actions}>
        <Button type="button" disabled={Boolean(progress)} onClick={() => void runPrimary()}>
          {actions.primaryLabel(app)}
        </Button>
      </div>

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
                <strong>URL local</strong>
                {' · '}
                {app.openUrl}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      {cf?.effectivePort != null ? (
      <section className={styles.overviewPanel} aria-label="Cloudflare">
        <div className={styles.overviewPanelHead}>
          <h2 className={styles.overviewPanelTitle}>Cloudflare</h2>
          <Link className={styles.overviewPanelLink} to={appHref(app, 'cloudflare')}>
            Configurar
          </Link>
        </div>
        <div className={styles.overviewRunning}>
          <p className={styles.overviewRunningLine}>
            <strong>Modo</strong>
            {' · '}
            {cfMode === 'named' ? 'Domínio (DNS)' : 'Quick (trycloudflare.com)'}
          </p>
          <p className={styles.overviewRunningLine}>
            <strong>Túnel</strong>
            {' · '}
            {cf?.running ? (cfLiveUrl ? 'Em execução' : 'A obter URL…') : 'Parado'}
            {cf?.pid != null ? (
              <>
                {' '}
                <span className={styles.overviewStatValueMono}>(PID {cf.pid})</span>
              </>
            ) : null}
          </p>
          {cfMode === 'named' && cfHostname ? (
            <p className={styles.overviewRunningLine}>
              <strong>Hostname</strong>
              {' · '}
              <span className={styles.overviewStatValueMono}>{cfHostname}</span>
            </p>
          ) : null}
          {cf?.config?.startWithApp ? (
            <p className={styles.overviewRunningLine}>
              <strong>Com a app</strong>
              {' · '}
              Arranca automaticamente no launch
            </p>
          ) : null}
          {cf?.effectivePort != null ? (
            <p className={styles.overviewRunningLine}>
              <strong>Porta</strong>
              {' · '}
              {cf.effectivePort}
            </p>
          ) : null}
          {cf?.running && cfActionUrl ? (
            <p className={styles.overviewRunningLine}>
              <strong>URL pública</strong>
              {' · '}
              <span className={styles.overviewStatValueMono}>{cfActionUrl}</span>
            </p>
          ) : (
            <p className={styles.overviewRunningLine}>
              <strong>URL pública</strong>
              {' · '}
              {cfMode === 'named'
                ? cfHostname
                  ? 'Inicie o túnel para publicar o hostname'
                  : 'Configure o hostname na secção Cloudflare'
                : 'Inicie o túnel Quick para obter o link'}
            </p>
          )}
          {!cf?.cloudflaredAvailable ? (
            <p className={styles.overviewRunningLine}>
              <strong>cloudflared</strong>
              {' · '}
              Não encontrado neste PC
            </p>
          ) : null}
        </div>
        {cf?.running && cfActionUrl ? (
          <div className={styles.overviewPanelActions}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                void navigator.clipboard
                  .writeText(cfActionUrl)
                  .then(() => toast.success('URL Cloudflare copiada.'))
                  .catch(() => toast.error('Não foi possível copiar.'));
              }}
            >
              Copiar URL
            </Button>
            <Button
              type="button"
              onClick={() => void openUrl(cfActionUrl).catch((err) => toast.error(launcherError(err)))}
            >
              Abrir
            </Button>
          </div>
        ) : null}
      </section>
      ) : null}

      {app.installPath ? (
        <section className={styles.overviewPanel} aria-label="Localização">
          <h2 className={styles.overviewPanelTitle}>No disco</h2>
          <p className={`${styles.overviewRunningLine} ${styles.overviewStatValueMono}`}>{app.installPath}</p>
        </section>
      ) : null}
    </PageShell>
  );
}

function iconFileName(path: string | null | undefined) {
  if (!path) return '';
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

function defaultSubdomain(app: AppView) {
  const raw = (app.folderName || app.name || 'app').trim().toLowerCase();
  const cleaned = raw
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || 'app';
}

function splitHostname(hostname: string, zones: CloudflareZone[]) {
  const host = hostname.trim().toLowerCase();
  if (!host) return { subdomain: '', zone: '' };
  const sorted = [...zones].sort((a, b) => b.name.length - a.name.length);
  for (const z of sorted) {
    const zone = z.name.toLowerCase();
    if (host === zone) return { subdomain: '', zone: z.name };
    const suffix = `.${zone}`;
    if (host.endsWith(suffix)) {
      return { subdomain: host.slice(0, -suffix.length), zone: z.name };
    }
  }
  const dot = host.indexOf('.');
  if (dot <= 0) return { subdomain: host, zone: '' };
  return { subdomain: host.slice(0, dot), zone: hostname.trim().slice(dot + 1) };
}

function CloudflareTunnel({ app }: { app: AppView }) {
  const toast = useToast();
  const navigate = useNavigate();
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
      return data.publicUrl ? 4000 : 1000;
    },
    enabled: Boolean(activeOrg?.id),
  });
  const view = detail.data;

  useEffect(() => {
    if (!detail.isFetched || !view) return;
    if (view.effectivePort == null) {
      navigate(appHref(app), { replace: true });
    }
  }, [app, detail.isFetched, navigate, view]);
  const [mode, setMode] = useState<CloudflareMode>('quick');
  const [startWithApp, setStartWithApp] = useState(false);
  const [subdomain, setSubdomain] = useState('');
  const [zoneName, setZoneName] = useState('');
  const [busy, setBusy] = useState(false);
  const synced = useRef(false);
  const hostPartsSynced = useRef(false);
  const pendingHostname = useRef('');

  const hasToken = Boolean(view?.hasApiToken);
  const zones = useQuery({
    queryKey: ['launcher', 'cloudflare-zones', activeOrg?.id],
    queryFn: () => appCloudflareZones(),
    enabled: Boolean(activeOrg?.id && mode === 'named' && hasToken),
    retry: false,
  });

  useEffect(() => {
    synced.current = false;
    hostPartsSynced.current = false;
    pendingHostname.current = '';
  }, [id]);

  useEffect(() => {
    if (!view || synced.current) return;
    synced.current = true;
    setMode(view.config.mode);
    setStartWithApp(Boolean(view.config.startWithApp));
    pendingHostname.current = view.config.hostname?.trim() || '';
    setSubdomain(defaultSubdomain(app));
  }, [view, app]);

  useEffect(() => {
    if (hostPartsSynced.current || !synced.current) return;
    if (mode === 'named' && hasToken && zones.isLoading) return;

    hostPartsSynced.current = true;
    const zoneList = zones.data ?? [];
    const host = pendingHostname.current;
    if (host) {
      const parts = splitHostname(host, zoneList);
      setSubdomain(parts.subdomain || defaultSubdomain(app));
      if (parts.zone) setZoneName(parts.zone);
    } else {
      setSubdomain(defaultSubdomain(app));
      if (zoneList.length === 1) setZoneName(zoneList[0].name);
    }
  }, [app, hasToken, mode, zones.data, zones.isLoading]);

  const composedHostname = useMemo(() => {
    const sub = subdomain.trim().replace(/^\.+|\.+$/g, '');
    const zone = zoneName.trim();
    if (!sub || !zone) return '';
    return `${sub}.${zone}`.toLowerCase();
  }, [subdomain, zoneName]);

  const hostnameConflict = useMemo(() => {
    if (mode !== 'named' || !composedHostname) return null;
    const claims = view?.hostnameClaims ?? [];
    const selfFolder = (app.folderName || '').trim().toLowerCase();
    return (
      claims.find(
        (claim) =>
          claim.hostname.trim().toLowerCase() === composedHostname &&
          claim.folderName.trim().toLowerCase() !== selfFolder,
      ) ?? null
    );
  }, [app.folderName, composedHostname, mode, view?.hostnameClaims]);

  const publicUrl = view?.running ? view.publicUrl?.trim() || '' : '';
  const tunnelLabel = view?.running ? (publicUrl ? 'Em execução' : 'A obter URL…') : 'Parado';
  const tunnelTone: StatusTone = view?.running ? 'success' : 'muted';
  const canStart =
    Boolean(app.running) &&
    Boolean(view?.cloudflaredAvailable) &&
    view?.effectivePort != null &&
    !(mode === 'named' && (Boolean(hostnameConflict) || !composedHostname || !hasToken));

  const dirty = useMemo(() => {
    if (!view) return false;
    const savedMode = view.config.mode;
    const savedStart = Boolean(view.config.startWithApp);
    const savedHost = (view.config.hostname ?? '').trim().toLowerCase();
    const nextHost = mode === 'named' ? composedHostname : '';
    return mode !== savedMode || startWithApp !== savedStart || nextHost !== savedHost;
  }, [composedHostname, mode, startWithApp, view]);

  async function persistConfig() {
    if (mode === 'named' && !composedHostname) {
      throw new Error('Escolha o subdomínio e o domínio Cloudflare.');
    }
    if (hostnameConflict) {
      throw new Error(
        `O hostname «${composedHostname}» já está em uso pela app «${hostnameConflict.name}».`,
      );
    }
    await appCloudflareSave(id, {
      mode,
      startWithApp,
      portOverride: null,
      hostname: mode === 'named' ? composedHostname : null,
      tunnelName: null,
    });
  }

  async function save() {
    if (!dirty) return;
    setBusy(true);
    try {
      await persistConfig();
      await detail.refetch();
      toast.success('Configuração do túnel salva.');
    } catch (err) {
      toast.error(launcherError(err));
    } finally {
      setBusy(false);
    }
  }

  async function start() {
    setBusy(true);
    try {
      await persistConfig();
      const next = await appCloudflareStart(id);
      await queryClient.invalidateQueries({ queryKey: ['launcher', 'cloudflare'] });
      await detail.refetch();
      if (next.publicUrl) {
        toast.success(`URL pública: ${next.publicUrl}`);
      } else {
        toast.success('Túnel a iniciar… a URL aparece no switcher e na visão geral.');
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
      toast.success('Túnel parado.');
    } catch (err) {
      toast.error(launcherError(err));
    } finally {
      setBusy(false);
    }
  }

  if (detail.isFetched && view && view.effectivePort == null) {
    return (
      <PageShell>
        <p className={styles.meta}>Esta app não usa porta — a redirecionar…</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageShell.Heading subtitle="Quick ou domínio próprio para esta app. Credenciais globais nas definições de perfil.">
        Cloudflare
      </PageShell.Heading>

      {!view?.cloudflaredAvailable ? (
        <div style={{ marginTop: 12 }}>
          <InlineAlert variant="warning">
            cloudflared não encontrado. Instale-o (
            <a
              href="https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/"
              target="_blank"
              rel="noreferrer"
            >
              instalação
            </a>
            ) ou defina o caminho em{' '}
            <Link to="/settings/profile">Definições de perfil</Link>.
          </InlineAlert>
        </div>
      ) : null}

      <FormCard
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        aria-label="Túnel Cloudflare"
        style={{ marginTop: 16 }}
      >
        <div className={styles.cfCardHead}>
          <FormCard.Header
            title="Túnel Cloudflare"
            subtitle="Quick ou domínio próprio. A URL aparece no switcher e na visão geral."
          />
          <StatusBadge label={tunnelLabel} tone={tunnelTone} />
        </div>

        <FormRow label="Modo">
          <Select
            value={mode}
            onChange={(value) => setMode(value as CloudflareMode)}
            options={[
              { value: 'quick', label: 'Quick (*.trycloudflare.com)' },
              { value: 'named', label: 'Domínio Cloudflare (DNS)' },
            ]}
          />
        </FormRow>

        {mode === 'named' ? (
          <FormRow label="Hostname">
            {!hasToken ? (
              <div style={{ marginBottom: 8 }}>
                <InlineAlert variant="warning">
                  Falta o token da API Cloudflare.{' '}
                  <Link to="/settings/profile">Configurar em Definições de perfil</Link>
                </InlineAlert>
              </div>
            ) : null}
            <div className={styles.hostnameRow}>
              <Input
                value={subdomain}
                onChange={(event) => setSubdomain(event.target.value)}
                placeholder={defaultSubdomain(app)}
                aria-label="Subdomínio"
              />
              <span className={styles.hostnameDot} aria-hidden="true">
                .
              </span>
              <Select
                value={zoneName}
                onChange={setZoneName}
                disabled={!hasToken || zones.isLoading || Boolean(zones.error) || (zones.data?.length ?? 0) === 0}
                searchable
                searchPlaceholder="Buscar domínio…"
                placeholder={
                  !hasToken
                    ? 'Token em falta…'
                    : zones.isLoading
                      ? 'A carregar domínios…'
                      : zones.error
                        ? 'Falha ao listar zonas'
                        : (zones.data?.length ?? 0) === 0
                          ? 'Sem domínios na conta'
                          : 'Escolher domínio…'
                }
                aria-label="Domínio Cloudflare"
                options={(zones.data ?? []).map((z) => ({ value: z.name, label: z.name }))}
              />
            </div>
            <FormCard.Hint>
              {composedHostname
                ? `https://${composedHostname}`
                : 'Subdomínio à esquerda e domínio da conta à direita.'}
              {zones.error ? (
                <>
                  {' '}
                  O token precisa de <strong>Zone → Zone → Read</strong>.{' '}
                  <Link to="/settings/profile">Editar nas definições</Link>.
                </>
              ) : null}
            </FormCard.Hint>
            {hostnameConflict ? (
              <div style={{ marginTop: 8 }}>
                <InlineAlert variant="warning">
                  Este hostname já está na app <strong>{hostnameConflict.name}</strong>.{' '}
                  <Link
                    to={appHref(
                      {
                        repository: hostnameConflict.repository,
                        folderName: hostnameConflict.folderName,
                      },
                      'cloudflare',
                    )}
                  >
                    Abrir Cloudflare de {hostnameConflict.name}
                  </Link>
                </InlineAlert>
              </div>
            ) : null}
          </FormRow>
        ) : null}

        <FormRow label="Com a app">
          <PreferenceToggleRow
            title="Iniciar com a app"
            description="Ao lançar a app, o túnel também arranca. A URL fica no switcher e na visão geral."
            checked={startWithApp}
            onChange={setStartWithApp}
          />
        </FormRow>

        {!view?.running && !app.running ? (
          <p className={styles.meta}>Inicie a app antes do túnel.</p>
        ) : null}

        <FormCard.Footer
          right={
            <div className={styles.actions}>
              {dirty ? (
                <Button
                  type="submit"
                  variant="secondary"
                  disabled={busy || detail.isLoading || Boolean(hostnameConflict)}
                >
                  Salvar
                </Button>
              ) : null}
              {view?.running ? (
                <Button type="button" disabled={busy} onClick={() => void stop()}>
                  Parar
                </Button>
              ) : (
                <Button type="button" disabled={busy || !canStart} onClick={() => void start()}>
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
  const [pendingDanger, setPendingDanger] = useState<'delete' | 'remove' | null>(null);
  const [dangerBusy, setDangerBusy] = useState(false);
  const hasIcon = Boolean(app.iconPath);

  useEffect(() => {
    setName(app.name);
  }, [app.name]);

  const entryDirty = name.trim() !== app.name.trim();

  async function saveEntry() {
    if (!entryDirty) return;
    try {
      await librarySave(
        {
          name,
          repository: app.repository,
          folderName: app.folderName,
          installPath: app.configuredInstallPath ?? null,
          appIconUrl: app.appIconUrl ?? null,
          preferredVersion: app.preferredVersion ?? null,
          skippedUpdateVersion: app.skippedUpdateVersion ?? null,
        },
        appId(app),
      );
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
      toast.success('Ícone salvo.');
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
        {entryDirty ? (
          <FormCard.Footer right={<Button type="submit" variant="secondary">Salvar</Button>} />
        ) : null}
      </FormCard>

      <PageShell.Section className={styles.blockGap}>
        {app.status !== 'not_installed' ? (
          <DangerZone
            title="Apagar a instalação"
            description="Remove a pasta instalada e mantém a entrada na biblioteca."
            action={
              <Button variant="danger" onClick={() => setPendingDanger('delete')}>
                Apagar pasta
              </Button>
            }
          />
        ) : null}
        <DangerZone
          title="Remover da biblioteca"
          description="Tira a entrada de apps.json. A pasta instalada fica no disco."
          action={
            <Button variant="danger" onClick={() => setPendingDanger('remove')}>
              Remover
            </Button>
          }
        />
      </PageShell.Section>

      <Modal
        isOpen={pendingDanger != null}
        onClose={() => {
          if (!dangerBusy) setPendingDanger(null);
        }}
        title={pendingDanger === 'delete' ? 'Apagar a instalação' : 'Remover da biblioteca'}
      >
        <Modal.Content>
          <Modal.Text>
            {pendingDanger === 'delete'
              ? 'A pasta instalada será apagada. A entrada continua na biblioteca. Se a app estiver a correr, ela é parada primeiro.'
              : 'A entrada sai da biblioteca. A pasta no disco fica. Se a app estiver a correr, ela é parada primeiro.'}
          </Modal.Text>
        </Modal.Content>
        <Modal.Footer>
          <Button type="button" disabled={dangerBusy} onClick={() => setPendingDanger(null)}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={dangerBusy}
            loading={dangerBusy}
            onClick={() => {
              void (async () => {
                setDangerBusy(true);
                try {
                  if (app.running) {
                    const stopped = await actions.stop(app);
                    if (!stopped) return;
                  }
                  if (pendingDanger === 'delete') {
                    await appDeleteInstall(appId(app));
                    await queryClient.invalidateQueries({ queryKey: ['launcher'] });
                    toast.success('Instalação apagada.');
                  } else {
                    await libraryRemove(appId(app));
                    navigate('/');
                  }
                  setPendingDanger(null);
                } catch (err) {
                  toast.error(launcherError(err));
                } finally {
                  setDangerBusy(false);
                }
              })();
            }}
          >
            {pendingDanger === 'delete' ? 'Apagar pasta' : 'Remover'}
          </Button>
        </Modal.Footer>
      </Modal>
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
                  aria-label={`Descarregar ${release.tag}`}
                  onClick={() => install(release)}
                  actions={{
                    label: `Ações para ${release.tag}`,
                    items: [{ label: 'Descarregar', icon: <IconDownload size={15} />, onClick: () => install(release) }],
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
          items={[{ label: 'Descarregar', icon: <IconDownload size={15} />, onClick: () => onInstall(row) }]}
        />
      )}
    />
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

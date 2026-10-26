import { useEffect, useMemo, useState } from 'react';
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
  statusLabel,
  type AppView,
  type LaunchField,
  type ReleaseInfo,
} from '@/lib/launcher-api';
import { useAppProgressStore } from '@/stores/app-progress';
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
  const params = useParams();
  const section = params.section ?? '';
  const appKey = params.folder
    ? decodeURIComponent(params.folder)
    : `${params.owner}/${params.repo}`;
  const detail = useQuery({ queryKey: ['launcher', 'app', appKey], queryFn: () => appDetail(appKey) });
  const app = detail.data;
  if (detail.isLoading) return <PageShell><p className={styles.meta}>A carregar…</p></PageShell>;
  if (!app) return <PageShell><InlineAlert>{launcherError(detail.error) || 'App não encontrada.'}</InlineAlert></PageShell>;
  if (section === 'versions') return <Versions app={app} />;
  if (section === 'executable') return <Executable app={app} />;
  if (section === 'shortcuts') return <Shortcuts app={app} />;
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

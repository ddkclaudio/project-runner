import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { openUrl } from '@tauri-apps/plugin-opener';
import { IconDownload, IconCheck } from '@tabler/icons-react';
import { PageShell } from '@/components/ui/PageShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Modal } from '@/components/ui/Modal';
import { DangerZone } from '@/components/ui/DangerZone';
import { FormCard, FormRow } from '@/components/ui/FormCard';
import { GridView } from '@/components/ui/GridView';
import { ViewToolbar } from '@/components/ui/ViewToolbar';
import { DataTable, type TableColumn } from '@/components/ui/DataTable';
import { RowActions } from '@/components/ui/RowActions';
import { ItemCard, gridCardStyles as gc } from '@/components/ui/ItemCard';
import { useToast } from '@/components/ui/Toast';
import { ChoiceList, useLibraryMutations } from '@/components/launcher/LibraryCard';
import { useListingView } from '@/components/launcher/useListingView';
import { formatDate } from '@/utils';
import {
  appChangelog,
  appClearIcon,
  appDeleteInstall,
  appDetail,
  appExecutables,
  appLocate,
  appReleases,
  appSetExecutable,
  appSetIcon,
  appShortcutDesktop,
  appShortcutSteam,
  appSkipUpdate,
  launcherError,
  libraryRemove,
  librarySave,
  statusLabel,
  type AppView,
  type ReleaseInfo,
} from '@/lib/launcher-api';
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

function fileName(path: string) {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] || path;
}

export function AppPage() {
  const params = useParams();
  const section = params.section ?? '';
  const repository = `${params.owner}/${params.repo}`;
  const detail = useQuery({ queryKey: ['launcher', 'app', repository], queryFn: () => appDetail(repository) });
  const app = detail.data;
  if (detail.isLoading) return <PageShell><p className={styles.meta}>A carregar…</p></PageShell>;
  if (!app) return <PageShell><InlineAlert>{launcherError(detail.error) || 'App não encontrada.'}</InlineAlert></PageShell>;
  if (section === 'versions') return <Versions app={app} />;
  if (section === 'executable') return <Executable app={app} />;
  if (section === 'shortcuts') return <Shortcuts app={app} />;
  if (section === 'changelog') return <Changelog app={app} />;
  return <Overview app={app} />;
}

function Overview({ app }: { app: AppView }) {
  const actions = useLibraryMutations();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [choice, setChoice] = useState<string[] | null>(null);
  const [confirmWine, setConfirmWine] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [name, setName] = useState(app.name);
  const [folderName, setFolderName] = useState(app.folderName);
  const [iconUrl, setIconUrl] = useState(app.appIconUrl || '');
  const [locate, setLocate] = useState('');
  const [iconFile, setIconFile] = useState('');

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
    await queryClient.invalidateQueries({ queryKey: ['launcher', 'app', app.repository] });
  }

  async function saveEntry() {
    try {
      await librarySave({ ...app, name, folderName, appIconUrl: iconUrl || null }, app.repository);
      await queryClient.invalidateQueries({ queryKey: ['launcher'] });
      toast.success('Entrada atualizada.');
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  return (
    <PageShell>
      <PageShell.Heading
        subtitle={
          <>
            {app.repository}
            <span className={styles.meta} style={{ display: 'block', marginTop: 4 }}>
              {app.installedVersion ? `Instalada ${app.installedVersion}` : 'Por instalar'}
              {app.remoteVersion ? ` · remota ${app.remoteVersion}` : ''}
              {app.lastPlayed ? ` · último uso ${app.lastPlayed}` : ''}
            </span>
          </>
        }
        actions={<StatusBadge label={statusLabel(app.status)} tone={app.status === 'update' ? 'warning' : app.status === 'installed' ? 'success' : 'muted'} />}
      >
        {app.name}
      </PageShell.Heading>

      <div className={styles.actions}>
        <Button variant="secondary" onClick={() => void primary()}>{actions.primaryLabel(app)}</Button>
        <Button onClick={() => void actions.openFolder(app)}>Abrir pasta</Button>
        <Button onClick={() => void actions.hide(app)}>{app.manuallyHidden ? 'Mostrar' : 'Ocultar'}</Button>
        <Button onClick={() => void openUrl(`https://github.com/${app.repository}`)}>GitHub</Button>
        {app.remoteVersion ? (
          <Button onClick={() => void appSkipUpdate(app.repository, app.remoteVersion).then(() => queryClient.invalidateQueries({ queryKey: ['launcher'] })).catch((err) => toast.error(launcherError(err)))}>
            Saltar {app.remoteVersion}
          </Button>
        ) : null}
      </div>

      <FormCard
        onSubmit={(event) => {
          event.preventDefault();
          void saveEntry();
        }}
        aria-label="Entrada da app"
      >
        <FormCard.Header title="Entrada" subtitle="Nome, pasta e ícone em apps.json." />
        <FormRow label="Nome">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </FormRow>
        <FormRow label="Pasta">
          <Input value={folderName} onChange={(event) => setFolderName(event.target.value)} />
        </FormRow>
        <FormRow label="Ícone remoto">
          <Input value={iconUrl} onChange={(event) => setIconUrl(event.target.value)} />
        </FormRow>
        <FormRow label="Imagem local">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Input value={iconFile} onChange={(event) => setIconFile(event.target.value)} />
            <div className={styles.actions} style={{ marginBottom: 0 }}>
              <Button type="button" onClick={() => void appSetIcon(app.repository, iconFile).then(() => queryClient.invalidateQueries({ queryKey: ['launcher'] })).then(() => toast.success('Imagem guardada.')).catch((err) => toast.error(launcherError(err)))}>Usar imagem</Button>
              <Button type="button" onClick={() => void appClearIcon(app.repository).then(() => queryClient.invalidateQueries({ queryKey: ['launcher'] })).catch((err) => toast.error(launcherError(err)))}>Remover imagem</Button>
            </div>
          </div>
        </FormRow>
        <FormRow label="Pasta instalada">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Input value={locate} onChange={(event) => setLocate(event.target.value)} />
            <Button type="button" onClick={() => void appLocate(app.repository, locate).then(() => queryClient.invalidateQueries({ queryKey: ['launcher'] })).then(() => toast.success('Instalação localizada.')).catch((err) => toast.error(launcherError(err)))}>Localizar</Button>
          </div>
        </FormRow>
        <FormCard.Footer right={<Button type="submit" variant="secondary">Guardar entrada</Button>} />
      </FormCard>

      <PageShell.Section className={styles.blockGap}>
        {app.status !== 'not_installed' ? (
          <DangerZone
            title="Apagar a instalação"
            description="Remove a pasta instalada e mantém a entrada na biblioteca."
            action={<Button variant="danger" onClick={() => void appDeleteInstall(app.repository).then(() => queryClient.invalidateQueries({ queryKey: ['launcher'] })).then(() => toast.success('Instalação apagada.')).catch((err) => toast.error(launcherError(err)))}>Apagar pasta</Button>}
          />
        ) : null}
        <DangerZone
          title="Remover da biblioteca"
          description="Tira a entrada de apps.json. A pasta instalada fica no disco."
          action={<Button variant="danger" onClick={() => void libraryRemove(app.repository).then(() => navigate('/')).catch((err) => toast.error(launcherError(err)))}>Remover</Button>}
        />
      </PageShell.Section>
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

function Versions({ app }: { app: AppView }) {
  const actions = useLibraryMutations();
  const { view, changeView } = useListingView();
  const [query, setQuery] = useState('');
  const releases = useQuery({ queryKey: ['launcher', 'releases', app.repository], queryFn: () => appReleases(app.repository) });
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
  const { view, changeView } = useListingView();
  const [query, setQuery] = useState('');
  const executables = useQuery({ queryKey: ['launcher', 'exe', app.repository], queryFn: () => appExecutables(app.repository) });
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (executables.data ?? [])
      .filter((path) => !q || path.toLowerCase().includes(q))
      .map((path) => ({ id: path, path, name: fileName(path) }));
  }, [executables.data, query]);
  const listLoading = executables.isLoading && !executables.data;
  const emptyMessage = query ? 'Nenhum executável corresponde à busca.' : 'Nenhum executável encontrado.';

  async function select(path: string) {
    try {
      await appSetExecutable(app.repository, path);
      await queryClient.invalidateQueries({ queryKey: ['launcher'] });
      toast.success('Executável gravado.');
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  return (
    <PageShell>
      <PageShell.Heading subtitle={app.selectedExecutable || 'Sem executável gravado.'}>Executável</PageShell.Heading>
      {executables.error ? <InlineAlert>{launcherError(executables.error)}</InlineAlert> : null}
      <ViewToolbar
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="Buscar executável"
        searchAriaLabel="Buscar executáveis"
        view={view}
        onViewChange={(mode) => void changeView(mode)}
        ariaLabel="Barra de executáveis"
      />
      {view === 'grid' ? (
        <GridView
          items={rows}
          keyField="id"
          loading={listLoading}
          emptyMessage={emptyMessage}
          renderItem={(row) => {
            const current = row.path === app.selectedExecutable;
            return (
              <div className={styles.cardHost}>
                <ItemCard
                  aria-label={`Usar ${row.name}`}
                  highlight={current}
                  onClick={() => void select(row.path)}
                  actions={{
                    label: `Ações para ${row.name}`,
                    items: [{ label: 'Usar', icon: <IconCheck size={15} />, onClick: () => void select(row.path) }],
                  }}
                >
                  <div className={gc.body}>
                    <div className={gc.title}>{row.name}</div>
                    <div className={gc.sub} title={row.path}>
                      {row.path}
                    </div>
                    {current ? (
                      <div className={gc.meta}>
                        <StatusBadge label="Em uso" tone="success" />
                      </div>
                    ) : null}
                  </div>
                </ItemCard>
              </div>
            );
          }}
        />
      ) : (
        <ExecutableList
          rows={rows}
          selected={app.selectedExecutable}
          loading={listLoading}
          emptyMessage={emptyMessage}
          onSelect={(row) => void select(row.path)}
        />
      )}
    </PageShell>
  );
}

function ExecutableList({
  rows,
  selected,
  loading,
  emptyMessage,
  onSelect,
}: {
  rows: { id: string; path: string; name: string }[];
  selected?: string | null;
  loading: boolean;
  emptyMessage: string;
  onSelect: (row: { id: string; path: string; name: string }) => void;
}) {
  const columns: TableColumn<{ id: string; path: string; name: string }>[] = [
    {
      key: 'name',
      label: 'FICHEIRO',
      width: '32%',
      render: (row) => <span className={styles.appName}>{row.name}</span>,
    },
    {
      key: 'path',
      label: 'CAMINHO',
      render: (row) => <span className={styles.date}>{row.path}</span>,
    },
    {
      key: 'state',
      label: 'ESTADO',
      render: (row) => (row.path === selected ? <StatusBadge label="Em uso" tone="success" /> : <span className={styles.date}>—</span>),
    },
  ];

  return (
    <DataTable
      loading={loading}
      loadingRows={6}
      columns={columns}
      rows={rows}
      keyField="id"
      onRowClick={onSelect}
      emptyMessage={emptyMessage}
      rowActions={(row) => (
        <RowActions
          label={`Ações para ${row.name}`}
          items={[{ label: 'Usar', icon: <IconCheck size={15} />, onClick: () => onSelect(row) }]}
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
        <Button variant="secondary" onClick={() => void appShortcutDesktop(app.repository).then((path) => toast.success(path)).catch((err) => toast.error(launcherError(err)))}>Ambiente de trabalho</Button>
        <Button onClick={() => void appShortcutSteam(app.repository).then((path) => toast.success(path)).catch((err) => toast.error(launcherError(err)))}>Steam</Button>
      </div>
    </PageShell>
  );
}

function Changelog({ app }: { app: AppView }) {
  const notes = useQuery({ queryKey: ['launcher', 'notes', app.repository], queryFn: () => appChangelog(app.repository) });
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

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { openUrl } from '@tauri-apps/plugin-opener';
import { IconEye, IconPlus } from '@tabler/icons-react';
import { PageShell } from '@/components/ui/PageShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { FormCard, FormRow } from '@/components/ui/FormCard';
import { GridView } from '@/components/ui/GridView';
import { ViewToolbar } from '@/components/ui/ViewToolbar';
import { FilterDropdown } from '@/components/ui/FilterDropdown';
import { DataTable, type TableColumn } from '@/components/ui/DataTable';
import { RowActions } from '@/components/ui/RowActions';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ItemCard, gridCardStyles as gc } from '@/components/ui/ItemCard';
import { useToast } from '@/components/ui/Toast';
import { useListingView } from '@/components/launcher/useListingView';
import {
  appHref,
  catalogAdd,
  catalogLoad,
  launcherError,
  libraryExport,
  libraryImport,
  libraryList,
  libraryValidate,
  settingsSave,
  type AppEntry,
} from '@/lib/launcher-api';
import { useOrg } from '@/contexts/OrgContext';
import styles from './library.module.css';

const TOKEN_URL = 'https://github.com/settings/tokens/new?description=Painel';

type CatalogRow = AppEntry & { group: string; id: string };

function isRateLimit(err: unknown) {
  const message = launcherError(err);
  return message.includes('limitou os pedidos') || message.includes('token clássico');
}

export function CatalogPage({ mode }: { mode: 'remote' | 'files' }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [raw, setRaw] = useState('');

  async function onImport(file: File) {
    try {
      const count = await libraryImport(await file.text());
      await queryClient.invalidateQueries({ queryKey: ['launcher', 'library'] });
      toast.success(`${count} apps importadas.`);
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  async function onExport() {
    try {
      const json = await libraryExport();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'apps.json';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  async function onValidate() {
    try {
      const count = await libraryValidate();
      toast.success(`Biblioteca regravada com ${count} apps.`);
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  if (mode === 'files') {
    return (
      <PageShell>
        <PageShell.Heading subtitle="O ficheiro aceita apps, um array, ou as secções standard, experimental e custom.">
          Importar e exportar
        </PageShell.Heading>
        <FormCard
          aria-label="Importar e exportar biblioteca"
          onSubmit={(event) => {
            event.preventDefault();
            void libraryImport(raw)
              .then(async (count) => {
                await queryClient.invalidateQueries({ queryKey: ['launcher', 'library'] });
                toast.success(`${count} apps importadas.`);
              })
              .catch((err) => toast.error(launcherError(err)));
          }}
        >
          <FormCard.Header title="Biblioteca JSON" />
          <FormRow label="JSON" alignStart>
            <Input value={raw} onChange={(event) => setRaw(event.target.value)} placeholder='{"apps":[]}' />
          </FormRow>
          <FormCard.Footer
            left={
              <div className={styles.actions} style={{ marginBottom: 0 }}>
                <Button type="button" onClick={() => fileRef.current?.click()}>
                  Escolher ficheiro
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void onImport(file);
                  }}
                />
                <Button type="button" onClick={() => void onExport()}>
                  Exportar
                </Button>
                <Button type="button" onClick={() => void onValidate()}>
                  Validar
                </Button>
              </div>
            }
            right={
              <Button type="submit" variant="secondary">
                Importar texto
              </Button>
            }
          />
        </FormCard>
      </PageShell>
    );
  }

  return <RemoteCatalog />;
}

function RemoteCatalog() {
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeOrg } = useOrg();
  const { view, changeView, settings } = useListingView();
  const tokenReady = Boolean(settings.data?.githubApiToken.trim());
  const catalog = useQuery({
    queryKey: ['launcher', 'catalog', activeOrg?.id],
    queryFn: catalogLoad,
    enabled: tokenReady && Boolean(activeOrg?.id),
    retry: false,
  });
  const library = useQuery({
    queryKey: ['launcher', 'library', activeOrg?.id],
    queryFn: libraryList,
    enabled: tokenReady && Boolean(activeOrg?.id),
  });
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const tokenSynced = useRef(false);

  useEffect(() => {
    if (!settings.data || tokenSynced.current) return;
    tokenSynced.current = true;
    setToken(settings.data.githubApiToken);
  }, [settings.data]);

  const owned = useMemo(() => {
    return new Set((library.data?.apps ?? []).map((app) => app.repository.toLowerCase()));
  }, [library.data]);

  const groups = catalog.data?.groups.map((item) => item.name) ?? [];

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (catalog.data?.groups ?? []).flatMap((item) =>
      item.apps
        .filter((app) => {
          if (group && item.name !== group) return false;
          if (!q) return true;
          return app.name.toLowerCase().includes(q) || app.repository.toLowerCase().includes(q);
        })
        .map((app) => ({ ...app, group: item.name, id: `${item.name}:${app.repository}` })),
    );
  }, [catalog.data, query, group]);

  const rateLimited = Boolean(catalog.error && isRateLimit(catalog.error));
  const showToken = settings.isSuccess && (!tokenReady || rateLimited);
  const listLoading = tokenReady && catalog.isLoading && !catalog.data;

  async function add(entry: AppEntry) {
    try {
      await catalogAdd(entry);
      await queryClient.invalidateQueries({ queryKey: ['launcher', 'library'] });
      toast.success(`${entry.name} entrou na biblioteca.`);
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  /** Abrir só se houver exactamente uma app com este repo na biblioteca. */
  function openByRepo(repository: string) {
    const matches = (library.data?.apps ?? []).filter(
      (app) => app.repository.toLowerCase() === repository.toLowerCase(),
    );
    if (matches.length === 1) navigate(appHref(matches[0]));
    else navigate('/');
  }

  function primary(row: CatalogRow) {
    void add(row);
  }

  function catalogActions(row: CatalogRow) {
    const matches = (library.data?.apps ?? []).filter(
      (app) => app.repository.toLowerCase() === row.repository.toLowerCase(),
    );
    const items = [
      {
        label: 'Adicionar',
        icon: <IconPlus size={15} />,
        onClick: () => void add(row),
      },
    ];
    if (matches.length === 1) {
      items.push({
        label: 'Abrir',
        icon: <IconEye size={15} />,
        onClick: () => openByRepo(row.repository),
      });
    }
    return items;
  }

  async function openGitHub() {
    try {
      await openUrl(TOKEN_URL);
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  async function saveToken() {
    const current = settings.data;
    if (!current) return;
    const { dataDir: _dataDir, appVersion: _appVersion, ...rest } = current;
    try {
      await settingsSave({ ...rest, githubApiToken: token.trim() });
      tokenSynced.current = false;
      await queryClient.invalidateQueries({ queryKey: ['launcher'] });
      toast.success('Token guardado.');
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  const subtitle = catalog.data
    ? `${catalog.data.repository} · ${catalog.data.version}${catalog.data.fromCache ? ' · cache' : ''}`
    : 'A última release do repositório configurado.';
  const emptyMessage = query || group ? 'Nenhuma app corresponde aos filtros.' : 'O catálogo não tem apps.';

  return (
    <PageShell>
      <PageShell.Heading subtitle={subtitle}>Catálogo</PageShell.Heading>
      {settings.isLoading ? <p className={styles.meta}>A carregar…</p> : null}
      {settings.error ? <InlineAlert>{launcherError(settings.error)}</InlineAlert> : null}
      {showToken ? (
        <FormCard
          aria-label="Configurar token GitHub"
          onSubmit={(event) => {
            event.preventDefault();
            void saveToken();
          }}
        >
          <FormCard.Header
            title="Token GitHub"
            subtitle="O GitHub limita os pedidos anónimos. Crie um token clássico, sem permissões, e cole-o aqui."
          />
          <FormRow label="Token">
            <Input type="password" value={token} onChange={(event) => setToken(event.target.value)} />
            <FormCard.Hint>O GitHub mostra o valor só depois de Generate token.</FormCard.Hint>
          </FormRow>
          <FormCard.Footer
            left={
              <Button type="button" onClick={() => void openGitHub()}>
                Abrir GitHub
              </Button>
            }
            right={
              <Button type="submit" variant="secondary" disabled={!token.trim()}>
                Guardar token
              </Button>
            }
          />
        </FormCard>
      ) : null}
      {!showToken && settings.isSuccess ? (
        <>
          {catalog.error && !rateLimited ? <InlineAlert>{launcherError(catalog.error)}</InlineAlert> : null}
          <ViewToolbar
            query={query}
            onQueryChange={setQuery}
            searchPlaceholder="Buscar app"
            searchAriaLabel="Buscar apps do catálogo"
            view={view}
            onViewChange={(mode) => void changeView(mode)}
            ariaLabel="Barra do catálogo"
            filters={[
              {
                key: 'group',
                label: 'Grupo',
                content: (
                  <FilterDropdown
                    title="Grupo"
                    aria-label="Filtrar por grupo"
                    value={group}
                    onChange={setGroup}
                    options={groups.map((name) => ({ value: name, label: name }))}
                  />
                ),
              },
            ]}
          />
          {view === 'grid' ? (
            <GridView
              items={rows}
              keyField="id"
              loading={listLoading}
              emptyMessage={emptyMessage}
              renderItem={(row) => (
                <CatalogCard
                  row={row}
                  inLibrary={owned.has(row.repository.toLowerCase())}
                  onPrimary={() => primary(row)}
                  actions={catalogActions(row)}
                />
              )}
            />
          ) : (
            <CatalogList
              rows={rows}
              loading={listLoading}
              emptyMessage={emptyMessage}
              owned={owned}
              onPrimary={primary}
              actionsFor={catalogActions}
            />
          )}
        </>
      ) : null}
    </PageShell>
  );
}

function CatalogCard({
  row,
  inLibrary,
  onPrimary,
  actions,
}: {
  row: CatalogRow;
  inLibrary: boolean;
  onPrimary: () => void;
  actions: { label: string; icon: ReactNode; onClick: () => void }[];
}) {
  return (
    <div className={styles.cardHost}>
      <ItemCard
        aria-label={`Adicionar ${row.name}`}
        onClick={onPrimary}
        actions={{
          label: `Ações para ${row.name}`,
          items: actions,
        }}
      >
        <div className={gc.body}>
          <div className={gc.title}>{row.name}</div>
          <div className={gc.sub} title={row.repository}>
            {row.repository}
          </div>
          <div className={gc.meta}>
            <Badge variant="neutral">{row.group}</Badge>
            {inLibrary ? <StatusBadge label="Na biblioteca" tone="success" /> : null}
          </div>
        </div>
      </ItemCard>
    </div>
  );
}

function CatalogList({
  rows,
  loading,
  emptyMessage,
  owned,
  onPrimary,
  actionsFor,
}: {
  rows: CatalogRow[];
  loading: boolean;
  emptyMessage: string;
  owned: Set<string>;
  onPrimary: (row: CatalogRow) => void;
  actionsFor: (row: CatalogRow) => { label: string; icon: ReactNode; onClick: () => void }[];
}) {
  const columns: TableColumn<CatalogRow>[] = [
    {
      key: 'name',
      label: 'APP',
      width: '46%',
      render: (row) => (
        <div className={styles.appLink}>
          <span className={styles.appName}>{row.name}</span>
          <span className={styles.appRef}>{row.repository}</span>
          {owned.has(row.repository.toLowerCase()) ? <StatusBadge label="Na biblioteca" tone="success" /> : null}
        </div>
      ),
    },
    {
      key: 'group',
      label: 'GRUPO',
      render: (row) => <Badge variant="neutral">{row.group}</Badge>,
    },
  ];

  return (
    <DataTable
      loading={loading}
      loadingRows={6}
      columns={columns}
      rows={rows}
      keyField="id"
      onRowClick={onPrimary}
      emptyMessage={emptyMessage}
      rowActions={(row) => (
        <RowActions label={`Ações para ${row.name}`} items={actionsFor(row)} />
      )}
    />
  );
}

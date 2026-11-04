import { Link } from 'react-router-dom';
import { DataTable, type TableColumn } from '@/components/ui/DataTable';
import { RowActions } from '@/components/ui/RowActions';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatDate } from '@/utils';
import { appHref, type AppView } from '@/lib/launcher-api';
import { appStatusMeta, libraryMenu, useLibraryMutations, versionBadge } from './LibraryCard';
import styles from '@/pages/library.module.css';

function formatPlayed(value?: string | null) {
  if (!value) return '-';
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/.exec(value);
  if (!match) return value;
  const [, year, month, day, hh, mm, ss] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), Number(hh), Number(mm), Number(ss)));
  return formatDate(date.toISOString());
}

function AppCell({ app }: { app: AppView }) {
  return (
    <Link to={appHref(app)} className={styles.appLink}>
      <span className={styles.appName}>{app.name}</span>
      <span className={styles.appRef}>{app.repository}</span>
    </Link>
  );
}

function ActionsCell({ app, onPrimary }: { app: AppView; onPrimary: (app: AppView) => void }) {
  const actions = useLibraryMutations();
  return <RowActions label={`Ações para ${app.name}`} items={libraryMenu(app, actions, onPrimary)} />;
}

export function LibraryListView({
  apps,
  loading,
  onPrimary,
  onOpen,
}: {
  apps: AppView[];
  loading?: boolean;
  onPrimary: (app: AppView) => void;
  onOpen: (app: AppView) => void;
}) {
  const columns: TableColumn<AppView>[] = [
    {
      key: 'name',
      label: 'APP',
      width: '38%',
      sortable: true,
      render: (row) => <AppCell app={row} />,
    },
    {
      key: 'status',
      label: 'STATUS',
      render: (row) => {
        const status = appStatusMeta(row.status);
        return (
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
            <StatusBadge label={status.label} tone={status.tone} />
            {row.running ? <StatusBadge label="Em execução" tone="success" /> : null}
          </span>
        );
      },
    },
    {
      key: 'installedVersion',
      label: 'VERSÃO',
      sortable: true,
      render: (row) => {
        const version = versionBadge(row);
        if (!version) return <span className={styles.date}>—</span>;
        return <Badge variant={version.variant}>{version.label}</Badge>;
      },
    },
    {
      key: 'lastPlayed',
      label: 'ÚLTIMO USO',
      sortable: true,
      render: (row) => <span className={styles.date}>{formatPlayed(row.lastPlayed)}</span>,
    },
    {
      key: 'remoteVersion',
      label: 'REMOTA',
      sortable: true,
      render: (row) => <span className={styles.date}>{row.remoteVersion || '-'}</span>,
    },
  ];

  return (
    <DataTable<AppView>
      loading={loading}
      loadingRows={6}
      columns={columns}
      rows={apps}
      keyField="folderName"
      onRowClick={onOpen}
      rowClassName={(row) => (row.running ? styles.running : undefined)}
      rowActions={(row) => <ActionsCell app={row} onPrimary={onPrimary} />}
      emptyMessage="Nenhuma app encontrada"
    />
  );
}

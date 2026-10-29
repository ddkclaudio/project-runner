import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconArrowRight, IconPlus, IconTrash } from '@tabler/icons-react';
import { ItemCard, gridCardStyles as gc } from '@/components/ui/ItemCard';
import { GridView } from '@/components/ui/GridView';
import { ViewToolbar, type ViewMode } from '@/components/ui/ViewToolbar';
import { DataTable, type TableColumn } from '@/components/ui/DataTable';
import { RowActions } from '@/components/ui/RowActions';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormCard, FormRow } from '@/components/ui/FormCard';
import type { ContextMenuItem } from '@/components/ui/ContextMenu';
import type { ServiceAccount } from '@/lib/launcher-api';
import libraryStyles from '@/pages/library.module.css';

export function accountTitle(account: ServiceAccount, accounts: ServiceAccount[]) {
  const label = account.label.trim();
  if (label) return label;
  const blank = accounts.filter((item) => !item.label.trim());
  if (blank.length < 2) return 'Conta';
  return `Conta ${blank.findIndex((item) => item.id === account.id) + 1}`;
}

function tokenReady(account: ServiceAccount) {
  return Boolean(account.token.trim());
}

function accountMenu(title: string, onOpen: () => void, onRemove: () => void): ContextMenuItem[] {
  return [
    { label: 'Abrir', icon: <IconArrowRight size={15} />, onClick: onOpen },
    { label: 'Remover', icon: <IconTrash size={15} />, danger: true, onClick: onRemove },
  ];
}

function AccountCard({
  account,
  title,
  onOpen,
  onRemove,
}: {
  account: ServiceAccount;
  title: string;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const ready = tokenReady(account);
  return (
    <div className={libraryStyles.cardHost}>
      <ItemCard
        aria-label={`Abrir conta ${title}`}
        onClick={onOpen}
        actions={{ label: `Ações para ${title}`, items: accountMenu(title, onOpen, onRemove) }}
      >
        <div className={gc.body}>
          <div className={gc.title}>{title}</div>
          <div className={gc.sub}>{ready ? 'Token configurado' : 'Sem token'}</div>
          <div className={gc.meta}>
            <StatusBadge label={ready ? 'Configurada' : 'Sem token'} tone={ready ? 'success' : 'muted'} />
          </div>
        </div>
      </ItemCard>
    </div>
  );
}

export function AccountLibrary({
  accounts,
  loading,
  basePath,
  emptyMessage,
  onRemove,
}: {
  accounts: ServiceAccount[];
  loading: boolean;
  basePath: string;
  emptyMessage: string;
  onRemove: (account: ServiceAccount) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ViewMode>('grid');
  const needle = query.trim().toLowerCase();
  const visible = accounts.filter((account) => {
    if (!needle) return true;
    return accountTitle(account, accounts).toLowerCase().includes(needle);
  });
  const resolvedEmpty = needle ? 'Nenhuma conta corresponde à busca.' : emptyMessage;

  function openAccount(account: ServiceAccount) {
    navigate(`${basePath}/${account.id}`);
  }

  const columns: TableColumn<ServiceAccount>[] = [
    {
      key: 'label',
      label: 'CONTA',
      width: '70%',
      render: (account) => (
        <div className={libraryStyles.appLink}>
          <span className={libraryStyles.appName}>{accountTitle(account, accounts)}</span>
          <span className={libraryStyles.appRef}>{tokenReady(account) ? 'Token configurado' : 'Sem token'}</span>
        </div>
      ),
    },
    {
      key: 'token',
      label: 'ESTADO',
      render: (account) => (
        <StatusBadge
          label={tokenReady(account) ? 'Configurada' : 'Sem token'}
          tone={tokenReady(account) ? 'success' : 'muted'}
        />
      ),
    },
  ];

  return (
    <>
      <ViewToolbar
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder="Buscar conta"
        searchAriaLabel="Buscar contas"
        view={view}
        onViewChange={setView}
        ariaLabel="Barra de contas"
        rightSlot={
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<IconPlus size={14} />}
            aria-label="Criar nova conta"
            onClick={() => navigate(`${basePath}/new`)}
          >
            Nova conta
          </Button>
        }
      />
      {view === 'grid' ? (
        <GridView
          items={visible}
          keyField="id"
          loading={loading}
          emptyMessage={resolvedEmpty}
          renderItem={(account) => (
            <AccountCard
              account={account}
              title={accountTitle(account, accounts)}
              onOpen={() => openAccount(account)}
              onRemove={() => onRemove(account)}
            />
          )}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={visible}
          keyField="id"
          loading={loading}
          emptyMessage={resolvedEmpty}
          onRowClick={openAccount}
          rowActions={(account) => (
            <RowActions
              label={`Ações para ${accountTitle(account, accounts)}`}
              items={accountMenu(
                accountTitle(account, accounts),
                () => openAccount(account),
                () => onRemove(account),
              )}
            />
          )}
        />
      )}
    </>
  );
}

export function AccountForm({
  mode,
  account,
  hint,
  busy,
  onSubmit,
  onRemove,
}: {
  mode: 'new' | 'edit';
  account?: ServiceAccount;
  hint: string;
  busy: boolean;
  onSubmit: (account: ServiceAccount) => void;
  onRemove?: () => void;
}) {
  const [id] = useState(() => account?.id || crypto.randomUUID());
  const [label, setLabel] = useState(account?.label ?? '');
  const [token, setToken] = useState(account?.token ?? '');
  const tokenOk = Boolean(token.trim());
  const dirty =
    mode === 'edit' &&
    (label.trim() !== (account?.label ?? '').trim() || token.trim() !== (account?.token ?? '').trim());

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!tokenOk || busy) return;
    if (mode === 'edit' && !dirty) return;
    onSubmit({ id, label: label.trim(), token: token.trim() });
  }

  return (
    <FormCard onSubmit={submit} aria-label={mode === 'new' ? 'Nova conta' : 'Conta'}>
      <FormCard.Header title={null} subtitle={hint} />
      <FormRow label="Nome da conta">
        <Input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Trabalho" />
      </FormRow>
      <FormRow label="Token" error={mode === 'edit' && !tokenOk ? 'O token é obrigatório.' : undefined} showErrorText={mode === 'edit' && !tokenOk}>
        <Input
          type="password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          autoComplete="off"
        />
        <FormCard.Hint>O nome aparece na lista. O token fica só nesta conta.</FormCard.Hint>
      </FormRow>
      {mode === 'new' || dirty || onRemove ? (
        <FormCard.Footer
          left={
            mode === 'edit' && onRemove ? (
              <Button type="button" variant="ghost" onClick={onRemove} disabled={busy}>
                Remover
              </Button>
            ) : null
          }
          right={
            mode === 'new' ? (
              <Button type="submit" variant="secondary" disabled={busy || !tokenOk}>
                Adicionar
              </Button>
            ) : dirty && tokenOk ? (
              <Button type="submit" variant="secondary" disabled={busy}>
                Salvar
              </Button>
            ) : null
          }
        />
      ) : null}
    </FormCard>
  );
}

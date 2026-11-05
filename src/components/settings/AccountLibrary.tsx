import { useState, type FormEvent, type ReactNode } from 'react';
import { openUrl } from '@tauri-apps/plugin-opener';
import { Link, useNavigate } from 'react-router-dom';
import { IconArrowRight, IconPlus, IconTrash } from '@tabler/icons-react';
import { ItemCard, gridCardStyles as gc } from '@/components/ui/ItemCard';
import { GridView } from '@/components/ui/GridView';
import { ViewToolbar, type ViewMode } from '@/components/ui/ViewToolbar';
import { DataTable, type TableColumn } from '@/components/ui/DataTable';
import { RowActions } from '@/components/ui/RowActions';
import { StatusBadge, type StatusTone } from '@/components/ui/StatusBadge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormCard, FormRow } from '@/components/ui/FormCard';
import type { ContextMenuItem } from '@/components/ui/ContextMenu';
import { type ServiceAccount } from '@/lib/launcher-api';
import libraryStyles from '@/pages/library.module.css';

export const GITHUB_TOKEN_CREATE_URL = 'https://github.com/settings/tokens/new?description=Project%20Runner';
export const CLOUDFLARE_TOKEN_CREATE_URL = 'https://dash.cloudflare.com/profile/api-tokens';

export function TokenAccountHint({ createUrl }: { createUrl: string }) {
  return (
    <FormCard.Hint>
      O nome aparece na lista. O token fica só nesta conta.{' '}
      <button type="button" className={libraryStyles.linkBtn} onClick={() => void openUrl(createUrl)}>
        Criar token
      </button>
    </FormCard.Hint>
  );
}

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

function entryHref(basePath: string, entry: LibraryEntry) {
  if (entry.kind === 'extra') return entry.extra.href;
  return `${basePath}/${encodeURIComponent(entry.account.id)}`;
}

function OpenLink({ href, className, children }: { href: string; className: string; children: ReactNode }) {
  return (
    <Link to={href} className={className} onClick={(event) => event.stopPropagation()}>
      {children}
    </Link>
  );
}

export type AccountLibraryExtra = {
  id: string;
  title: string;
  subtitle: string;
  badge: string;
  tone: StatusTone;
  href: string;
};

type LibraryEntry =
  | { kind: 'extra'; id: string; extra: AccountLibraryExtra }
  | { kind: 'account'; id: string; account: ServiceAccount };

function accountMenu(title: string, onOpen: () => void, onRemove: () => void): ContextMenuItem[] {
  return [
    { label: 'Abrir', icon: <IconArrowRight size={15} />, onClick: onOpen },
    { label: 'Remover', icon: <IconTrash size={15} />, danger: true, onClick: onRemove },
  ];
}

function AccountCard({
  account,
  title,
  href,
  onOpen,
  onRemove,
}: {
  account: ServiceAccount;
  title: string;
  href: string;
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
        <OpenLink href={href} className={libraryStyles.cardLink}>
          <div className={gc.body}>
            <div className={gc.title}>{title}</div>
            <div className={gc.sub}>{ready ? 'Token configurado' : 'Sem token'}</div>
            <div className={gc.meta}>
              <StatusBadge label={ready ? 'Configurada' : 'Sem token'} tone={ready ? 'success' : 'muted'} />
            </div>
          </div>
        </OpenLink>
      </ItemCard>
    </div>
  );
}

function ExtraCard({ extra, href, onOpen }: { extra: AccountLibraryExtra; href: string; onOpen: () => void }) {
  return (
    <div className={libraryStyles.cardHost}>
      <ItemCard
        aria-label={`Abrir ${extra.title}`}
        onClick={onOpen}
        actions={{ label: `Ações para ${extra.title}`, items: [{ label: 'Abrir', icon: <IconArrowRight size={15} />, onClick: onOpen }] }}
      >
        <OpenLink href={href} className={libraryStyles.cardLink}>
          <div className={gc.body}>
            <div className={gc.title}>{extra.title}</div>
            <div className={gc.sub}>{extra.subtitle}</div>
            <div className={gc.meta}>
              <StatusBadge label={extra.badge} tone={extra.tone} />
            </div>
          </div>
        </OpenLink>
      </ItemCard>
    </div>
  );
}

export function AccountLibrary({
  accounts,
  extras = [],
  loading,
  basePath,
  emptyMessage,
  onRemove,
}: {
  accounts: ServiceAccount[];
  extras?: AccountLibraryExtra[];
  loading: boolean;
  basePath: string;
  emptyMessage: string;
  onRemove: (account: ServiceAccount) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ViewMode>('grid');
  const needle = query.trim().toLowerCase();
  const visibleAccounts = accounts.filter((account) => {
    if (!needle) return true;
    return accountTitle(account, accounts).toLowerCase().includes(needle);
  });
  const visibleExtras = extras.filter((extra) => {
    if (!needle) return true;
    return `${extra.title} ${extra.subtitle}`.toLowerCase().includes(needle);
  });
  const entries: LibraryEntry[] = [
    ...visibleExtras.map((extra) => ({ kind: 'extra' as const, id: extra.id, extra })),
    ...visibleAccounts.map((account) => ({ kind: 'account' as const, id: account.id, account })),
  ];
  const resolvedEmpty = needle ? 'Nenhum item corresponde à busca.' : emptyMessage;

  function openEntry(entry: LibraryEntry) {
    navigate(entryHref(basePath, entry));
  }

  const columns: TableColumn<LibraryEntry>[] = [
    {
      key: 'label',
      label: 'ITEM',
      width: '70%',
      render: (entry) => (
        <OpenLink href={entryHref(basePath, entry)} className={libraryStyles.appLink}>
          {entry.kind === 'extra' ? (
            <>
              <span className={libraryStyles.appName}>{entry.extra.title}</span>
              <span className={libraryStyles.appRef}>{entry.extra.subtitle}</span>
            </>
          ) : (
            <>
              <span className={libraryStyles.appName}>{accountTitle(entry.account, accounts)}</span>
              <span className={libraryStyles.appRef}>{tokenReady(entry.account) ? 'Token configurado' : 'Sem token'}</span>
            </>
          )}
        </OpenLink>
      ),
    },
    {
      key: 'token',
      label: 'ESTADO',
      render: (entry) =>
        entry.kind === 'extra' ? (
          <StatusBadge label={entry.extra.badge} tone={entry.extra.tone} />
        ) : (
          <StatusBadge
            label={tokenReady(entry.account) ? 'Configurada' : 'Sem token'}
            tone={tokenReady(entry.account) ? 'success' : 'muted'}
          />
        ),
    },
  ];

  return (
    <>
      <ViewToolbar
        query={query}
        onQueryChange={setQuery}
        searchPlaceholder={extras.length > 0 ? 'Buscar' : 'Buscar conta'}
        searchAriaLabel={extras.length > 0 ? 'Buscar itens' : 'Buscar contas'}
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
          items={entries}
          keyField="id"
          loading={loading}
          emptyMessage={resolvedEmpty}
          renderItem={(entry) =>
            entry.kind === 'extra' ? (
              <ExtraCard extra={entry.extra} href={entryHref(basePath, entry)} onOpen={() => openEntry(entry)} />
            ) : (
              <AccountCard
                account={entry.account}
                title={accountTitle(entry.account, accounts)}
                href={entryHref(basePath, entry)}
                onOpen={() => openEntry(entry)}
                onRemove={() => onRemove(entry.account)}
              />
            )
          }
        />
      ) : (
        <DataTable
          columns={columns}
          rows={entries}
          keyField="id"
          loading={loading}
          emptyMessage={resolvedEmpty}
          onRowClick={openEntry}
          rowActions={(entry) =>
            entry.kind === 'extra' ? (
              <RowActions
                label={`Ações para ${entry.extra.title}`}
                items={[{ label: 'Abrir', icon: <IconArrowRight size={15} />, onClick: () => openEntry(entry) }]}
              />
            ) : (
              <RowActions
                label={`Ações para ${accountTitle(entry.account, accounts)}`}
                items={accountMenu(
                  accountTitle(entry.account, accounts),
                  () => openEntry(entry),
                  () => onRemove(entry.account),
                )}
              />
            )
          }
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
  githubExtras = false,
  onSubmit,
  onRemove,
}: {
  mode: 'new' | 'edit';
  account?: ServiceAccount;
  hint: string;
  busy: boolean;
  githubExtras?: boolean;
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
    onSubmit({
      id,
      label: label.trim(),
      token: token.trim(),
      updateRepository: (account?.updateRepository ?? '').trim(),
    });
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
        <TokenAccountHint createUrl={githubExtras ? GITHUB_TOKEN_CREATE_URL : CLOUDFLARE_TOKEN_CREATE_URL} />
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

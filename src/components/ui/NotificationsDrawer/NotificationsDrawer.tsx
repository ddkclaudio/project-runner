'use client';

import { useEffect, useMemo, useState } from 'react';
import { IconMailOpened, IconRefresh, IconSearch } from '@tabler/icons-react';
import { Input } from '@/components/ui/Input';
import { FilterDropdown, type FilterOption } from '@/components/ui/FilterDropdown';
import { Skeleton } from '@/components/ui/Skeleton';
import { SideDrawer } from '@/components/ui/SideDrawer';
import { useMinimumLoading } from '@/hooks/useMinimumLoading';
import { cx } from '@/utils';
import type { NotificationItem } from './notifications';
import styles from './NotificationsDrawer.module.css';

interface NotificationsDrawerProps {
  open: boolean;
  onClose: () => void;
  items: NotificationItem[];
  /** When true, shows list skeletons (holds ~500ms via useMinimumLoading) */
  loading?: boolean;
  /** Skeleton row count while loading. Default: 5 */
  loadingCount?: number;
  onItemClick?: (item: NotificationItem) => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  onMarkAllRead?: () => void;
  markingAllRead?: boolean;
}

const FILTER_OPTIONS: FilterOption[] = [
  { value: 'unread', label: 'Não lidos' },
  { value: 'read', label: 'Lidos' },
  { value: 'success', label: 'Sucesso' },
  { value: 'warning', label: 'Alerta' },
  { value: 'info', label: 'Info' },
  { value: 'danger', label: 'Crítico' },
];

function toneClass(tone?: NotificationItem['tone']) {
  if (tone === 'warning') return styles.toneWarning;
  if (tone === 'danger') return styles.toneDanger;
  if (tone === 'info') return styles.toneInfo;
  return styles.toneSuccess;
}

function AlertSkeletonRows({ count }: { count: number }) {
  return (
    <div className={styles.list} role="status" aria-busy="true" aria-label="Carregando alertas">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={styles.card} aria-hidden="true">
          <div className={styles.cardHeader}>
            <Skeleton height={12} width={`${58 + (i % 3) * 10}%`} shape="pill" />
            <Skeleton height={10} width={36} shape="pill" />
          </div>
          <Skeleton.Text lines={2} lastWidth={`${48 + (i % 3) * 14}%`} />
        </div>
      ))}
    </div>
  );
}

export function NotificationsDrawer({
  open,
  onClose,
  items,
  loading = false,
  loadingCount = 5,
  onItemClick,
  onRefresh,
  refreshing = false,
  onMarkAllRead,
  markingAllRead = false,
}: NotificationsDrawerProps) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string | null>('unread');
  const showSkeleton = useMinimumLoading(loading);

  useEffect(() => {
    if (!open) {
      setQuery('');
      // Ao reabrir, volta ao padrão: só não lidos
      setFilter('unread');
    }
  }, [open]);

  const filtered = useMemo(() => {
    let list = items;
    if (filter === 'unread') list = list.filter((i) => i.unread);
    else if (filter === 'read') list = list.filter((i) => !i.unread);
    else if (filter) list = list.filter((i) => i.tone === filter);

    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (i) => i.title.toLowerCase().includes(q) || i.body.toLowerCase().includes(q),
    );
  }, [items, query, filter]);

  const unreadCount = useMemo(() => items.filter((i) => i.unread).length, [items]);

  return (
    <SideDrawer
      open={open}
      onClose={onClose}
      title="Alertas"
      closeLabel="Fechar alertas"
      ariaLabel="Alertas"
    >
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Input
            inputSize="sm"
            leftIcon={<IconSearch size={13} />}
            placeholder="Buscar alerta"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            clearable
            onClear={() => setQuery('')}
            aria-label="Buscar alertas"
            autoComplete="off"
            spellCheck={false}
            disabled={showSkeleton}
          />
        </div>
        <FilterDropdown
          value={filter}
          onChange={setFilter}
          options={FILTER_OPTIONS}
          title="Filtrar alertas"
          aria-label="Filtrar alertas"
        />
        {onMarkAllRead ? (
          <button
            type="button"
            className={styles.markAllBtn}
            onClick={() => onMarkAllRead()}
            disabled={showSkeleton || markingAllRead || unreadCount === 0}
            aria-label="Marcar todas como lidas"
            title="Marcar todas como lidas"
          >
            <IconMailOpened size={14} />
          </button>
        ) : null}
        {onRefresh ? (
          <button
            type="button"
            className={styles.refreshBtn}
            onClick={() => onRefresh()}
            disabled={showSkeleton || refreshing}
            aria-label="Recarregar alertas"
            title="Recarregar"
          >
            <IconRefresh size={14} className={refreshing ? styles.refreshSpin : undefined} />
          </button>
        ) : null}
      </div>

      {showSkeleton ? (
        <AlertSkeletonRows count={loadingCount} />
      ) : (
        <div className={styles.list}>
          {filtered.length === 0 ? (
            <p className={styles.empty}>
              {items.length === 0 ? 'Nenhum alerta no momento.' : 'Nenhum alerta encontrado.'}
            </p>
          ) : (
            filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cx(styles.card, item.unread && styles.cardUnread)}
                onClick={() => onItemClick?.(item)}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.cardMeta}>
                    {item.unread && (
                      <span className={cx(styles.dot, toneClass(item.tone))} aria-hidden="true" />
                    )}
                    <span className={styles.cardTitle}>{item.title}</span>
                  </div>
                  <span className={styles.cardTime}>{item.time}</span>
                </div>
                <p className={styles.cardBody}>{item.body}</p>
              </button>
            ))
          )}
        </div>
      )}
    </SideDrawer>
  );
}

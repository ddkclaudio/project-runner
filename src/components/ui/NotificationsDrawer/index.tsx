'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertButton } from '@/components/ui/AlertButton';
import { NotificationsDrawer } from './NotificationsDrawer';
import { AlertDetailModal, defaultConversationHref } from './AlertDetailModal';
import { DEMO_NOTIFICATIONS, countUnread } from './notifications';
import type { NotificationItem } from './notifications';

export { NotificationsDrawer } from './NotificationsDrawer';
export { AlertDetailModal, defaultConversationHref } from './AlertDetailModal';
export { DEMO_NOTIFICATIONS, countUnread } from './notifications';
export type { NotificationItem } from './notifications';

interface NotificationsMenuProps {
  items?: NotificationItem[];
  className?: string;
  /** Só o botão; o drawer escuta o evento `notifications:open`. */
  triggerOnly?: boolean;
  /** Ex.: fechar o menu lateral mobile antes de abrir o drawer. */
  onBeforeOpen?: () => void;
  /** Contagem do badge; se omitido, usa unread de `items`. */
  unreadCount?: number;
  loading?: boolean;
  onItemOpen?: (item: NotificationItem) => void;
  /** Override do destino "Abrir conversa" no modal. */
  conversationHrefForItem?: (item: NotificationItem) => string | null;
  /** Destino "Abrir análise" (página do membro). */
  analysisHrefForItem?: (item: NotificationItem) => string | null;
  /** Destino "Abrir sugestões" (job IBEN). */
  suggestionsHrefForItem?: (item: NotificationItem) => string | null;
  onRefresh?: () => void;
  refreshing?: boolean;
  onMarkAllRead?: () => void;
  markingAllRead?: boolean;
}

export function NotificationsMenu({
  items = DEMO_NOTIFICATIONS,
  className,
  triggerOnly = false,
  onBeforeOpen,
  unreadCount,
  loading: externalLoading,
  onItemOpen,
  conversationHrefForItem,
  analysisHrefForItem,
  suggestionsHrefForItem,
  onRefresh,
  refreshing,
  onMarkAllRead,
  markingAllRead,
}: NotificationsMenuProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<NotificationItem | null>(null);
  const unread = unreadCount ?? countUnread(items);
  const showLoading = externalLoading ?? loading;

  const openDrawer = useCallback(() => {
    onBeforeOpen?.();
    if (externalLoading === undefined) setLoading(true);
    setOpen(true);
  }, [onBeforeOpen, externalLoading]);

  const closeDrawer = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open || externalLoading !== undefined) return;
    if (!loading) return;
    const id = window.setTimeout(() => setLoading(false), 0);
    return () => window.clearTimeout(id);
  }, [open, loading, externalLoading]);

  useEffect(() => {
    if (triggerOnly) return;
    function onOpenEvent() {
      if (externalLoading === undefined) setLoading(true);
      setOpen(true);
    }
    window.addEventListener('notifications:open', onOpenEvent);
    return () => window.removeEventListener('notifications:open', onOpenEvent);
  }, [triggerOnly, externalLoading]);

  const handleItemClick = useCallback(
    (item: NotificationItem) => {
      setOpen(false);
      setSelected(item);
      onItemOpen?.(item);
    },
    [onItemOpen],
  );

  const chatHref = selected
    ? conversationHrefForItem
      ? conversationHrefForItem(selected)
      : defaultConversationHref(selected)
    : null;
  const analysisHref = selected && analysisHrefForItem ? analysisHrefForItem(selected) : null;
  const suggestionsHref =
    selected && suggestionsHrefForItem ? suggestionsHrefForItem(selected) : null;

  if (triggerOnly) {
    return (
      <AlertButton
        count={unread}
        className={className}
        onClick={() => {
          onBeforeOpen?.();
          window.dispatchEvent(new CustomEvent('notifications:open'));
        }}
      />
    );
  }

  return (
    <>
      <AlertButton count={unread} className={className} onClick={openDrawer} />
      <NotificationsDrawer
        open={open}
        onClose={closeDrawer}
        items={items}
        loading={showLoading}
        onItemClick={handleItemClick}
        onRefresh={onRefresh}
        refreshing={refreshing}
        onMarkAllRead={onMarkAllRead}
        markingAllRead={markingAllRead}
      />
      <AlertDetailModal
        item={selected}
        onClose={() => setSelected(null)}
        conversationHref={chatHref}
        analysisHref={analysisHref}
        suggestionsHref={suggestionsHref}
      />
    </>
  );
}

import type { Ref } from 'react';
import styles from './InfiniteScrollSentinel.module.css';

type Props = {
  sentinelRef: Ref<HTMLDivElement>;
  hasMore?: boolean;
  loadingMore?: boolean;
  loadedCount?: number;
  empty?: boolean;
};

export function InfiniteScrollSentinel({
  sentinelRef,
  hasMore,
  loadingMore,
  loadedCount = 0,
  empty,
}: Props) {
  if (empty) return null;
  return (
    <div ref={sentinelRef} className={styles.sentinel} aria-hidden={!hasMore}>
      {loadingMore ? (
        <p className={styles.text}>Carregando mais…</p>
      ) : hasMore ? (
        <p className={styles.text}>Role para carregar mais</p>
      ) : loadedCount > 0 ? (
        <p className={styles.text}>Fim da lista</p>
      ) : null}
    </div>
  );
}

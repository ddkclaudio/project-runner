import React from 'react';
import { IconLoader2 } from '@tabler/icons-react';
import { PageShell } from '@/components/ui/PageShell';
import { Skeleton } from '@/components/ui/Skeleton';
import { cx } from '@/utils';
import styles from './PageLoading.module.css';

interface PageLoadingProps {
  /** Message for spinner mode / screen readers */
  label?: string;
  /** Use fluid shell (chat / canvas) */
  variant?: 'default' | 'fluid';
  /**
   * `skeleton` (default), tabela ou canvas (sem título/subtítulo).
   * `spinner`, spinner + texto (fallback simples).
   */
  mode?: 'skeleton' | 'spinner';
  className?: string;
}

/** Loading de rota / dynamic import, skeleton só na área de dados. */
export function PageLoading({
  label = 'Carregando…',
  variant = 'default',
  mode = 'skeleton',
  className,
}: PageLoadingProps) {
  if (mode === 'skeleton') {
    return (
      <PageShell
        variant={variant}
        className={cx(variant === 'fluid' && styles.skeletonFluid, className)}
      >
        <span className={styles.srOnly}>{label}</span>
        {variant === 'fluid' ? <Skeleton.Fluid /> : <Skeleton.Table rows={7} cols={4} />}
      </PageShell>
    );
  }

  return (
    <PageShell
      variant={variant}
      className={cx(styles.wrap, variant === 'fluid' && styles.wrapFluid, className)}
    >
      <div className={styles.inner} role="status" aria-live="polite">
        <IconLoader2 size={20} className={styles.spinner} aria-hidden="true" />
        <p className={styles.label}>{label}</p>
      </div>
    </PageShell>
  );
}

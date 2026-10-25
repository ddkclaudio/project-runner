import { cx } from '@/utils';
import styles from './InlineAlert.module.css';

export type InlineAlertVariant = 'error' | 'success' | 'warning' | 'info';

interface InlineAlertProps {
  children: React.ReactNode;
  variant?: InlineAlertVariant;
  className?: string;
  /** Ícone opcional à esquerda (substitui o prefixo padrão de error). */
  icon?: React.ReactNode;
}

/** Alerta compacto inline (forms de auth, feedbacks curtos). */
export function InlineAlert({ children, variant = 'error', className, icon }: InlineAlertProps) {
  return (
    <div className={cx(styles.alert, styles[variant], className)} role="alert">
      {icon != null ? <span className={styles.icon}>{icon}</span> : null}
      <div className={styles.content}>{children}</div>
    </div>
  );
}

import React from 'react';
import { cx } from '@/utils';
import styles from './FormCard.module.css';

interface FormCardProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode;
  className?: string;
  /** Sem borda nem fundo. O painel em volta já é a superfície. */
  plain?: boolean;
}

function FormCardRoot({ children, className, plain, ...props }: FormCardProps) {
  return (
    <form className={cx(styles.card, plain && styles.plain, className)} noValidate {...props}>
      {children}
    </form>
  );
}

function FormCardHeader({
  title,
  subtitle,
  actions,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const hasTitle = title != null && title !== false && title !== '';
  return (
    <div className={styles.header}>
      {hasTitle || actions ? (
        <div className={styles.headerTop}>
          {hasTitle ? <h1 className={styles.title}>{title}</h1> : null}
          {actions ? <div className={styles.headerActions}>{actions}</div> : null}
        </div>
      ) : null}
      {subtitle && <div className={styles.subtitle}>{subtitle}</div>}
    </div>
  );
}

function FormCardAlert({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.alert} role="alert">
      {children}
    </div>
  );
}

interface FormRowProps {
  label: string;
  optionalLabel?: string;
  children: React.ReactNode;
  alignStart?: boolean;
  /** Rótulo acima do valor. Cabe em painéis estreitos. */
  stack?: boolean;
  error?: string;
  /** Mostra o texto de erro abaixo do controle (ex.: Select sem error built-in). */
  showErrorText?: boolean;
}

function FormRow({
  label,
  optionalLabel,
  children,
  alignStart,
  stack,
  error,
  showErrorText = false,
}: FormRowProps) {
  return (
    <div className={cx(styles.row, stack && styles.rowStack, alignStart && styles.rowAlignStart)}>
      <div className={cx(styles.rowLabel, error && styles.rowLabelError)}>
        {label}
        {optionalLabel && <span className={styles.optional}> {optionalLabel}</span>}
      </div>
      <div className={styles.rowControl}>
        {children}
        {showErrorText && error && (
          <p className={styles.fieldError} role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

function FormHint({ children }: { children: React.ReactNode }) {
  return <p className={styles.hint}>{children}</p>;
}

function FormCardFooter({ left, right }: { left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className={styles.footer}>
      {left != null && <div className={styles.footerLeft}>{left}</div>}
      {right != null && <div className={styles.footerRight}>{right}</div>}
    </div>
  );
}

export const FormCard = Object.assign(FormCardRoot, {
  Header: FormCardHeader,
  Alert: FormCardAlert,
  Footer: FormCardFooter,
  Hint: FormHint,
});

export { FormRow };
export type { FormRowProps };

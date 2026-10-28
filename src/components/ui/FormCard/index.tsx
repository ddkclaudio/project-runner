import React from 'react';
import { cx } from '@/utils';
import styles from './FormCard.module.css';

interface FormCardProps extends React.FormHTMLAttributes<HTMLFormElement> {
  children: React.ReactNode;
  className?: string;
}

function FormCardRoot({ children, className, ...props }: FormCardProps) {
  return (
    <form className={cx(styles.card, className)} noValidate {...props}>
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
  return (
    <div className={styles.header}>
      <div className={styles.headerTop}>
        <h1 className={styles.title}>{title}</h1>
        {actions ? <div className={styles.headerActions}>{actions}</div> : null}
      </div>
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
  error?: string;
  /** Mostra o texto de erro abaixo do controle (ex.: Select sem error built-in). */
  showErrorText?: boolean;
}

function FormRow({
  label,
  optionalLabel,
  children,
  alignStart,
  error,
  showErrorText = false,
}: FormRowProps) {
  return (
    <div className={cx(styles.row, alignStart && styles.rowAlignStart)}>
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

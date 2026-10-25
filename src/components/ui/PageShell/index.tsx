import React from 'react';
import { cx } from '@/utils';
import styles from './PageShell.module.css';

/* ── Root ──────────────────────────────────────────────────────────────────── */
interface PageShellProps {
  children: React.ReactNode;
  className?: string;
  /**
   * `default`, largura --page-max-width, centralizado (settings, listas, forms).
   * `fluid`, 100% largura/altura (chat, canvas de agentes).
   */
  variant?: 'default' | 'fluid';
  /** Optional width override (default variant only). */
  maxWidth?: string | number;
}

function PageShell({ children, className, variant = 'default', maxWidth }: PageShellProps) {
  const style =
    variant === 'default' && maxWidth != null
      ? { maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth }
      : undefined;

  return (
    <div className={cx(styles.shell, variant === 'fluid' && styles.fluid, className)} style={style}>
      {children}
    </div>
  );
}

/* ── Heading ───────────────────────────────────────────────────────────────── */
interface HeadingProps {
  children: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Optional leading icon (e.g. memoria) */
  icon?: React.ReactNode;
  id?: string;
  actions?: React.ReactNode;
}

function Heading({ children, subtitle, icon, id, actions }: HeadingProps) {
  return (
    <div className={styles.headingRow}>
      <div className={styles.headingMain}>
        {icon ? <div className={styles.headingIcon}>{icon}</div> : null}
        <div className={styles.headingText}>
          <h1 id={id} className={styles.heading}>
            {children}
          </h1>
          {subtitle != null && subtitle !== '' && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
      </div>
      {actions && <div className={styles.headingActions}>{actions}</div>}
    </div>
  );
}

/* ── Section ───────────────────────────────────────────────────────────────── */
interface SectionProps {
  children: React.ReactNode;
  className?: string;
  /** Visually hidden section label for screen readers */
  label?: string;
  labelId?: string;
}

function Section({ children, className, label, labelId }: SectionProps) {
  return (
    <section className={cx(styles.section, className)} aria-label={label} aria-labelledby={labelId}>
      {children}
    </section>
  );
}

/* ── Toolbar ───────────────────────────────────────────────────────────────── */
interface ToolbarProps {
  left?: React.ReactNode;
  right?: React.ReactNode;
}

function Toolbar({ left, right }: ToolbarProps) {
  return (
    <div className={styles.toolbar}>
      {left && <div className={styles.toolbarLeft}>{left}</div>}
      {right && <div className={styles.toolbarRight}>{right}</div>}
    </div>
  );
}

/* ── Divider ───────────────────────────────────────────────────────────────── */
function Divider() {
  return <hr className={styles.divider} aria-hidden="true" />;
}

/* ── Compose ───────────────────────────────────────────────────────────────── */
PageShell.Heading = Heading;
PageShell.Section = Section;
PageShell.Toolbar = Toolbar;
PageShell.Divider = Divider;

export { PageShell };

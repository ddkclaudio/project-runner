import { cx } from '@/utils';
import styles from './Topbar.module.css';

interface TopbarHideProps {
  /** Oculta a partir deste breakpoint (e menores). */
  below: 'tablet' | 'mobile';
  children: React.ReactNode;
  className?: string;
  as?: 'span' | 'div';
}

/** Wrapper de responsividade do topbar (esconde em tablet ou mobile). */
export function TopbarHide({ below, children, className, as: Tag = 'span' }: TopbarHideProps) {
  return (
    <Tag className={cx(below === 'tablet' ? styles.hideOnTablet : styles.hideOnMobile, className)}>
      {children}
    </Tag>
  );
}

interface TopbarBreadcrumbProps {
  children: React.ReactNode;
  className?: string;
}

/** Agrupa o breadcrumb desktop (oculto no mobile). */
export function TopbarBreadcrumb({ children, className }: TopbarBreadcrumbProps) {
  return <span className={cx(styles.desktopBreadcrumb, className)}>{children}</span>;
}

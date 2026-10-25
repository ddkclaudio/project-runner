import Link from 'next/link';
import { cx } from '@/utils';
import styles from './Topbar.module.css';

interface TopbarCrumbProps {
  children: React.ReactNode;
  active?: boolean;
  href?: string;
  onClick?: () => void;
  className?: string;
}

/** Item de breadcrumb estático ou clicável no topbar. */
export function TopbarCrumb({
  children,
  active = false,
  href,
  onClick,
  className,
}: TopbarCrumbProps) {
  const classNames = cx(
    styles.crumb,
    active && styles.crumbActive,
    (href || onClick) && styles.crumbInteractive,
    className,
  );

  if (href) {
    return (
      <Link href={href} className={classNames} onClick={onClick}>
        {children}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" className={classNames} onClick={onClick}>
        {children}
      </button>
    );
  }

  return <div className={classNames}>{children}</div>;
}

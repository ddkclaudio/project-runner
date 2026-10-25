import Link from 'next/link';
import { cx } from '@/utils';
import styles from './TextLink.module.css';

export type TextLinkVariant = 'default' | 'muted' | 'primary';

interface TextLinkBaseProps {
  children: React.ReactNode;
  variant?: TextLinkVariant;
  className?: string;
  /** Abre em nova aba quando for URL externa. */
  external?: boolean;
}

type TextLinkProps = TextLinkBaseProps &
  ({ href: string; onClick?: never } | { href?: undefined; onClick?: () => void });

/** Link inline de texto (ex.: hints de formulário: “os planos”). */
export function TextLink({
  children,
  variant = 'default',
  className,
  external,
  href,
  onClick,
}: TextLinkProps) {
  const classNames = cx(styles.link, styles[variant], className);

  if (href) {
    const isExternal = external || /^https?:\/\//.test(href);
    if (isExternal) {
      return (
        <a href={href} className={classNames} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    }
    return (
      <Link href={href} className={classNames}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" className={classNames} onClick={onClick}>
      {children}
    </button>
  );
}

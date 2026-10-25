import { cx } from '@/utils';
import styles from './AuthCard.module.css';

interface AuthCardProps {
  children: React.ReactNode;
  className?: string;
  /** Largura máxima do card (default 400). */
  maxWidth?: number | string;
}

function AuthCardRoot({ children, className, maxWidth = 400 }: AuthCardProps) {
  return (
    <div
      className={cx(styles.card, className)}
      style={{ maxWidth: typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth }}
    >
      {children}
    </div>
  );
}

function AuthCardHeader({
  brand,
  title,
  subtitle,
}: {
  brand?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <div className={styles.header}>
      {brand != null && <div className={styles.brandSlot}>{brand}</div>}
      <h1 className={styles.title}>{title}</h1>
      {subtitle != null && <p className={styles.subtitle}>{subtitle}</p>}
    </div>
  );
}

type AuthCardBodyDivProps = {
  as?: 'div';
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLDivElement>;

type AuthCardBodyFormProps = {
  as: 'form';
  children: React.ReactNode;
  className?: string;
} & React.FormHTMLAttributes<HTMLFormElement>;

type AuthCardBodyProps = AuthCardBodyDivProps | AuthCardBodyFormProps;

function AuthCardBody(props: AuthCardBodyProps) {
  const { children, className } = props;
  if (props.as === 'form') {
    const { as: _as, children: _c, className: _cl, ...formProps } = props;
    return (
      <form className={cx(styles.body, className)} noValidate {...formProps}>
        {children}
      </form>
    );
  }
  const { as: _as, children: _c, className: _cl, ...divProps } = props;
  return (
    <div className={cx(styles.body, className)} {...divProps}>
      {children}
    </div>
  );
}

function AuthCardHint({ children }: { children: React.ReactNode }) {
  return <p className={styles.hint}>{children}</p>;
}

export const AuthCard = Object.assign(AuthCardRoot, {
  Header: AuthCardHeader,
  Body: AuthCardBody,
  Hint: AuthCardHint,
});

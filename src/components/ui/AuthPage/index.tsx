import { cx } from '@/utils';
import styles from './AuthPage.module.css';

interface AuthPageProps {
  children: React.ReactNode;
  className?: string;
}

/** Shell full-viewport centralizado (login, register, etc.). */
export function AuthPage({ children, className }: AuthPageProps) {
  return <div className={cx(styles.page, className)}>{children}</div>;
}

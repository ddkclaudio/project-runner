import React from 'react';
import styles from './Button.module.css';
import { cx } from '@/utils';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loading?: boolean;
}

export function Button({
  variant = 'secondary',
  size = 'sm',
  leftIcon,
  rightIcon,
  loading,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cx(styles.btn, styles[variant], styles[size], className)}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading ? (
        <span className={styles.spinner} aria-hidden="true" />
      ) : (
        leftIcon && <span className={styles.icon}>{leftIcon}</span>
      )}
      {children && <span>{children}</span>}
      {rightIcon && !loading && <span className={styles.icon}>{rightIcon}</span>}
    </button>
  );
}

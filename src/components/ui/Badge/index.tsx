import React from 'react';
import styles from './Badge.module.css';
import { cx } from '@/utils';

type BadgeVariant = 'nano' | 'large' | 'green' | 'amber' | 'neutral' | 'new';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'neutral', className }: BadgeProps) {
  return <span className={cx(styles.badge, styles[variant], className)}>{children}</span>;
}

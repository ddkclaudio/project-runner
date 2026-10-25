import React from 'react';
import { IconAlertTriangle } from '@tabler/icons-react';
import { cx } from '@/utils';
import styles from './DangerZone.module.css';

export type DangerZoneProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
};

export function DangerZone({ title, description, action, icon, className }: DangerZoneProps) {
  return (
    <div className={cx(styles.panel, className)} role="region" aria-label="Zona de perigo">
      <div className={styles.iconWrap}>
        {icon ?? <IconAlertTriangle size={18} aria-hidden="true" />}
      </div>
      <div className={styles.body}>
        <div className={styles.title}>{title}</div>
        {description != null && description !== '' && (
          <p className={styles.description}>{description}</p>
        )}
        {action != null && <div className={styles.action}>{action}</div>}
      </div>
    </div>
  );
}

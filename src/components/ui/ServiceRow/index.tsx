import React from 'react';
import { cx } from '@/utils';
import styles from './ServiceRow.module.css';

export type ServiceRowProps = {
  icon?: React.ReactNode;
  title: React.ReactNode;
  detail?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

export function ServiceRow({ icon, title, detail, action, className }: ServiceRowProps) {
  return (
    <div className={cx(styles.row, className)}>
      <div className={styles.left}>
        {icon != null && <div className={styles.icon}>{icon}</div>}
        <div className={styles.text}>
          <div className={styles.title}>{title}</div>
          {detail != null && detail !== '' && <div className={styles.detail}>{detail}</div>}
        </div>
      </div>
      {action != null && <div className={styles.action}>{action}</div>}
    </div>
  );
}

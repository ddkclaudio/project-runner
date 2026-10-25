import React from 'react';
import styles from './CommandGroup.module.css';

export interface CommandGroupProps {
  label: string;
  children: React.ReactNode;
}

export function CommandGroup({ label, children }: CommandGroupProps) {
  return (
    <div className={styles.group} role="group" aria-label={label}>
      <div className={styles.label} aria-hidden="true">
        {label}
      </div>
      {children}
    </div>
  );
}

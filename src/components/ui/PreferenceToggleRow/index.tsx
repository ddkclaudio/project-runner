'use client';

import React from 'react';
import { cx } from '@/utils';
import { Toggle } from '@/components/ui/Toggle';
import { Kbd } from '@/components/ui/Kbd';
import styles from './PreferenceToggleRow.module.css';

export type PreferenceToggleRowProps = {
  title: React.ReactNode;
  description?: React.ReactNode;
  keys?: string[];
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  id?: string;
};

export function PreferenceToggleRow({
  title,
  description,
  keys,
  checked,
  onChange,
  className,
  id,
}: PreferenceToggleRowProps) {
  return (
    <div className={cx(styles.row, className)}>
      <div className={styles.text}>
        <div className={styles.title}>{title}</div>
        {description != null && description !== '' && (
          <p className={styles.description}>{description}</p>
        )}
      </div>
      <div className={styles.right}>
        {keys && keys.length > 0 && (
          <span className={styles.keys}>
            {keys.map((k) => (
              <Kbd key={k}>{k}</Kbd>
            ))}
          </span>
        )}
        <Toggle
          id={id}
          checked={checked}
          onChange={onChange}
          aria-label={typeof title === 'string' ? title : undefined}
        />
      </div>
    </div>
  );
}

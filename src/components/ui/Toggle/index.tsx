'use client';

import React from 'react';
import { cx } from '@/utils';
import styles from './Toggle.module.css';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
  'aria-label'?: string;
  className?: string;
}

export function Toggle({ checked, onChange, id, 'aria-label': ariaLabel, className }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      className={cx(styles.toggle, checked ? styles.toggleOn : '', className)}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.toggleThumb} />
    </button>
  );
}

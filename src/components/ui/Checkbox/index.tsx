'use client';

import React from 'react';
import { IconCheck } from '@tabler/icons-react';
import styles from './Checkbox.module.css';
import { cx } from '@/utils';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children?: React.ReactNode;
  className?: string;
  id?: string;
  disabled?: boolean;
}

export function Checkbox({ checked, onChange, children, className, id, disabled }: CheckboxProps) {
  return (
    <label className={cx(styles.wrapper, className, disabled && styles.disabled)}>
      <button
        type="button"
        role="checkbox"
        id={id}
        aria-checked={checked}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        className={cx(styles.box, checked ? styles.checked : '')}
        onClick={(e) => {
          e.preventDefault();
          if (disabled) return;
          onChange(!checked);
        }}
      >
        {checked && <IconCheck size={11} color="currentColor" strokeWidth={3} />}
      </button>
      {children && <span className={styles.content}>{children}</span>}
    </label>
  );
}

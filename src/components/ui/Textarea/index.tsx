import React from 'react';
import { IconX } from '@tabler/icons-react';
import styles from './Textarea.module.css';
import { cx } from '@/utils';

export type TextareaSize = 'sm' | 'md' | 'lg';
export type TextareaVariant = 'default' | 'ghost';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hint?: string;
  label?: string;
  error?: string;
  textareaSize?: TextareaSize;
  variant?: TextareaVariant;
  clearable?: boolean;
  onClear?: () => void;
  rightIcon?: React.ReactNode;
  onRightIconClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  rightIconLabel?: string;
  /** Cluster of action buttons inside the field (replaces single rightIcon when set). */
  rightActions?: React.ReactNode;
  isDirty?: boolean;
}

export function Textarea({
  hint,
  label,
  error,
  textareaSize = 'md',
  variant = 'default',
  clearable = false,
  onClear,
  rightIcon,
  onRightIconClick,
  rightIconLabel,
  rightActions,
  isDirty = false,
  className,
  id,
  value,
  ...props
}: TextareaProps) {
  const textareaId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const showClear = clearable && value != null && String(value).length > 0;
  const hasRightAffordance = showClear || rightIcon != null || rightActions != null;

  return (
    <div className={styles.wrapper}>
      {label && (
        <label htmlFor={textareaId} className={styles.label}>
          {label}
        </label>
      )}
      <div className={cx(styles.textareaWrap, error ? styles.hasError : '')}>
        <textarea
          id={textareaId}
          value={value}
          className={cx(
            styles.textarea,
            styles[textareaSize],
            styles[variant],
            hasRightAffordance
              ? rightActions != null
                ? styles.withRightActions
                : styles.withRightIcon
              : '',
            isDirty ? styles.dirty : '',
            className,
          )}
          {...props}
        />
        {showClear ? (
          <button
            type="button"
            className={styles.rightBtn}
            onClick={onClear}
            aria-label="Limpar"
            tabIndex={0}
          >
            <IconX size={14} />
          </button>
        ) : rightActions != null ? (
          <div className={styles.rightActions}>{rightActions}</div>
        ) : rightIcon != null ? (
          onRightIconClick ? (
            <button
              type="button"
              className={styles.rightBtn}
              onClick={onRightIconClick}
              aria-label={rightIconLabel ?? 'Ação'}
            >
              {rightIcon}
            </button>
          ) : (
            <span className={cx(styles.rightBtn, styles.rightStatic)} aria-hidden="true">
              {rightIcon}
            </span>
          )
        ) : null}
      </div>
      {hint && !error && <p className={styles.hint}>{hint}</p>}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

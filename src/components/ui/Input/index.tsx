import React from 'react';
import { IconX } from '@tabler/icons-react';
import styles from './Input.module.css';
import { cx } from '@/utils';

export type InputSize = 'sm' | 'md' | 'lg';
export type InputVariant = 'default' | 'ghost';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  hint?: string;
  label?: string;
  /** Conteúdo à direita do label (ex.: link “Esqueci minha senha”). */
  labelAction?: React.ReactNode;
  error?: string;
  inputSize?: InputSize;
  variant?: InputVariant;
  /** Exibe um botão de limpar (X) quando o campo tem valor e chama onClear ao clicar. */
  clearable?: boolean;
  onClear?: () => void;
  /** Ícone de ação à direita (ex.: sugestão de IA). Se informado, exibe um botão; combine com onRightIconClick. */
  rightIcon?: React.ReactNode;
  onRightIconClick?: () => void;
  /** Rótulo de acessibilidade para o botão do rightIcon. */
  rightIconLabel?: string;
  /** Cluster of action buttons inside the field (replaces single rightIcon when set). */
  rightActions?: React.ReactNode;
  /**
   * Quando `true`, aplica borda âmbar ao input para sinalizar que o valor
   * foi editado pelo usuário mas ainda não salvo. Independe do estado de foco.
   */
  isDirty?: boolean;
}

export function Input({
  leftIcon,
  hint,
  label,
  labelAction,
  error,
  inputSize = 'md',
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
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
  const showClear = clearable && value != null && String(value).length > 0;
  const hasRightAffordance = showClear || rightIcon != null || rightActions != null;
  const showLabelRow = Boolean(label) || labelAction != null;

  return (
    <div className={styles.wrapper}>
      {showLabelRow && (
        <div className={styles.labelRow}>
          {label ? (
            <label htmlFor={inputId} className={styles.label}>
              {label}
            </label>
          ) : (
            <span className={styles.labelSpacer} />
          )}
          {labelAction ? <div className={styles.labelAction}>{labelAction}</div> : null}
        </div>
      )}
      <div className={cx(styles.inputWrap, error ? styles.hasError : '')}>
        {leftIcon && <span className={styles.icon}>{leftIcon}</span>}
        <input
          id={inputId}
          value={value}
          className={cx(
            styles.input,
            styles[inputSize],
            styles[variant],
            leftIcon ? styles.withIcon : '',
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

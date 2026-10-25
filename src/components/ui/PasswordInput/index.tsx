'use client';

import { useState } from 'react';
import { IconEye, IconEyeOff } from '@tabler/icons-react';
import { Input, type InputProps } from '@/components/ui/Input';
import styles from './PasswordInput.module.css';

export type PasswordToggleStyle = 'icon' | 'text';

export type PasswordInputProps = Omit<
  InputProps,
  'type' | 'rightIcon' | 'onRightIconClick' | 'rightIconLabel'
> & {
  /** Aparência do botão mostrar/ocultar. Default: `icon`. */
  toggleStyle?: PasswordToggleStyle;
  /** Visibilidade inicial da senha. */
  defaultVisible?: boolean;
};

/**
 * Especialização de `Input` com toggle mostrar/ocultar.
 * Reusa label / labelAction / leftIcon / error do Input, sem duplicar markup.
 */
export function PasswordInput({
  toggleStyle = 'icon',
  defaultVisible = false,
  label = 'Senha',
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(defaultVisible);
  const toggleLabel = visible ? 'Ocultar senha' : 'Mostrar senha';

  const rightIcon =
    toggleStyle === 'text' ? (
      <span className={styles.toggleText}>{visible ? 'ocultar' : 'mostrar'}</span>
    ) : visible ? (
      <IconEyeOff size={15} />
    ) : (
      <IconEye size={15} />
    );

  return (
    <Input
      {...props}
      label={label}
      type={visible ? 'text' : 'password'}
      rightIcon={rightIcon}
      onRightIconClick={() => setVisible((v) => !v)}
      rightIconLabel={toggleLabel}
    />
  );
}

'use client';

import React, { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from '@tabler/icons-react';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { cx } from '@/utils';
import styles from './Modal.module.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  icon?: React.ReactNode;
  leftBorderColor?: string;
  ariaLabelledBy?: string;
  children: React.ReactNode;
  className?: string;
  /** Override max-width (default 600px). Use e.g. '760px' for wide modals. */
  maxWidth?: string | number;
  /** Ações no header, à esquerda do botão Fechar. */
  headerActions?: React.ReactNode;
}

function ModalRoot({
  isOpen,
  onClose,
  title,
  icon,
  leftBorderColor,
  ariaLabelledBy = 'modal-title',
  children,
  className,
  maxWidth,
  headerActions,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className={cx(styles.modal, className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        style={maxWidth ? { maxWidth } : undefined}
      >
        <div
          className={styles.header}
          style={leftBorderColor ? { borderLeft: `3px solid ${leftBorderColor}` } : undefined}
        >
          <div className={styles.titleWrap}>
            {icon && <span className={styles.icon}>{icon}</span>}
            <span id={ariaLabelledBy} className={styles.title}>
              {title}
            </span>
          </div>
          <div className={styles.headerActions}>
            {headerActions}
            <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Fechar">
              <IconX size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}

function ModalContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx(styles.content, className)}>{children}</div>;
}

function ModalFooter({
  children,
  className,
  align = 'end',
}: {
  children: React.ReactNode;
  className?: string;
  /** Alinhamento dos botões. Default: end (direita). */
  align?: 'start' | 'end' | 'between';
}) {
  return (
    <div
      className={cx(
        styles.footer,
        align === 'start' && styles.footerStart,
        align === 'between' && styles.footerBetween,
        className,
      )}
    >
      {children}
    </div>
  );
}

function ModalText({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cx(styles.text, className)}>{children}</p>;
}

function ModalHint({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cx(styles.hint, className)}>{children}</p>;
}

function ModalField({
  label,
  children,
  required,
  optional,
  htmlFor,
  error,
  errorInfo,
  info,
  action,
  className,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  /** Mostra “opcional” ao lado do label (quando não é required). */
  optional?: boolean;
  htmlFor?: string;
  error?: string;
  /** Tooltip ao lado da mensagem de erro (ex.: o que criar na EAP). */
  errorInfo?: string;
  /** Explicação do campo, vira ícone de info com tooltip ao lado do label. */
  info?: string;
  /** Ação extra na linha do label (ex.: ícone de IA), ao lado do info. */
  action?: React.ReactNode;
  className?: string;
}) {
  const autoId = useId();
  const controlId = htmlFor ?? autoId;

  const control = (() => {
    if (!React.isValidElement(children)) return children;
    const child = children as React.ReactElement<{ id?: string; 'aria-invalid'?: boolean }>;
    return React.cloneElement(child, {
      id: child.props.id ?? controlId,
      'aria-invalid': error ? true : child.props['aria-invalid'],
    });
  })();

  return (
    <div className={cx(styles.field, className)}>
      <div className={styles.labelRow}>
        <label
          htmlFor={controlId}
          className={cx(styles.label, required && styles.labelRequired, error && styles.labelError)}
        >
          {label}
          {optional && !required ? <span className={styles.optional}> opcional</span> : null}
        </label>
        {info ? (
          <InfoTooltip text={info} aria-label={`Sobre ${label}`} iconSize={13} />
        ) : null}
        {action}
      </div>
      {control}
      {error ? (
        <p className={styles.fieldError} role="alert">
          <span>{error}</span>
          {errorInfo ? (
            <InfoTooltip
              text={errorInfo}
              aria-label="O que criar na EAP"
              iconSize={13}
              className={styles.fieldErrorInfo}
            />
          ) : null}
        </p>
      ) : null}
    </div>
  );
}

function ModalFieldRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx(styles.fieldRow, className)}>{children}</div>;
}

export const Modal = Object.assign(ModalRoot, {
  Content: ModalContent,
  Footer: ModalFooter,
  Text: ModalText,
  Hint: ModalHint,
  Field: ModalField,
  FieldRow: ModalFieldRow,
});

export type { ModalProps };

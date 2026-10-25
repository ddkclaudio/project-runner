'use client';

import React, { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IconInfoCircle } from '@tabler/icons-react';
import { useTooltip } from '@/hooks/useTooltip';
import { cx } from '@/utils';
import styles from './InfoTooltip.module.css';

interface InfoTooltipProps {
  /** Texto explicativo exibido no hover. */
  text: string;
  /** Rótulo de acessibilidade do botão. */
  'aria-label'?: string;
  className?: string;
  /** Tamanho do ícone. Default: 14. */
  iconSize?: number;
}

/**
 * Ícone de info com tooltip no hover, mesmo padrão de trigger do PricingTooltip
 * (`useTooltip` + IconInfoCircle).
 */
export function InfoTooltip({
  text,
  'aria-label': ariaLabel = 'Mais informações',
  className,
  iconSize = 14,
}: InfoTooltipProps) {
  const { isVisible, show, scheduleHide, cancelHide } = useTooltip();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!isVisible) return;

    function place() {
      const tip = tooltipRef.current;
      const trigger = triggerRef.current;
      if (!tip || !trigger) return;

      const pad = 12;
      const gap = 8;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(280, window.innerWidth - pad * 2);
      tip.style.width = `${width}px`;

      let left = rect.left;
      if (left + width > window.innerWidth - pad) {
        left = window.innerWidth - pad - width;
      }
      if (left < pad) left = pad;

      const height = tip.offsetHeight;
      let top = rect.bottom + gap;
      if (top + height > window.innerHeight - pad) {
        top = Math.max(pad, rect.top - height - gap);
      }

      tip.style.left = `${left}px`;
      tip.style.top = `${top}px`;
    }

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [isVisible, text]);

  if (!text.trim()) return null;

  return (
    <span className={cx(styles.wrapper, className)}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        onFocus={show}
        onBlur={scheduleHide}
        aria-label={ariaLabel}
        aria-expanded={isVisible}
      >
        <IconInfoCircle size={iconSize} aria-hidden="true" />
      </button>

      {isVisible
        ? createPortal(
            <div
              ref={tooltipRef}
              className={styles.tooltip}
              role="tooltip"
              onMouseEnter={cancelHide}
              onMouseLeave={scheduleHide}
            >
              {text}
            </div>,
            document.body,
          )
        : null}
    </span>
  );
}

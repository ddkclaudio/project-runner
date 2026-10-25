'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTooltip } from '@/hooks/useTooltip';
import { cx } from '@/utils';
import styles from './OverflowText.module.css';

interface OverflowTextProps {
  children: string;
  className?: string;
  /** Atraso (ms) antes de mostrar o tooltip quando o texto cortou. */
  showDelay?: number;
  /**
   * Texto completo do tooltip. Se for diferente de `children` (corte por
   * caracteres), o tooltip aparece mesmo sem overflow de CSS.
   */
  tooltipText?: string;
}

function isTruncated(el: HTMLElement) {
  return el.scrollWidth > el.clientWidth + 1;
}

function isCharClipped(displayed: string, full?: string) {
  return typeof full === 'string' && full !== displayed;
}

/**
 * Texto em uma linha com reticências. Tooltip do valor completo só aparece
 * quando o texto realmente cortou (overflow de CSS ou corte por caracteres),
 * portaled no `body` para não ficar atrás de tabela, card ou drawer
 * (`overflow: hidden`).
 */
export function OverflowText({
  children,
  className,
  showDelay = 0,
  tooltipText,
}: OverflowTextProps) {
  const textRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const showTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isVisible, show, hide, scheduleHide } = useTooltip();
  const [overflows, setOverflows] = useState(false);
  const tip = tooltipText ?? children;

  function clearShowTimer() {
    if (showTimerRef.current) {
      clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
  }

  useEffect(
    () => () => {
      if (showTimerRef.current) clearTimeout(showTimerRef.current);
    },
    [],
  );

  function onEnter() {
    const el = textRef.current;
    const cut = isCharClipped(children, tooltipText) || (!!el && isTruncated(el));
    setOverflows(cut);
    clearShowTimer();
    if (!cut) {
      hide();
      return;
    }
    if (showDelay > 0) {
      showTimerRef.current = setTimeout(() => show(), showDelay);
      return;
    }
    show();
  }

  function onLeave() {
    clearShowTimer();
    scheduleHide();
  }

  useLayoutEffect(() => {
    if (!isVisible || !overflows) return;

    function place() {
      const tipEl = tooltipRef.current;
      const trigger = textRef.current;
      if (!tipEl || !trigger) return;

      const pad = 12;
      const gap = 8;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(360, window.innerWidth - pad * 2);
      tipEl.style.width = `${width}px`;

      let left = rect.left;
      if (left + width > window.innerWidth - pad) {
        left = window.innerWidth - pad - width;
      }
      if (left < pad) left = pad;

      const height = tipEl.offsetHeight;
      let top = rect.bottom + gap;
      if (top + height > window.innerHeight - pad) {
        top = Math.max(pad, rect.top - height - gap);
      }

      tipEl.style.left = `${left}px`;
      tipEl.style.top = `${top}px`;
    }

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [isVisible, overflows, children, tip]);

  return (
    <>
      <span
        ref={textRef}
        className={cx(styles.text, className)}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
      >
        {children}
      </span>
      {isVisible && overflows
        ? createPortal(
            <div ref={tooltipRef} className={styles.tooltip} role="tooltip">
              {tip}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}

'use client';

import React, { useLayoutEffect, useRef } from 'react';
import { IconInfoCircle, IconCheck, IconMinus } from '@tabler/icons-react';
import { useTooltip } from '@/hooks/useTooltip';
import { formatCurrency } from '@/utils';
import styles from './PricingTooltip.module.css';

export interface PricingTooltipFeature {
  id: string;
  label: string;
  active: boolean;
  detail?: string;
}

interface PricingTooltipProps {
  planLabel: string;
  planPrice: number;
  features: PricingTooltipFeature[];
  description?: string;
  totalSub?: string;
  'aria-label'?: string;
}

export function PricingTooltip({
  planLabel,
  planPrice,
  features,
  description = 'O custo mensal do projeto é determinado pelo plano selecionado e pelas funcionalidades ativadas.',
  totalSub = 'Cobrança mensal por projeto',
  'aria-label': ariaLabel = 'Ver detalhes do plano',
}: PricingTooltipProps) {
  const { isVisible, show, hide, scheduleHide, cancelHide } = useTooltip();
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
      const width = Math.min(340, window.innerWidth - pad * 2);
      tip.style.width = `${width}px`;

      let left = rect.right - width;
      if (left < pad) left = pad;
      if (left + width > window.innerWidth - pad) {
        left = window.innerWidth - pad - width;
      }

      const height = tip.offsetHeight;
      let top = rect.top - height - gap;
      if (top < pad) {
        top = rect.bottom + gap;
      }
      if (top + height > window.innerHeight - pad) {
        top = Math.max(pad, window.innerHeight - pad - height);
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
  }, [isVisible, features, planLabel, planPrice]);

  function toggle() {
    if (isVisible) hide();
    else show();
  }

  return (
    <span className={styles.wrapper}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        onMouseEnter={show}
        onMouseLeave={scheduleHide}
        onClick={toggle}
        aria-label={ariaLabel}
        aria-expanded={isVisible}
        aria-haspopup="dialog"
      >
        <IconInfoCircle size={15} aria-hidden="true" />
      </button>

      {isVisible && (
        <div
          ref={tooltipRef}
          className={styles.tooltip}
          role="dialog"
          aria-label="Detalhes do plano"
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
        >
          <p className={styles.description}>{description}</p>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>FUNCIONALIDADE</th>
                <th>DETALHE</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {features.map((r) => (
                <tr key={r.id}>
                  <td>{r.label}</td>
                  <td className={styles.featureDetail}>{r.detail ?? '-'}</td>
                  <td className={styles.featureStatus}>
                    {r.active ? (
                      <IconCheck size={13} className={styles.iconOn} aria-label="ativo" />
                    ) : (
                      <IconMinus size={13} className={styles.iconOff} aria-label="inativo" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tbody>
              <tr className={styles.totalRow}>
                <td>
                  <strong className={styles.totalLabel}>Plano {planLabel}</strong>
                  <p className={styles.totalSub}>{totalSub}</p>
                </td>
                <td className={styles.totalValue}>
                  {planPrice === 0 ? 'Gratuito' : formatCurrency(planPrice)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </span>
  );
}

'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconFilter } from '@tabler/icons-react';
import { useDropdown } from '@/hooks/useDropdown';
import { cx } from '@/utils';
import styles from './FilterDropdown.module.css';

export interface FilterOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number | string;
}

export interface FilterSection {
  id: string;
  title: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: FilterOption[];
  /** Se false, clicar na opção já selecionada não limpa. Default true. */
  clearable?: boolean;
}

interface FilterDropdownProps {
  /** Modo simples: uma lista de opções. */
  value?: string | null;
  onChange?: (value: string | null) => void;
  options?: FilterOption[];
  /** Modo seções: várias listas no mesmo dropdown (ex.: status + ordenação). */
  sections?: FilterSection[];
  title?: string;
  'aria-label'?: string;
  className?: string;
  /** Ícone do trigger. Default: filtro. */
  icon?: React.ReactNode;
  /** Se definido, o trigger vira pill (ícone + texto). */
  triggerLabel?: string;
  /** Se false, clicar na opção já selecionada não limpa (modo simples). Default true. */
  clearable?: boolean;
  /** Força o estado ativo do trigger (útil com seções). */
  active?: boolean;
}

const PANEL_GAP = 4;
const PANEL_MIN_WIDTH = 210;
const VIEWPORT_PAD = 8;

export function FilterDropdown({
  value = null,
  onChange,
  options = [],
  sections,
  title = 'Filtrar campos',
  'aria-label': ariaLabel,
  className,
  icon,
  triggerLabel,
  clearable = true,
  active,
}: FilterDropdownProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { isOpen, toggle, close, triggerRef } = useDropdown({ contentRef: panelRef });
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const selectedCount = (sections ?? []).filter((s) => s.value !== null && s.value !== '').length;
  const hasActiveFilter = active ?? (sections ? selectedCount > 0 : value !== null && value !== '');
  const appliedCount = sections ? selectedCount : value !== null && value !== '' ? 1 : 0;

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) {
      setPos(null);
      return;
    }

    function place() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = Math.max(PANEL_MIN_WIDTH, rect.width);
      let left = rect.left;
      let top = rect.bottom + PANEL_GAP;

      // Clamp horizontal
      if (left + width > window.innerWidth - VIEWPORT_PAD) {
        left = Math.max(VIEWPORT_PAD, window.innerWidth - width - VIEWPORT_PAD);
      }
      if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;

      // Se não couber abaixo, abre para cima
      const estimatedHeight = 280;
      if (top + estimatedHeight > window.innerHeight - VIEWPORT_PAD) {
        top = Math.max(VIEWPORT_PAD, rect.top - estimatedHeight - PANEL_GAP);
      }

      setPos({ top, left, width });
    }

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [isOpen, triggerRef]);

  function handleSelect(
    optValue: string,
    current: string | null,
    change: ((v: string | null) => void) | undefined,
    canClear: boolean,
  ) {
    if (!change) return;
    if (canClear && current === optValue) {
      change(null);
    } else {
      change(optValue);
    }
    close();
  }

  const resolvedSections: FilterSection[] =
    sections ??
    (onChange
      ? [
          {
            id: 'default',
            title: '',
            value,
            onChange,
            options,
            clearable,
          },
        ]
      : []);

  const menu =
    isOpen && pos
      ? createPortal(
          <div
            ref={panelRef}
            className={styles.filterDropdown}
            role="menu"
            style={{ top: pos.top, left: pos.left, minWidth: pos.width }}
          >
            {resolvedSections.map((section, sectionIndex) => (
              <div key={section.id} className={styles.section}>
                {section.title && (
                  <div className={styles.sectionTitle} role="presentation">
                    {section.title}
                  </div>
                )}
                {sectionIndex > 0 && !section.title && <div className={styles.sectionDivider} />}
                {section.options.map((opt) => {
                  const isSelected = opt.value === section.value;
                  return (
                    <button
                      key={`${section.id}-${opt.value}`}
                      type="button"
                      className={cx(
                        styles.filterDropItem,
                        isSelected ? styles.filterDropItemOn : '',
                      )}
                      role="menuitem"
                      onClick={() =>
                        handleSelect(
                          opt.value,
                          section.value,
                          section.onChange,
                          section.clearable ?? true,
                        )
                      }
                    >
                      {opt.icon && <span className={styles.optIcon}>{opt.icon}</span>}
                      <span className={styles.optLabel}>{opt.label}</span>
                      {opt.badge !== undefined && opt.badge !== null && opt.badge !== 0 && (
                        <span className={styles.filterDropBadge}>{opt.badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={cx(styles.filterDropWrap, className)} ref={triggerRef}>
      <button
        type="button"
        className={cx(
          triggerLabel ? styles.filterPillBtn : styles.filterIconBtn,
          hasActiveFilter && (triggerLabel ? styles.filterPillBtnOn : styles.filterIconBtnOn),
        )}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-pressed={hasActiveFilter}
        aria-label={ariaLabel}
        title={hasActiveFilter ? `${title} (filtro aplicado)` : title}
      >
        {icon ?? <IconFilter size={14} aria-hidden="true" />}
        {triggerLabel && <span>{triggerLabel}</span>}
        {hasActiveFilter && (
          <span className={styles.filterActiveBadge} aria-hidden="true">
            {appliedCount > 0 ? appliedCount : ''}
          </span>
        )}
      </button>
      {menu}
    </div>
  );
}

'use client';

import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconChevronDown, IconCheck, IconSearch } from '@tabler/icons-react';
import { useDropdown } from '@/hooks/useDropdown';
import { clampToViewport, cx } from '@/utils';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  group?: string;
  disabled?: boolean;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  id?: string;
  renderSelected?: (option: SelectOption | undefined) => React.ReactNode;
  'aria-label'?: string;
  'aria-invalid'?: boolean;
  isDirty?: boolean;
  selectSize?: 'sm' | 'md';
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  className,
  id,
  renderSelected,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
  isDirty = false,
  selectSize = 'md',
  disabled = false,
  searchable = false,
  searchPlaceholder = 'Buscar…',
}: SelectProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const { isOpen, toggle, close, triggerRef } = useDropdown({ contentRef: panelRef });
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value);
  const q = query.trim().toLowerCase();
  const visible = q
    ? options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q),
      )
    : options;

  const groups = visible.reduce<Record<string, SelectOption[]>>((acc, opt) => {
    const key = opt.group ?? '__default__';
    if (!acc[key]) acc[key] = [];
    acc[key].push(opt);
    return acc;
  }, {});

  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current) {
      setPos(null);
      return;
    }

    function place() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const width = Math.max(rect.width, 180);
      const estimatedHeight = Math.min(
        320,
        visible.length * 40 + 16 + (searchable ? 44 : 0),
      );
      let top = rect.bottom + 4;
      if (top + estimatedHeight > window.innerHeight - 8) {
        top = Math.max(8, rect.top - estimatedHeight - 4);
      }
      const clamped = clampToViewport({
        left: rect.left,
        top,
        width,
        height: estimatedHeight,
      });
      setPos(clamped);
    }

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [isOpen, visible.length, searchable, triggerRef]);

  useLayoutEffect(() => {
    if (!isOpen) {
      setQuery('');
      return;
    }
    if (!searchable) return;
    const id = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [isOpen, searchable]);

  function handleSelect(opt: SelectOption) {
    if (opt.disabled) return;
    onChange(opt.value);
    close();
  }

  const list =
    isOpen && pos
      ? createPortal(
          <div
            ref={panelRef}
            className={styles.list}
            style={{ top: pos.top, left: pos.left, minWidth: pos.width, width: pos.width }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {searchable ? (
              <div className={styles.search}>
                <IconSearch size={13} className={styles.searchIcon} aria-hidden="true" />
                <input
                  ref={searchRef}
                  className={styles.searchInput}
                  placeholder={searchPlaceholder}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  aria-label={searchPlaceholder}
                />
              </div>
            ) : null}
            <ul className={styles.options} role="listbox" aria-label={ariaLabel}>
              {visible.length === 0 ? (
                <li className={styles.empty} role="presentation">
                  Nenhum resultado
                </li>
              ) : (
                Object.entries(groups).map(([group, opts], gi) => (
                  <React.Fragment key={group}>
                    {gi > 0 && <li className={styles.separator} role="separator" />}
                    {group !== '__default__' && <li className={styles.groupLabel}>{group}</li>}
                    {opts.map((opt) => (
                      <li
                        key={opt.value}
                        role="option"
                        aria-selected={opt.value === value}
                        className={cx(
                          styles.option,
                          opt.value === value ? styles.optionSelected : '',
                          opt.disabled ? styles.optionDisabled : '',
                        )}
                        onClick={() => handleSelect(opt)}
                      >
                        <span className={styles.optCheck}>
                          {opt.value === value && <IconCheck size={13} />}
                        </span>
                        {opt.prefix && <span className={styles.prefix}>{opt.prefix}</span>}
                        <span className={styles.optLabel}>{opt.label}</span>
                        {opt.suffix && <span className={styles.optSuffix}>{opt.suffix}</span>}
                      </li>
                    ))}
                  </React.Fragment>
                ))
              )}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className={cx(styles.wrapper, className)} ref={triggerRef}>
      <button
        type="button"
        id={id}
        className={cx(
          styles.trigger,
          styles[selectSize],
          isOpen ? styles.open : '',
          isDirty ? styles.dirty : '',
          disabled ? styles.disabled : '',
        )}
        onClick={disabled ? undefined : toggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        aria-invalid={ariaInvalid || undefined}
        disabled={disabled}
      >
        <span className={styles.selectedContent}>
          {renderSelected ? (
            renderSelected(selected)
          ) : selected ? (
            <>
              {selected.prefix && <span className={styles.prefix}>{selected.prefix}</span>}
              <span>{selected.label}</span>
            </>
          ) : (
            <span className={styles.placeholder}>{placeholder}</span>
          )}
        </span>
        <IconChevronDown
          size={14}
          className={cx(styles.chevron, isOpen ? styles.chevronOpen : '')}
        />
      </button>
      {list}
    </div>
  );
}

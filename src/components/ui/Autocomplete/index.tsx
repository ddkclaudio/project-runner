'use client';

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Input, type InputProps } from '@/components/ui/Input';
import { clampToViewport, cx } from '@/utils';
import styles from './Autocomplete.module.css';

export interface AutocompleteOption {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface AutocompleteProps extends Omit<InputProps, 'onChange' | 'value' | 'onSelect'> {
  value: string;
  onChange: (value: string) => void;
  options: AutocompleteOption[];
  onSelect: (option: AutocompleteOption) => void;
  /** Fecha a lista ao selecionar (default true). */
  closeOnSelect?: boolean;
  listAriaLabel?: string;
  /** Texto quando a lista abre sem opções. */
  emptyLabel?: string;
}

const VIEWPORT_PAD = 8;
const GAP = 4;
const MAX_LIST_HEIGHT = 220;
/** Altura aproximada de cada opção (padding + linha). */
const OPTION_HEIGHT = 36;
const LIST_CHROME = 8;

function estimateListHeight(count: number) {
  return Math.min(MAX_LIST_HEIGHT, Math.max(OPTION_HEIGHT, count * OPTION_HEIGHT + LIST_CHROME));
}

export function Autocomplete({
  value,
  onChange,
  options,
  onSelect,
  closeOnSelect = true,
  listAriaLabel = 'Sugestões',
  emptyLabel = 'Nenhuma opção',
  onFocus,
  ...inputProps
}: AutocompleteProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);

  const showList = open;

  useLayoutEffect(() => {
    if (!showList || !wrapRef.current) {
      setPos(null);
      return;
    }

    function place() {
      const wrap = wrapRef.current;
      if (!wrap) return;

      // Ancora no input real (não no wrapper que pode incluir erro/hint).
      const anchor = (wrap.querySelector('input') as HTMLElement | null) ?? wrap;
      const rect = anchor.getBoundingClientRect();
      const width = rect.width;
      const measured = listRef.current?.offsetHeight ?? 0;
      const height = measured > 0 ? measured : estimateListHeight(options.length);

      const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PAD;
      const spaceAbove = rect.top - VIEWPORT_PAD;
      const preferBelow = spaceBelow >= Math.min(height, 120) || spaceBelow >= spaceAbove;

      const top = preferBelow ? rect.bottom + GAP : rect.top - height - GAP;

      const next = clampToViewport({
        left: rect.left,
        top,
        width,
        height,
        pad: VIEWPORT_PAD,
      });

      setPos((prev) => {
        if (prev && prev.top === next.top && prev.left === next.left && prev.width === next.width) {
          return prev;
        }
        return next;
      });
    }

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [showList, options.length]);

  // Segunda passagem: altura real da lista já montada no portal.
  useLayoutEffect(() => {
    if (!showList || !pos || !listRef.current || !wrapRef.current) return;

    const wrap = wrapRef.current;
    const anchor = (wrap.querySelector('input') as HTMLElement | null) ?? wrap;
    const rect = anchor.getBoundingClientRect();
    const height = listRef.current.offsetHeight;
    if (!height) return;

    const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_PAD;
    const spaceAbove = rect.top - VIEWPORT_PAD;
    const preferBelow = spaceBelow >= Math.min(height, 120) || spaceBelow >= spaceAbove;
    const top = preferBelow ? rect.bottom + GAP : rect.top - height - GAP;

    const next = clampToViewport({
      left: rect.left,
      top,
      width: rect.width,
      height,
      pad: VIEWPORT_PAD,
    });

    setPos((prev) => {
      if (prev && prev.top === next.top && prev.left === next.left && prev.width === next.width) {
        return prev;
      }
      return next;
    });
  }, [showList, pos, options.length]);

  useEffect(() => {
    if (!showList) return;
    function onOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if ((e.target as HTMLElement)?.closest?.('[data-autocomplete-list]')) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [showList]);

  function select(opt: AutocompleteOption) {
    onSelect(opt);
    if (closeOnSelect) setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showList || options.length === 0) {
      inputProps.onKeyDown?.(e);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      select(options[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else {
      inputProps.onKeyDown?.(e);
    }
  }

  const list =
    showList && pos
      ? createPortal(
          <ul
            ref={listRef}
            className={styles.list}
            role="listbox"
            aria-label={listAriaLabel}
            data-autocomplete-list
            style={{ top: pos.top, left: pos.left, width: pos.width }}
          >
            {options.length === 0 ? (
              <li className={styles.empty} role="presentation">
                {emptyLabel}
              </li>
            ) : (
              options.map((opt, i) => (
                <li key={opt.id} role="presentation">
                  <button
                    type="button"
                    className={cx(styles.option, i === activeIndex && styles.optionActive)}
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      select(opt);
                    }}
                  >
                    {opt.icon && <span className={styles.optionIcon}>{opt.icon}</span>}
                    <span className={styles.optionLabel}>{opt.label}</span>
                  </button>
                </li>
              ))
            )}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <Input
        {...inputProps}
        value={value}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={(e) => {
          setOpen(true);
          const wrap = wrapRef.current;
          if (wrap) {
            const anchor = (wrap.querySelector('input') as HTMLElement | null) ?? wrap;
            const rect = anchor.getBoundingClientRect();
            setPos({ top: rect.bottom + GAP, left: rect.left, width: rect.width });
          }
          onFocus?.(e);
        }}
        onKeyDown={handleKeyDown}
      />
      {list}
    </div>
  );
}

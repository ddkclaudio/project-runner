'use client';

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconChevronRight, IconChevronDown, IconCheck } from '@tabler/icons-react';
import { cx, clampToViewport } from '@/utils';
import { SearchableListPanel } from '@/components/ui/SearchableListPanel';
import { TIMEZONES, filterTimezones, type Timezone } from './timezones';
import styles from './TimezonePicker.module.css';

const PANEL_WIDTH = 320;
const PANEL_GAP = 4;
const PANEL_EST_HEIGHT = 360;

export type TimezonePickerVariant = 'menu' | 'field';

interface TimezonePickerProps {
  value: string;
  onChange: (timezoneId: string) => void;
  /** Lado preferido do painel (variante menu). Default: `left`. */
  side?: 'left' | 'right';
  /**
   * `menu`, item do ProfileMenu (default).
   * `field`, campo de formulário com busca (Preferências).
   */
  variant?: TimezonePickerVariant;
  className?: string;
  'aria-label'?: string;
}

function displayLabel(value: string, selected: Timezone | undefined): string {
  if (value === 'auto') return 'Detectar automaticamente';
  if (selected?.label) {
    return selected.offset ? `${selected.label} (${selected.offset})` : selected.label;
  }
  return value;
}

export function TimezonePicker({
  value,
  onChange,
  side = 'left',
  variant = 'menu',
  className,
  'aria-label': ariaLabel,
}: TimezonePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [pos, setPos] = useState<{
    top: number;
    width: number;
    left?: number;
    right?: number;
  } | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const isField = variant === 'field';

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
  }, []);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (wrapperRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, close]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }

    function place() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();

      if (isField) {
        const width = Math.min(Math.max(rect.width, PANEL_WIDTH), window.innerWidth - 16);
        let top = rect.bottom + PANEL_GAP;
        if (top + PANEL_EST_HEIGHT > window.innerHeight - 8) {
          top = Math.max(8, rect.top - PANEL_EST_HEIGHT - PANEL_GAP);
        }
        const clamped = clampToViewport({
          left: rect.left,
          top,
          width,
          height: PANEL_EST_HEIGHT,
        });
        setPos({ top: clamped.top, left: clamped.left, width });
        return;
      }

      const width = Math.min(PANEL_WIDTH, window.innerWidth - 16);
      const viewportW = document.documentElement.clientWidth;
      const spaceLeft = rect.left - 8;
      const spaceRight = viewportW - rect.right - 8;
      const openLeft =
        side === 'left' ? spaceLeft >= width || spaceLeft >= spaceRight : spaceRight < width && spaceLeft > spaceRight;

      const height = Math.min(PANEL_EST_HEIGHT, window.innerHeight - 16);
      let top = rect.top;
      if (top + height > window.innerHeight - 8) {
        top = Math.max(8, rect.bottom - height);
      }

      if (openLeft) {
        setPos({
          top,
          width,
          right: viewportW - rect.left + PANEL_GAP,
        });
        return;
      }

      setPos({
        top,
        width,
        left: rect.right + PANEL_GAP,
      });
    }

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, side, isField]);

  const filtered = useMemo(() => filterTimezones(TIMEZONES, query), [query]);
  const selected = TIMEZONES.find((t) => t.id === value);
  const display = displayLabel(value, selected);

  function select(id: string) {
    onChange(id);
    close();
  }

  const panel =
    open && pos
      ? createPortal(
          <div
            ref={panelRef}
            className={styles.subPanel}
            style={{
              top: pos.top,
              width: pos.width,
              left: pos.left ?? 'auto',
              right: pos.right ?? 'auto',
            }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <SearchableListPanel
              query={query}
              onQueryChange={setQuery}
              placeholder="Buscar cidade, UTC ou região…"
              emptyMessage="Nenhum fuso encontrado"
              aria-label="Selecionar fuso horário"
              className={styles.fillPanel}
              items={filtered}
              renderItem={(tz: Timezone) => (
                <button
                  key={tz.id}
                  type="button"
                  role="option"
                  aria-selected={value === tz.id}
                  className={cx(styles.item, value === tz.id && styles.itemActive)}
                  onClick={() => select(tz.id)}
                >
                  <div className={styles.itemInfo}>
                    <span className={styles.itemLabel}>
                      {tz.id === 'auto' ? 'Detectar automaticamente' : tz.label}
                    </span>
                    {tz.offset ? (
                      <span className={styles.itemOffset}>
                        {tz.offset} · {tz.id}
                      </span>
                    ) : tz.id !== 'auto' ? (
                      <span className={styles.itemOffset}>{tz.id}</span>
                    ) : null}
                  </div>
                  {value === tz.id && (
                    <IconCheck size={13} className={styles.check} aria-hidden="true" />
                  )}
                </button>
              )}
            />
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={wrapperRef} className={cx(styles.wrapper, isField && styles.fieldWrapper, className)}>
      <button
        ref={triggerRef}
        type="button"
        className={cx(
          isField ? styles.fieldTrigger : styles.trigger,
          open && (isField ? styles.fieldTriggerOpen : styles.triggerActive),
        )}
        role={isField ? 'combobox' : 'menuitem'}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? 'Fuso horário'}
        onClick={() => setOpen((p) => !p)}
      >
        {isField ? (
          <>
            <span className={styles.fieldValue}>{display}</span>
            <IconChevronDown
              size={14}
              className={cx(styles.fieldChevron, open && styles.fieldChevronOpen)}
              aria-hidden="true"
            />
          </>
        ) : (
          <>
            <span className={styles.left}>
              <span className={styles.title}>Fuso horário</span>
              <span className={styles.value}>{display}</span>
            </span>
            <IconChevronRight
              size={13}
              className={cx(styles.chevron, open && styles.chevronOpen)}
              aria-hidden="true"
            />
          </>
        )}
      </button>
      {panel}
    </div>
  );
}

export { TIMEZONES, filterTimezones } from './timezones';
export type { Timezone } from './timezones';

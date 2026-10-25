'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { IconCalendar } from '@tabler/icons-react';
import { Input, type InputProps } from '@/components/ui/Input';
import styles from './DateInput.module.css';

export type DateInputProps = Omit<
  InputProps,
  | 'type'
  | 'value'
  | 'onChange'
  | 'rightIcon'
  | 'onRightIconClick'
  | 'rightIconLabel'
  | 'min'
  | 'max'
> & {
  /** Data calendário `YYYY-MM-DD` ou ISO da API. */
  value: string;
  onChange: (yyyyMmDd: string) => void;
  min?: string;
  max?: string;
};

/** Extrai o dia de calendário sem deslocar por fuso (API grava UTC). */
function toDateValue(iso?: string): string {
  if (!iso) return '';
  const match = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : '';
}

function ymdToBr(ymd: string): string {
  const value = toDateValue(ymd);
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function brToYmd(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function maskBr(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  if (digits.length <= 2) return day;
  if (digits.length <= 4) return `${day}/${month}`;
  return `${day}/${month}/${year}`;
}

function clampYmd(ymd: string, min?: string, max?: string): string {
  const lo = toDateValue(min);
  const hi = toDateValue(max);
  if (lo && ymd < lo) return lo;
  if (hi && ymd > hi) return hi;
  return ymd;
}

/**
 * Campo de data em padrão brasileiro (`dd/mm/aaaa`).
 * O valor controlado continua `YYYY-MM-DD` para gravar/ler UTC na API.
 */
export function DateInput({
  value,
  onChange,
  min,
  max,
  disabled,
  placeholder = 'dd/mm/aaaa',
  id,
  ...props
}: DateInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const nativeRef = useRef<HTMLInputElement>(null);
  const ymd = toDateValue(value);
  const [text, setText] = useState(() => ymdToBr(ymd));

  useEffect(() => {
    setText(ymdToBr(toDateValue(value)));
  }, [value]);

  function commit(nextYmd: string) {
    const clamped = clampYmd(nextYmd, min, max);
    setText(ymdToBr(clamped));
    if (clamped !== ymd) onChange(clamped);
  }

  function handleBlur() {
    if (!text.trim()) {
      if (ymd) onChange('');
      setText('');
      return;
    }
    const parsed = brToYmd(text);
    if (!parsed) {
      setText(ymdToBr(ymd));
      return;
    }
    commit(parsed);
  }

  function openPicker() {
    const el = nativeRef.current;
    if (!el || disabled) return;
    if (typeof el.showPicker === 'function') {
      el.showPicker();
      return;
    }
    el.focus();
    el.click();
  }

  return (
    <div className={styles.wrap}>
      <Input
        {...props}
        id={inputId}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        disabled={disabled}
        onChange={(e) => {
          setText(maskBr(e.target.value));
        }}
        onBlur={handleBlur}
        rightIcon={<IconCalendar size={15} />}
        onRightIconClick={openPicker}
        rightIconLabel="Abrir calendário"
      />
      <input
        ref={nativeRef}
        className={styles.native}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        disabled={disabled}
        value={ymd}
        min={toDateValue(min) || undefined}
        max={toDateValue(max) || undefined}
        onChange={(e) => commit(e.target.value)}
      />
    </div>
  );
}

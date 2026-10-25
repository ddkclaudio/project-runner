'use client';

import React from 'react';
import { cx } from '@/utils';
import styles from './Slider.module.css';

interface SliderProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  id?: string;
  'aria-label'?: string;
  className?: string;
}

export function Slider({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  suffix = '%',
  id,
  'aria-label': ariaLabel,
  className,
}: SliderProps) {
  return (
    <div className={cx(styles.sliderField, className)}>
      <input
        type="range"
        id={id}
        className={styles.sliderInput}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        aria-label={ariaLabel}
      />
      <span className={styles.sliderValue}>
        {value}
        {suffix}
      </span>
    </div>
  );
}

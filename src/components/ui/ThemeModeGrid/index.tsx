'use client';

import { cx } from '@/utils';
import { THEMES, type Theme } from '@/hooks/useThemePreference';
import styles from './ThemeModeGrid.module.css';

export type ThemeModeGridProps = {
  value: Theme;
  onChange: (theme: Theme) => void;
  className?: string;
};

/** Preview palette: system mirrors dark chrome with a light hint. */
function previewTone(id: Theme): 'light' | 'dark' {
  if (id === 'light') return 'light';
  return 'dark';
}

export function ThemeModeGrid({ value, onChange, className }: ThemeModeGridProps) {
  // Reference order: System, Dark, Light, Classic Dark
  const order: Theme[] = ['system', 'dark', 'light', 'classic-dark'];
  const themes = order
    .map((id) => THEMES.find((t) => t.id === id))
    .filter((t): t is (typeof THEMES)[number] => Boolean(t));

  return (
    <div className={cx(styles.grid, className)} role="radiogroup" aria-label="Tema">
      {themes.map((t) => {
        const selected = value === t.id;
        const tone = previewTone(t.id);
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={selected}
            className={cx(styles.card, selected && styles.selected)}
            onClick={() => onChange(t.id)}
          >
            <div
              className={cx(
                styles.preview,
                tone === 'light' ? styles.previewLight : styles.previewDark,
              )}
            >
              <div className={styles.prevSidebar}>
                <span />
                <span />
                <span />
                <span />
              </div>
              <div className={styles.prevMain}>
                <div className={styles.prevTabs}>
                  <i />
                  <i />
                  <i />
                </div>
                <div className={styles.prevLine} />
                <div className={styles.prevRow}>
                  <i />
                  <i />
                  <i />
                </div>
                <div className={styles.prevLine} style={{ width: '50%' }} />
              </div>
            </div>
            <span className={styles.option}>
              <span className={cx(styles.radioDot, selected && styles.radioChecked)} />
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

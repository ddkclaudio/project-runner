import { cx } from '@/utils';
import styles from './TabFilter.module.css';

export interface TabFilterItem {
  value: string;
  label: string;
  badge?: number | string;
}

interface TabFilterProps {
  tabs: TabFilterItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  'aria-label'?: string;
}

export function TabFilter({
  tabs,
  value,
  onChange,
  className,
  'aria-label': ariaLabel,
}: TabFilterProps) {
  return (
    <div className={cx(styles.tabs, className)} role="tablist" aria-label={ariaLabel}>
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          className={cx(styles.tab, value === t.value && styles.tabActive)}
          onClick={() => onChange(t.value)}
        >
          {t.label}
          {t.badge != null && t.badge !== 0 && <span className={styles.tabBadge}>{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}

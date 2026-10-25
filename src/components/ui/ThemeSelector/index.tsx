'use client';

import { cx } from '@/utils';
import { useThemePreference, THEMES, type Theme } from '@/hooks/useThemePreference';
import { DropdownMenuSectionLabel } from '@/components/ui/DropdownMenu';
import styles from './ThemeSelector.module.css';

interface ThemeSelectorProps {
  value?: Theme;
  onChange?: (theme: Theme) => void;
}

export function ThemeSelector({ value, onChange }: ThemeSelectorProps) {
  const { theme: storedTheme, setTheme } = useThemePreference();
  const theme = value ?? storedTheme;

  function select(next: Theme) {
    onChange?.(next);
    setTheme(next);
  }

  return (
    <>
      <DropdownMenuSectionLabel>Tema</DropdownMenuSectionLabel>
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          className={cx(styles.item, theme === t.id && styles.itemActive)}
          role="menuitemradio"
          aria-checked={theme === t.id}
          onClick={() => select(t.id)}
        >
          <span className={cx(styles.dot, theme === t.id && styles.dotActive)} />
          <span>{t.label}</span>
        </button>
      ))}
    </>
  );
}

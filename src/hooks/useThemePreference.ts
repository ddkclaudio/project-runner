import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  THEMES,
  applyTheme,
  defaultTheme,
  readStoredTheme,
  resolveTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from '@/lib/theme';

export type { Theme };
export { THEMES };

/**
 * Theme preference.
 *
 * - Initial React state is `defaultTheme()` (`NEXT_PUBLIC_DEFAULT_THEME`, or
 *   `dark` if unset) so SSR HTML matches the first client render.
 * - The blocking boot script already set `data-theme` on `<html>` before paint.
 * - `useLayoutEffect` re-syncs from localStorage (user override) before paint.
 */
export function useThemePreference() {
  const [theme, setThemeState] = useState<Theme>(defaultTheme);
  const [mounted, setMounted] = useState(false);
  /** Bumps when OS scheme changes while preference is `system`. */
  const [systemEpoch, setSystemEpoch] = useState(0);

  useLayoutEffect(() => {
    const stored = readStoredTheme();
    applyTheme(stored);
    setThemeState(stored);
    setMounted(true);
  }, []);

  // Keep `system` in sync when OS preference changes
  useEffect(() => {
    if (!mounted || theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      applyTheme('system');
      setSystemEpoch((n) => n + 1);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme, mounted]);

  // Cross-tab updates
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== THEME_STORAGE_KEY) return;
      const next = readStoredTheme();
      setThemeState(next);
      applyTheme(next);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* private mode */
    }
    applyTheme(next);
  }, []);

  const resolved = resolveTheme(theme);
  // Re-resolve when OS scheme changes under `system` preference
  void systemEpoch;

  const toggleLightDark = useCallback(() => {
    setTheme(resolved === 'light' ? 'dark' : 'light');
  }, [resolved, setTheme]);

  return {
    theme,
    setTheme,
    toggleLightDark,
    isLight: resolved === 'light',
    resolvedTheme: resolved,
  };
}

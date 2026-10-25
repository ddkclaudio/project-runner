/** Shared theme helpers (client + inline boot script). */

import { appSlug } from '@/lib/brand';

export type Theme = 'dark' | 'light' | 'classic-dark' | 'system';

export const THEMES: { id: Theme; label: string }[] = [
  { id: 'dark', label: 'Escuro' },
  { id: 'light', label: 'Claro' },
  { id: 'classic-dark', label: 'Escuro Clássico' },
  { id: 'system', label: 'Sistema' },
];

export const THEME_STORAGE_KEY = `${appSlug()}-theme`;

const THEME_IDS: Theme[] = ['dark', 'light', 'classic-dark', 'system'];

export function isTheme(value: string | null | undefined): value is Theme {
  return !!value && THEME_IDS.includes(value as Theme);
}

/**
 * Tema inicial quando não há preferência no localStorage.
 * `NEXT_PUBLIC_DEFAULT_THEME` ausente ou inválida → `dark`.
 * Deploy (Terraform) usa `light`; localhost deixa a var de lado ou `dark`.
 */
export function defaultTheme(): Theme {
  const raw = (import.meta.env.VITE_DEFAULT_THEME ?? '').trim().toLowerCase();
  return isTheme(raw) ? raw : 'dark';
}

/** Resolve `system` to light/dark; other ids pass through. */
export function resolveTheme(theme: Theme): Exclude<Theme, 'system'> {
  if (theme !== 'system') return theme;
  if (typeof window === 'undefined') {
    const fallback = defaultTheme();
    return fallback === 'light' ? 'light' : fallback === 'classic-dark' ? 'classic-dark' : 'dark';
  }
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function readStoredTheme(): Theme {
  const fallback = defaultTheme();
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(stored) ? stored : fallback;
  } catch {
    return fallback;
  }
}

/** Apply resolved theme to <html> for CSS `[data-theme=…]` selectors. */
export function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.dataset.themePreference = theme;
  root.style.colorScheme = resolved === 'light' ? 'light' : 'dark';
}

/**
 * Inline boot script, must run as a blocking `<script>` before body content
 * so the first paint already has the correct `data-theme` (no dark FOUC).
 * Keep in sync with THEME_STORAGE_KEY / defaultTheme / resolveTheme above.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var k=${JSON.stringify(THEME_STORAGE_KEY)};var def=${JSON.stringify(defaultTheme())};var t=localStorage.getItem(k)||def;var ok={dark:1,light:1,'classic-dark':1,system:1};if(!ok[t])t=def;var r=t==='system'?(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):t;var d=document.documentElement;d.dataset.theme=r;d.dataset.themePreference=t;d.style.colorScheme=r==='light'?'light':'dark';}catch(e){}})();`;

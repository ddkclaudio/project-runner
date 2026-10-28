import { readStoredTimezone } from '@/hooks/useAccountLocalPrefs';

/** Format a number as a USD currency string */
export function formatCurrency(value: number): string {
  return `$${value.toLocaleString('en-US')}`;
}

/** Format a large integer with comma separators */
export function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

/** Capitalise first letter only */
export function capitalise(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/** Return a CSS-safe className string from multiple optional values */
export function cx(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

/** Compute total monthly cost given existing rows + new project price */
export function computeTotal(
  existingCosts: number[],
  newProjectCost: number,
  credits: number,
): number {
  return existingCosts.reduce((a, b) => a + b, 0) + newProjectCost - credits;
}

/**
 * Format an ISO date in the account timezone.
 * e.g. "2026-04-15T10:07:43Z" → "15 abr 26 07:07:43" in America/Sao_Paulo.
 */
export function formatDate(iso?: string, timeZone?: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const zone = timeZone?.trim() || readStoredTimezone();
  try {
    const parts = new Intl.DateTimeFormat('pt-PT', {
      timeZone: zone,
      day: '2-digit',
      month: 'short',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(d);
    const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
    const month = pick('month').replace('.', '');
    return `${pick('day')} ${month} ${pick('year')} ${pick('hour')}:${pick('minute')}:${pick('second')}`;
  } catch {
    if (zone === 'America/Sao_Paulo') return iso;
    return formatDate(iso, 'America/Sao_Paulo');
  }
}

/**
 * Extract the subdomain reference from a URL.
 * e.g. "https://ejrlncfynjch.nexus.app" → "ejrlncfynjch"
 */
export function extractRef(url?: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname.split('.')[0];
  } catch {
    return '';
  }
}

/**
 * Map a domain value to a Badge variant.
 * Keeps variant logic out of render code and in one place.
 */
export const BADGE_VARIANT_MAP: Record<string, string> = {
  NANO: 'nano',
  MICRO: 'nano',
  SMALL: 'nano',
  MEDIUM: 'nano',
  LARGE: 'large',
  XL: 'large',
  healthy: 'green',
  degraded: 'amber',
  offline: 'neutral',
  new: 'new',
};

export function badgeVariant(key: string): string {
  return BADGE_VARIANT_MAP[key] ?? 'neutral';
}

/** Clamp a popover box inside the viewport (fixed positioning). */
export function clampToViewport(opts: {
  left: number;
  top: number;
  width: number;
  height?: number;
  pad?: number;
}): { left: number; top: number; width: number } {
  const pad = opts.pad ?? 8;
  const vw = typeof window !== 'undefined' ? window.innerWidth : opts.width;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const width = Math.min(opts.width, Math.max(0, vw - pad * 2));
  let left = opts.left;
  let top = opts.top;

  if (left + width > vw - pad) left = vw - pad - width;
  if (left < pad) left = pad;

  if (opts.height != null) {
    if (top + opts.height > vh - pad) top = Math.max(pad, vh - pad - opts.height);
    if (top < pad) top = pad;
  }

  return { left, top, width };
}

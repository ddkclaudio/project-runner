import type { ShortcutSpec } from '@/lib/nav-shortcuts';

const APPLE_UA = /Mac|iPhone|iPad|iPod/;

export function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false;
  return APPLE_UA.test(navigator.platform) || APPLE_UA.test(navigator.userAgent);
}

/** Ctrl on Windows/Linux, ⌘ on Apple, matches the header "Ctrl K" trigger. */
export function modLabel(): string {
  return isApplePlatform() ? '⌘' : 'Ctrl';
}

export function displayShortcutKeys(keys: string[]): string[] {
  return keys.map((k) => {
    if (k === 'mod' || k === '⌘' || k === 'Ctrl') return modLabel();
    if (k === 'shift' || k === '⇧') return '⇧';
    return k;
  });
}

export function shortcutTitle(keys: string[]): string {
  return displayShortcutKeys(keys).join('+');
}

export function ariaKeyshortcuts(spec: ShortcutSpec): string {
  const parts: string[] = [];
  if (spec.mod) parts.push(isApplePlatform() ? 'Meta' : 'Control');
  if (spec.shift) parts.push('Shift');
  const last = spec.keys[spec.keys.length - 1] ?? spec.code;
  parts.push(last === ',' ? 'Comma' : last === '/' ? 'Slash' : last);
  return parts.join('+');
}

export function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

/** App modifier: Ctrl on Windows (not the Windows key), ⌘ on Apple. */
export function isAppMod(e: KeyboardEvent): boolean {
  if (e.altKey) return false;
  if (isApplePlatform()) return e.metaKey && !e.ctrlKey;
  return e.ctrlKey && !e.metaKey;
}

export function matchesShortcut(e: KeyboardEvent, spec: ShortcutSpec): boolean {
  if (e.repeat) return false;

  if (spec.code === 'Slash') {
    if (!spec.mod || !isAppMod(e)) return false;
    return e.code === 'Slash' || e.code === 'NumpadDivide' || e.key === '/' || e.key === '?';
  }

  const wantMod = Boolean(spec.mod);
  const wantShift = Boolean(spec.shift);

  if (wantMod) {
    if (!isAppMod(e)) return false;
    if (wantShift !== e.shiftKey) return false;
  } else {
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (wantShift !== e.shiftKey) return false;
  }

  return e.code === spec.code;
}

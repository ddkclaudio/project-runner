export type ShortcutSpec = {
  id: string;
  keys: string[];
  code: string;
  mod?: boolean;
  shift?: boolean;
  href?: string;
};

export const SHORTCUT_SPECS: ShortcutSpec[] = [
  { id: 'nav-home', keys: ['mod', 'H'], code: 'KeyH', mod: true, href: '/' },
  { id: 'nav-catalog', keys: ['mod', 'L'], code: 'KeyL', mod: true, href: '/catalog' },
  { id: 'nav-settings', keys: ['mod', ','], code: 'Comma', mod: true, href: '/settings/profile' },
  { id: 'nav-components', keys: ['mod', 'D'], code: 'KeyD', mod: true, href: '/components' },
  { id: 'shortcuts', keys: ['mod', '/'], code: 'Slash', mod: true },
];

const BY_ID = new Map(SHORTCUT_SPECS.map((spec) => [spec.id, spec]));

export function shortcutById(id: string): ShortcutSpec | undefined {
  return BY_ID.get(id);
}

export function shortcutKeys(id: string): string[] | undefined {
  return shortcutById(id)?.keys;
}

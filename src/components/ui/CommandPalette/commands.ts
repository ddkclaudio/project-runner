import { IconHome, IconComponents, IconLogout } from '@tabler/icons-react';
import React from 'react';
import { shortcutKeys } from '@/lib/nav-shortcuts';

export type CommandGroup = 'shortcuts' | 'actions';

export interface Command {
  id: string;
  label: string;
  group: CommandGroup;
  icon: React.ReactNode;
  shortcut?: string[];
  keywords?: string[];
  href?: string;
}

export const GROUP_LABELS: Record<CommandGroup, string> = {
  shortcuts: 'Atalhos',
  actions: 'Ações',
};

export const GROUP_ORDER: CommandGroup[] = ['shortcuts', 'actions'];

export const COMMANDS: Command[] = [
  {
    id: 'nav-home',
    label: 'Início',
    group: 'shortcuts',
    icon: React.createElement(IconHome, { size: 15 }),
    shortcut: shortcutKeys('nav-home'),
    keywords: ['home', 'inicio', 'início'],
    href: '/',
  },
  {
    id: 'nav-components',
    label: 'Componentes',
    group: 'shortcuts',
    icon: React.createElement(IconComponents, { size: 15 }),
    shortcut: shortcutKeys('nav-components'),
    keywords: ['components', 'ui', 'catalogo', 'catálogo'],
    href: '/components',
  },
  {
    id: 'logout',
    label: 'Sair',
    group: 'actions',
    icon: React.createElement(IconLogout, { size: 15 }),
    keywords: ['logout', 'sair', 'sign out'],
    href: '/login',
  },
];

export function commandsForAccess(commands: Command[]): Command[] {
  return commands;
}

export function filterCommands(commands: Command[], query: string): Command[] {
  if (!query.trim()) return commands;
  const q = query.toLowerCase();
  return commands.filter(
    (command) =>
      command.label.toLowerCase().includes(q) || command.keywords?.some((keyword) => keyword.includes(q)),
  );
}

export function groupCommands(commands: Command[]): Record<CommandGroup, Command[]> {
  return GROUP_ORDER.reduce<Record<CommandGroup, Command[]>>(
    (acc, group) => {
      acc[group] = commands.filter((command) => command.group === group);
      return acc;
    },
    { shortcuts: [], actions: [] },
  );
}

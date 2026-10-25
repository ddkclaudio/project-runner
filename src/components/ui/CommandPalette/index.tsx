'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { shortcutById } from '@/lib/nav-shortcuts';
import { useAuth } from '@/contexts/AuthContext';
import { CommandPaletteTrigger } from './CommandPaletteTrigger';
import { CommandPaletteModal } from './CommandPaletteModal';
import {
  COMMANDS,
  GROUP_ORDER,
  GROUP_LABELS,
  commandsForAccess,
  filterCommands,
  groupCommands,
} from './commands';
import { isAppMod, isEditableTarget, matchesShortcut } from '@/lib/hotkeys';

export { CommandPaletteTrigger } from './CommandPaletteTrigger';
export { CommandPaletteModal } from './CommandPaletteModal';

interface CommandPaletteProps {
  /** Registra atalhos globais (Ctrl/Cmd+K e navegação). Default: `true`. */
  enableShortcut?: boolean;
  /** Esconde o trigger no mobile (mantém modal e atalhos montados). */
  hideTriggerOnMobile?: boolean;
}

export function CommandPalette({
  enableShortcut = true,
  hideTriggerOnMobile = false,
}: CommandPaletteProps) {
  const router = useRouter();
  const { signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const available = useMemo(() => commandsForAccess(COMMANDS), []);
  const filtered = useMemo(() => filterCommands(available, query), [available, query]);
  const grouped = useMemo(() => groupCommands(filtered), [filtered]);
  const flat = useMemo(() => GROUP_ORDER.flatMap((g) => grouped[g]), [grouped]);

  const openPalette = useCallback(() => {
    setOpen(true);
    window.dispatchEvent(new CustomEvent('robot:wake'));
  }, []);

  const closePalette = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActive(0);
  }, []);

  const updateQuery = useCallback((value: string) => {
    setQuery(value);
    setActive(0);
  }, []);

  const selectItem = useCallback(
    (id: string) => {
      const cmd = available.find((c) => c.id === id);
      if (id === 'shortcuts') {
        openPalette();
        return;
      }
      closePalette();
      if (id === 'logout') {
        void signOut().then(() => router.replace('/login'));
        return;
      }
      if (cmd?.href) router.push(cmd.href);
    },
    [router, closePalette, openPalette, available, signOut],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        closePalette();
        return;
      }

      if (!enableShortcut) return;

      if (isAppCommandK(e)) {
        e.preventDefault();
        e.stopPropagation();
        if (open) closePalette();
        else openPalette();
        return;
      }

      if (open || e.repeat) return;
      if (isEditableTarget(e.target)) return;

      for (const cmd of available) {
        const spec = shortcutById(cmd.id);
        if (!spec || !matchesShortcut(e, spec)) continue;
        e.preventDefault();
        e.stopPropagation();
        selectItem(cmd.id);
        return;
      }
    }

    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, openPalette, closePalette, enableShortcut, available, selectItem]);

  useEffect(() => {
    function onOpenEvent() {
      openPalette();
    }
    window.addEventListener('command-palette:open', onOpenEvent);
    return () => window.removeEventListener('command-palette:open', onOpenEvent);
  }, [openPalette]);

  return (
    <>
      <CommandPaletteTrigger onClick={openPalette} hideOnMobile={hideTriggerOnMobile} />
      <CommandPaletteModal
        open={open}
        query={query}
        onQueryChange={updateQuery}
        onClose={closePalette}
        flat={flat}
        grouped={grouped}
        groupOrder={GROUP_ORDER}
        groupLabels={GROUP_LABELS}
        active={active}
        onActiveChange={setActive}
        onSelect={selectItem}
      />
    </>
  );
}

function isAppCommandK(e: KeyboardEvent): boolean {
  if (e.shiftKey) return false;
  if (e.code !== 'KeyK' && e.key.toLowerCase() !== 'k') return false;
  return isAppMod(e);
}

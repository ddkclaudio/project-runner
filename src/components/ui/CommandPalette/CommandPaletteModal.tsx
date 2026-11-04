'use client';

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { IconSearch } from '@tabler/icons-react';
import { CommandItem } from './CommandItem';
import { CommandGroup } from './CommandGroup';
import type { Command, CommandGroup as CommandGroupId } from './commands';
import styles from './CommandPaletteModal.module.css';

interface CommandPaletteModalProps {
  open: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onClose: () => void;
  flat: Command[];
  grouped: Record<CommandGroupId, Command[]>;
  groupOrder: readonly CommandGroupId[];
  groupLabels: Record<CommandGroupId, string>;
  active: number;
  onActiveChange: (index: number) => void;
  onSelect: (id: string) => void;
}

export function CommandPaletteModal({
  open,
  query,
  onQueryChange,
  onClose,
  flat,
  grouped,
  groupOrder,
  groupLabels,
  active,
  onActiveChange,
  onSelect,
}: CommandPaletteModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const el = listRef.current?.querySelector('[data-active="true"]') as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      onActiveChange(Math.min(active + 1, flat.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onActiveChange(Math.max(active - 1, 0));
    }
    if (e.key === 'Enter') {
      const item = flat[active];
      if (item) onSelect(item.id);
    }
  }

  return createPortal(
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de comandos"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={styles.panel} onKeyDown={onKeyDown}>
        <div className={styles.inputRow}>
          <IconSearch size={16} className={styles.inputIcon} aria-hidden="true" />
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Execute um comando ou busque…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            aria-autocomplete="list"
            aria-controls="cmd-list"
            aria-activedescendant={flat[active] ? `cmd-item-${flat[active].id}` : undefined}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        <div
          id="cmd-list"
          ref={listRef}
          className={styles.list}
          role="listbox"
          aria-label="Comandos"
        >
          {flat.length === 0 ? (
            <p className={styles.empty}>No results for &quot;{query}&quot;</p>
          ) : (
            groupOrder.map((group) => {
              const items = grouped[group];
              if (!items.length) return null;

              const groupOffset = groupOrder
                .slice(0, groupOrder.indexOf(group))
                .reduce((sum, g) => sum + grouped[g].length, 0);

              return (
                <CommandGroup key={group} label={groupLabels[group]}>
                  {items.map((cmd, i) => (
                    <CommandItem
                      key={cmd.id}
                      id={cmd.id}
                      label={cmd.label}
                      icon={cmd.icon}
                      shortcut={cmd.shortcut}
                      isActive={active === groupOffset + i}
                      onClick={() => onSelect(cmd.id)}
                      onMouseEnter={() => onActiveChange(groupOffset + i)}
                    />
                  ))}
                </CommandGroup>
              );
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

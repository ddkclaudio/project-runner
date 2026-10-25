'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DropdownMenuRoot, DropdownMenuPanel } from '@/components/ui/DropdownMenu';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { ProfileMenuContent, useProfileUser } from './ProfileMenuContent';
import styles from './ProfileMenu.module.css';

export { ProfileMenuContent, useProfileUser } from './ProfileMenuContent';

export function ProfileMenu() {
  const { avatarSrc, displayName } = useProfileUser();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        close();
      }
    }
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, close]);

  return (
    <div ref={wrapperRef}>
      <DropdownMenuRoot className={styles.root}>
        <button
          type="button"
          className={styles.avatarBtn}
          onClick={() => setOpen((p) => !p)}
          aria-label="Abrir menu de perfil"
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <UserAvatar key={avatarSrc ?? 'none'} src={avatarSrc} alt={displayName} size="sm" />
        </button>

        {open && (
          <DropdownMenuPanel
            aria-label="Menu de perfil"
            className={styles.panel}
            estimatedHeight={520}
          >
            <ProfileMenuContent onNavigate={close} />
          </DropdownMenuPanel>
        )}
      </DropdownMenuRoot>
    </div>
  );
}

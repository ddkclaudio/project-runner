'use client';

import React from 'react';
import { CommandPalette } from '@/components/ui/CommandPalette';
import { ProfileMenu } from '@/components/ui/ProfileMenu';
import { TopbarHide } from './TopbarHide';
import styles from './Topbar.module.css';

interface TopbarRightControlsProps {
  leading?: React.ReactNode;
  showInbox?: boolean;
}

/** Controles padrão à direita: busca, notificações, perfil (+ opcionais). */
export function TopbarRightControls({
  leading,
  showInbox = false,
}: TopbarRightControlsProps) {
  return (
    <>
      {leading && <TopbarHide below="tablet">{leading}</TopbarHide>}
      <CommandPalette hideTriggerOnMobile />
      <TopbarHide below="mobile" className={styles.profileAfterAlerts}>
        <ProfileMenu />
      </TopbarHide>
    </>
  );
}

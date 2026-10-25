'use client';

import { IconLogout } from '@tabler/icons-react';
import { NavMenuItem } from '@/components/ui/NavMenuItem';

interface LogoutMenuItemProps {
  onLogout: () => void | Promise<void>;
}

export function LogoutMenuItem({ onLogout }: LogoutMenuItemProps) {
  return (
    <NavMenuItem
      label="Sair"
      icon={<IconLogout size={14} aria-hidden="true" />}
      danger
      variant="menu"
      role="menuitem"
      onClick={() => void onLogout()}
    />
  );
}

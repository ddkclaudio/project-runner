'use client';

import { IconMoon, IconSun } from '@tabler/icons-react';
import { useThemePreference } from '@/hooks/useThemePreference';
import { TopbarActionButton } from '@/components/ui/TopbarActionButton';

export function ThemeToggle() {
  const { isLight, toggleLightDark } = useThemePreference();

  return (
    <TopbarActionButton
      icon={
        isLight ? (
          <IconMoon size={16} aria-hidden="true" />
        ) : (
          <IconSun size={16} aria-hidden="true" />
        )
      }
      label={isLight ? 'Ativar tema escuro' : 'Ativar tema claro'}
      onClick={toggleLightDark}
    />
  );
}

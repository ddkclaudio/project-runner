'use client';

import { useNavigate } from 'react-router-dom';
import { IconUser } from '@tabler/icons-react';
import { DropdownMenuSeparator, DropdownMenuHeader } from '@/components/ui/DropdownMenu';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { NavMenuItem } from '@/components/ui/NavMenuItem';
import { ThemeSelector } from '@/components/ui/ThemeSelector';
import { TimezonePicker } from '@/components/ui/TimezonePicker';
import { LogoutMenuItem } from '@/components/ui/LogoutMenuItem';
import { useAuth } from '@/contexts/AuthContext';
import { useAccountLocalPrefs } from '@/hooks/useAccountLocalPrefs';

interface ProfileMenuContentProps {
  onNavigate?: () => void;
  timezoneSide?: 'left' | 'right';
  className?: string;
}

export function ProfileMenuContent({
  onNavigate,
  timezoneSide = 'left',
  className,
}: ProfileMenuContentProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const usernameFallback =
    user?.email?.split('@')[0] ?? user?.displayName?.replace(/\s+/g, '').toLowerCase() ?? '';
  const { prefs, patch } = useAccountLocalPrefs(user?.uid, usernameFallback);

  const displayName = user?.displayName ?? user?.email?.split('@')[0] ?? 'Usuário';

  return (
    <div className={className}>
      <DropdownMenuHeader
        avatar={<UserAvatar key={user?.photoURL ?? 'none'} src={user?.photoURL} alt={displayName} size="md" />}
        name={displayName}
        email={
          prefs.username
            ? `${prefs.username}${user?.email ? ` · ${user.email}` : ''}`
            : (user?.email ?? '')
        }
      />

      <DropdownMenuSeparator />

      <NavMenuItem
        label="Configurações do perfil"
        icon={<IconUser size={15} aria-hidden="true" />}
        onClick={() => {
          onNavigate?.();
          navigate('/settings/profile');
        }}
      />

      <DropdownMenuSeparator />

      <ThemeSelector />

      <DropdownMenuSeparator />

      <TimezonePicker
        value={prefs.timezone}
        onChange={(id) => patch({ timezone: id })}
        side={timezoneSide}
      />

      <DropdownMenuSeparator />

      <LogoutMenuItem
        onLogout={async () => {
          onNavigate?.();
          await signOut();
          // Soft replace only, hard reload remounts AuthProvider and flashes login twice.
          navigate('/login', { replace: true });
        }}
      />
    </div>
  );
}

export function useProfileUser() {
  const { user } = useAuth();
  const avatarSrc = user?.photoURL ?? null;
  const displayName = user?.displayName ?? user?.email?.split('@')[0] ?? 'Usuário';
  return { user, avatarSrc, displayName };
}

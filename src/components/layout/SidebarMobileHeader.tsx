'use client';

import {
  IconSearch,
  IconX,
  IconMoon,
  IconSun,
  IconChevronLeft,
} from '@tabler/icons-react';
import { useLayoutNav } from '@/hooks/useLayoutNav';
import { useThemePreference } from '@/hooks/useThemePreference';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useProfileUser } from '@/components/ui/ProfileMenu';
import { cx } from '@/utils';
import styles from './Sidebar.module.css';

export function SidebarMobileHeader() {
  const { closeNav, mobilePanel, showProfilePanel, showNavPanel } = useLayoutNav();
  const { isLight, toggleLightDark } = useThemePreference();
  const { avatarSrc, displayName } = useProfileUser();
  const isProfile = mobilePanel === 'profile';

  function openSearch() {
    closeNav();
    window.dispatchEvent(new CustomEvent('command-palette:open'));
  }

  return (
    <div className={cx(styles.mobileHeader, isProfile && styles.mobileHeaderProfile)}>
      {isProfile ? (
        <>
          <button
            type="button"
            className={styles.backBtn}
            aria-label="Voltar à navegação"
            onClick={showNavPanel}
          >
            <IconChevronLeft size={18} aria-hidden="true" />
          </button>
          <h2 className={styles.mobileHeaderTitle}>Perfil</h2>
        </>
      ) : (
        <div className={styles.pill}>
          <button type="button" className={styles.pillBtn} aria-label="Buscar" onClick={openSearch}>
            <IconSearch size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.pillBtn}
            aria-label={isLight ? 'Ativar tema escuro' : 'Ativar tema claro'}
            onClick={toggleLightDark}
          >
            {isLight ? (
              <IconMoon size={18} aria-hidden="true" />
            ) : (
              <IconSun size={18} aria-hidden="true" />
            )}
          </button>
          <button
            type="button"
            className={cx(styles.pillAvatar, styles.pillAvatarBtn)}
            aria-label="Abrir menu de perfil"
            aria-expanded={isProfile}
            onClick={showProfilePanel}
          >
            <UserAvatar key={avatarSrc ?? 'none'} src={avatarSrc} alt={displayName} size="sm" />
          </button>
        </div>
      )}
      <button
        type="button"
        className={styles.closeBtn}
        aria-label="Fechar menu de navegação"
        onClick={closeNav}
      >
        <IconX size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

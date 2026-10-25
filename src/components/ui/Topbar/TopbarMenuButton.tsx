import { IconMenu2, IconX } from '@tabler/icons-react';
import { cx } from '@/utils';
import styles from './Topbar.module.css';

interface TopbarMenuButtonProps {
  open: boolean;
  onClick: () => void;
  className?: string;
  /** id do sidebar controlado (aria-controls). */
  controlsId?: string;
}

/** Botão hamburger / fechar do topbar (visível só no mobile). */
export function TopbarMenuButton({
  open,
  onClick,
  className,
  controlsId = 'app-sidebar',
}: TopbarMenuButtonProps) {
  return (
    <button
      type="button"
      className={cx(styles.menuBtn, className)}
      onClick={onClick}
      aria-label={open ? 'Fechar menu de navegação' : 'Abrir menu de navegação'}
      aria-expanded={open}
      aria-controls={controlsId}
    >
      {open ? <IconX size={18} aria-hidden="true" /> : <IconMenu2 size={18} aria-hidden="true" />}
    </button>
  );
}

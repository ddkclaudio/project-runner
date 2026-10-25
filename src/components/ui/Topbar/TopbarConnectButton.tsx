import { IconWifi } from '@tabler/icons-react';
import { cx } from '@/utils';
import styles from './Topbar.module.css';

interface TopbarConnectButtonProps {
  label?: string;
  onClick?: () => void;
  className?: string;
}

/** Chip “Conectar” do topbar (ícone + label; label some no mobile). */
export function TopbarConnectButton({
  label = 'Conectar',
  onClick,
  className,
}: TopbarConnectButtonProps) {
  return (
    <button
      type="button"
      className={cx(styles.connectBtn, className)}
      onClick={onClick}
      aria-label={label}
    >
      <IconWifi size={13} aria-hidden="true" />
      <span className={styles.connectLabel}>{label}</span>
    </button>
  );
}

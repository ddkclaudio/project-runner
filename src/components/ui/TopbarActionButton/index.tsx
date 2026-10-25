import { cx } from '@/utils';
import styles from './TopbarActionButton.module.css';

interface TopbarActionButtonProps {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}

export function TopbarActionButton({
  icon,
  label,
  onClick,
  className,
  disabled,
}: TopbarActionButtonProps) {
  return (
    <button
      type="button"
      className={cx(styles.btn, className)}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

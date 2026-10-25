import { Link } from 'react-router-dom';
import { RozttaLogo } from '@/components/ui/RozttaLogo';
import { cx } from '@/utils';
import styles from './Topbar.module.css';
const LOGO_HOME_PATH = '/';

interface TopbarBrandProps {
  className?: string;
  /** Tamanho do ícone em px. Default 20. */
  size?: number;
  /** Destino do clique. Default `/` (início do painel, sem recarregar). */
  href?: string;
  /** Rótulo acessível do link. */
  label?: string;
}

/** Marca (logo Roztta idle) do topbar, oculta no mobile por padrão. Clica para a home. */
export function TopbarBrand({
  className,
  size = 20,
  href = LOGO_HOME_PATH,
  label = 'Ir para o início',
}: TopbarBrandProps) {
  return (
    <Link to={href} className={cx(styles.logoLink, className)} aria-label={label}>
      <span className={styles.logoIconBox} style={{ width: size, height: size }}>
        <RozttaLogo size={size} className={styles.logoIcon} halo={false} />
      </span>
    </Link>
  );
}

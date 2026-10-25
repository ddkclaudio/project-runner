import Link from 'next/link';
import { IconArrowUpRight } from '@tabler/icons-react';
import { cx } from '@/utils';
import styles from './SectionSidebar.module.css';

export interface SectionSidebarItem {
  label: string;
  href: string;
  active?: boolean;
  external?: boolean;
  badge?: string;
}

export interface SectionSidebarGroup {
  title: string;
  items: SectionSidebarItem[];
}

export interface SectionSidebarProps {
  title?: string;
  groups: SectionSidebarGroup[];
  /** aria-label do aside */
  ariaLabel?: string;
  /**
   * Overlay à direita do sidebar de ícones (não empurra o conteúdo).
   * Em mobile vira barra horizontal normal.
   */
  floating?: boolean;
  className?: string;
}

/**
 * Sidebar secundária de seções (grupos + links).
 * Usada em components, settings, sugestões-IA, memória, etc.
 */
export function SectionSidebar({
  title,
  groups,
  ariaLabel,
  floating = false,
  className,
}: SectionSidebarProps) {
  return (
    <aside
      className={cx(styles.sidebar, floating && styles.floating, className)}
      aria-label={ariaLabel ?? title ?? 'Seções'}
    >
      {title ? <p className={styles.title}>{title}</p> : null}

      <nav className={styles.nav}>
        {groups.map((group) => (
          <div key={group.title} className={styles.group}>
            <p className={styles.groupLabel}>{group.title}</p>
            {group.items.map((item) => (
              <Link
                key={`${group.title}-${item.href}-${item.label}`}
                href={item.href}
                className={cx(styles.item, item.active && styles.active)}
                aria-current={item.active ? 'page' : undefined}
              >
                <span className={styles.label}>{item.label}</span>
                {item.badge ? <span className={styles.badge}>{item.badge}</span> : null}
                {item.external ? (
                  <IconArrowUpRight size={12} className={styles.extIcon} aria-hidden="true" />
                ) : null}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

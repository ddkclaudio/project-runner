'use client';

import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { IconX } from '@tabler/icons-react';
import { OverflowText } from '@/components/ui/OverflowText';
import { cx } from '@/utils';
import styles from './SideDrawer.module.css';

const TITLE_MAX_CHARS = 20;
const PANEL_MIN_PX = 460;
const MOBILE_QUERY = '(max-width: 767px)';

export interface SideDrawerProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Badges ou identidade à esquerda do título. */
  headerLeading?: ReactNode;
  /** Botões extras no header (antes do fechar). */
  headerActions?: ReactNode;
  /** Rodapé fixo (ex.: ação destrutiva). */
  footer?: ReactNode;
  /** aria-label do dialog; default = title em string ou "Painel". */
  ariaLabel?: string;
  /** aria-label do botão fechar / backdrop. */
  closeLabel?: string;
  /** Trava scroll do `body` enquanto aberto. Default: true. Ignorado quando `modal` é false. */
  lockScroll?: boolean;
  /**
   * Cobre a página e bloqueia o que está atrás. False encaixa o painel na linha do pai,
   * sem véu, para o canvas continuar recebendo clique.
   */
  modal?: boolean;
  className?: string;
  bodyClassName?: string;
}

export function SideDrawerIconButton({
  label,
  onClick,
  children,
  disabled,
  className,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={cx(styles.iconBtn, className)}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

function clipTitle(title: string) {
  if (title.length <= TITLE_MAX_CHARS) return title;
  return `${title.slice(0, TITLE_MAX_CHARS)}…`;
}

function headerContentWidth(header: HTMLElement) {
  const cs = getComputedStyle(header);
  const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
  const gap = parseFloat(cs.columnGap || cs.gap) || 0;
  const children = Array.from(header.children) as HTMLElement[];
  let sum = 0;
  children.forEach((child, i) => {
    sum += child.scrollWidth;
    if (i > 0) sum += gap;
  });
  return Math.ceil(sum + pad);
}

function panelChromeX(panel: HTMLElement) {
  const cs = getComputedStyle(panel);
  return (
    parseFloat(cs.borderLeftWidth) +
    parseFloat(cs.borderRightWidth) +
    parseFloat(cs.paddingLeft) +
    parseFloat(cs.paddingRight)
  );
}

export function SideDrawer({
  open,
  onClose,
  title,
  children,
  headerLeading,
  headerActions,
  footer,
  ariaLabel,
  closeLabel = 'Fechar',
  lockScroll = true,
  modal = true,
  className,
  bodyClassName,
}: SideDrawerProps) {
  const panelRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const holdScroll = modal && lockScroll;
    const prev = holdScroll ? document.body.style.overflow : null;
    if (holdScroll) document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      if (holdScroll && prev != null) document.body.style.overflow = prev;
    };
  }, [open, onClose, lockScroll, modal]);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const header = headerRef.current;
    if (!panel || !header) return;
    const panelEl = panel;
    const headerEl = header;

    const mq = window.matchMedia(MOBILE_QUERY);

    function applyFit() {
      if (!modal || !open || mq.matches) {
        panelEl.style.removeProperty('min-width');
        return;
      }
      const needed = headerContentWidth(headerEl) + panelChromeX(panelEl);
      const next = Math.min(Math.max(PANEL_MIN_PX, needed), window.innerWidth);
      panelEl.style.minWidth = `${next}px`;
    }

    applyFit();
    const ro = new ResizeObserver(applyFit);
    ro.observe(header);
    for (const child of header.children) ro.observe(child);
    window.addEventListener('resize', applyFit);
    mq.addEventListener('change', applyFit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', applyFit);
      mq.removeEventListener('change', applyFit);
      panel.style.removeProperty('min-width');
    };
  }, [open, title, headerLeading, headerActions, modal]);

  const fullTitle = typeof title === 'string' ? title : null;
  const label = ariaLabel || fullTitle || 'Painel';

  const panel = (
    <>
      {modal ? (
        <button
          type="button"
          className={cx(styles.backdrop, open && styles.backdropOpen)}
          aria-label={closeLabel}
          tabIndex={open ? 0 : -1}
          onClick={onClose}
        />
      ) : null}
      <aside
        ref={panelRef}
        className={cx(
          styles.panel,
          modal ? open && styles.panelOpen : styles.panelDock,
          !modal && open && styles.panelDockOpen,
          className,
        )}
        role={modal ? 'dialog' : 'complementary'}
        aria-modal={modal ? true : undefined}
        aria-label={label}
        aria-hidden={!open}
        inert={!open && !modal ? true : undefined}
      >
        <div ref={headerRef} className={styles.header}>
          <div className={styles.headerMain}>
            {headerLeading ? <div className={styles.headerLeading}>{headerLeading}</div> : null}
            <h2 className={styles.title}>
              {fullTitle != null ? (
                <OverflowText
                  className={styles.titleText}
                  showDelay={400}
                  tooltipText={fullTitle}
                >
                  {clipTitle(fullTitle)}
                </OverflowText>
              ) : (
                title
              )}
            </h2>
          </div>
          <div className={styles.headerActions}>
            {headerActions}
            <button
              type="button"
              className={styles.iconBtn}
              aria-label={closeLabel}
              title={closeLabel}
              onClick={onClose}
            >
              <IconX size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
        <div className={cx(styles.body, bodyClassName)}>{children}</div>
        {footer ? <div className={styles.footer}>{footer}</div> : null}
      </aside>
    </>
  );

  if (!modal) return panel;
  return createPortal(panel, document.body);
}

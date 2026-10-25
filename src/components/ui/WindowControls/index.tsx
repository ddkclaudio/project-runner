import { useCallback, useEffect, useState } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { IconMinus, IconSquare, IconSquaresDiagonal, IconX } from '@tabler/icons-react';
import { cx } from '@/utils';
import styles from './WindowControls.module.css';

async function win() {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}

/** Controlos nativos substituídos: minimizar / maximizar / fechar. */
export function WindowControls({ className }: { className?: string }) {
  const [maximized, setMaximized] = useState(false);

  const refresh = useCallback(async () => {
    const window = await win();
    if (!window) return;
    try {
      setMaximized(await window.isMaximized());
    } catch {
      /* web preview */
    }
  }, []);

  useEffect(() => {
    void refresh();
    let unlisten: (() => void) | undefined;
    void win().then(async (window) => {
      if (!window) return;
      try {
        unlisten = await window.onResized(() => {
          void refresh();
        });
      } catch {
        /* ignore */
      }
    });
    return () => unlisten?.();
  }, [refresh]);

  return (
    <div className={cx(styles.controls, className)} role="group" aria-label="Controlos da janela">
      <button type="button" className={styles.btn} aria-label="Minimizar" onClick={() => void win().then((w) => w?.minimize())}>
        <IconMinus size={14} stroke={1.75} aria-hidden="true" />
      </button>
      <button
        type="button"
        className={styles.btn}
        aria-label={maximized ? 'Restaurar' : 'Maximizar'}
        onClick={() => void win().then(async (w) => {
          await w?.toggleMaximize();
          void refresh();
        })}
      >
        {maximized ? <IconSquaresDiagonal size={13} stroke={1.75} aria-hidden="true" /> : <IconSquare size={12} stroke={1.75} aria-hidden="true" />}
      </button>
      <button type="button" className={cx(styles.btn, styles.close)} aria-label="Fechar" onClick={() => void win().then((w) => w?.close())}>
        <IconX size={14} stroke={1.75} aria-hidden="true" />
      </button>
    </div>
  );
}

export function useWindowDragHandlers() {
  const onMouseDown = useCallback(async (event: React.MouseEvent) => {
    if (event.button !== 0) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, select, [data-no-drag], [role="menu"], [role="listbox"]')) return;
    const window = await win();
    try {
      await window?.startDragging();
    } catch {
      /* web preview */
    }
  }, []);

  const onDoubleClick = useCallback(async (event: React.MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button, a, input, textarea, select, [data-no-drag]')) return;
    const window = await win();
    try {
      await window?.toggleMaximize();
    } catch {
      /* web preview */
    }
  }, []);

  return { onMouseDown, onDoubleClick };
}

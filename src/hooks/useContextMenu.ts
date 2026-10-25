import { useState, useCallback, useEffect, useRef } from 'react';

interface Position {
  top: number;
  left: number;
}

interface UseContextMenuReturn {
  isOpen: boolean;
  position: Position;
  openAt: (pos: Position) => void;
  close: () => void;
}

/** Fecha o menu ativo ao abrir outro (só um kebab/context menu por vez). */
let activeClose: (() => void) | null = null;

/**
 * Manages position + visibility for floating context menus.
 */
export function useContextMenu(): UseContextMenuReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<Position>({ top: 0, left: 0 });
  const isOpenRef = useRef(false);
  const closeRef = useRef<() => void>(() => {});
  isOpenRef.current = isOpen;

  const close = useCallback(() => {
    setIsOpen(false);
    if (activeClose === closeRef.current) activeClose = null;
  }, []);
  closeRef.current = close;

  const openAt = useCallback(
    (pos: Position) => {
      if (isOpenRef.current) {
        close();
        return;
      }
      if (activeClose && activeClose !== close) activeClose();
      activeClose = close;
      setPosition(pos);
      setIsOpen(true);
    },
    [close],
  );

  useEffect(() => {
    if (!isOpen) return;
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [isOpen, close]);

  useEffect(() => {
    return () => {
      if (activeClose === close) activeClose = null;
    };
  }, [close]);

  return { isOpen, position, openAt, close };
}

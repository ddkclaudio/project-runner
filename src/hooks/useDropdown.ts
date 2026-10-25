import { useState, useCallback, useRef, useEffect, type RefObject } from 'react';

interface UseDropdownOptions {
  /** Painel renderizado fora do trigger (ex.: portal). Cliques nele não fecham. */
  contentRef?: RefObject<HTMLElement | null>;
}

interface UseDropdownReturn {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  triggerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Manages open/close state for a dropdown.
 * Automatically closes when clicking outside.
 */
export function useDropdown(options?: UseDropdownOptions): UseDropdownReturn {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const contentRef = options?.contentRef;

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  useEffect(() => {
    if (!isOpen) return;
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (contentRef?.current?.contains(target)) return;
      close();
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, close, contentRef]);

  return { isOpen, open, close, toggle, triggerRef };
}

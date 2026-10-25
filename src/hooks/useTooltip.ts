import { useState, useCallback, useRef } from 'react';

interface UseTooltipReturn {
  isVisible: boolean;
  show: () => void;
  hide: () => void;
  scheduleHide: () => void;
  cancelHide: () => void;
}

/**
 * Manages tooltip visibility with a short delay on hide
 * so the user can move the cursor onto the tooltip itself.
 */
export function useTooltip(delay = 120): UseTooltipReturn {
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setIsVisible(true);
  }, []);

  const hide = useCallback(() => {
    setIsVisible(false);
  }, []);

  const scheduleHide = useCallback(() => {
    timerRef.current = setTimeout(() => setIsVisible(false), delay);
  }, [delay]);

  const cancelHide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return { isVisible, show, hide, scheduleHide, cancelHide };
}

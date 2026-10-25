'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
  IconAlertCircle,
  IconX,
} from '@tabler/icons-react';
import { cx } from '@/utils';
import styles from './Toast.module.css';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export type ToastInput = {
  title?: string;
  description?: string;
  /** Duração em ms. Default 5000. Use 0 para não auto-fechar. */
  durationMs?: number;
};

type ToastItem = ToastInput & {
  id: string;
  variant: ToastVariant;
  message: string;
};

export type ToastApi = {
  success: (message: string, opts?: ToastInput) => string;
  error: (message: string, opts?: ToastInput) => string;
  info: (message: string, opts?: ToastInput) => string;
  warning: (message: string, opts?: ToastInput) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

const DEFAULT_DURATION_MS = 5000;

const ICONS: Record<ToastVariant, ReactNode> = {
  success: <IconCircleCheck size={18} stroke={2} aria-hidden />,
  error: <IconAlertCircle size={18} stroke={2} aria-hidden />,
  info: <IconInfoCircle size={18} stroke={2} aria-hidden />,
  warning: <IconAlertTriangle size={18} stroke={2} aria-hidden />,
};

function ToastCard({ item, onDismiss }: { item: ToastItem; onDismiss: (id: string) => void }) {
  return (
    <div
      className={cx(styles.toast, styles[item.variant])}
      role={item.variant === 'error' ? 'alert' : 'status'}
      aria-live={item.variant === 'error' ? 'assertive' : 'polite'}
    >
      <span className={styles.iconWrap}>{ICONS[item.variant]}</span>
      <div className={styles.body}>
        {item.title ? <p className={styles.title}>{item.title}</p> : null}
        <p className={styles.message}>{item.message}</p>
        {item.description ? <p className={styles.description}>{item.description}</p> : null}
      </div>
      <button
        type="button"
        className={styles.close}
        aria-label="Fechar notificação"
        onClick={() => onDismiss(item.id)}
      >
        <IconX size={14} aria-hidden />
      </button>
      {item.durationMs !== 0 ? (
        <span
          className={styles.progress}
          style={{ animationDuration: `${item.durationMs ?? DEFAULT_DURATION_MS}ms` }}
          aria-hidden
        />
      ) : null}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const timers = useRef<Map<string, number>>(new Map());
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
    return () => {
      for (const t of timers.current.values()) window.clearTimeout(t);
      timers.current.clear();
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    const t = timers.current.get(id);
    if (t) {
      window.clearTimeout(t);
      timers.current.delete(id);
    }
    setItems((prev) => prev.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (variant: ToastVariant, message: string, opts?: ToastInput) => {
      const id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const durationMs = opts?.durationMs ?? DEFAULT_DURATION_MS;
      const item: ToastItem = {
        id,
        variant,
        message,
        title: opts?.title,
        description: opts?.description,
        durationMs,
      };
      setItems((prev) => [...prev, item].slice(-5));

      if (durationMs > 0) {
        const timer = window.setTimeout(() => dismiss(id), durationMs);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      success: (message, opts) => push('success', message, opts),
      error: (message, opts) => push('error', message, opts),
      info: (message, opts) => push('info', message, opts),
      warning: (message, opts) => push('warning', message, opts),
      dismiss,
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {portalReady
        ? createPortal(
            <div className={styles.viewport} aria-label="Notificações">
              {items.map((item) => (
                <ToastCard key={item.id} item={item} onDismiss={dismiss} />
              ))}
            </div>,
            document.body,
          )
        : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastProvider>');
  return ctx;
}

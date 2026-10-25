'use client';

import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthPage } from '@/components/ui/AuthPage';
import { AuthCard } from '@/components/ui/AuthCard';
import { BrandMark } from '@/components/ui/BrandMark';
import { cx } from '@/utils';
import styles from './ErrorPage.module.css';

export type ErrorCode = 401 | 403 | 404 | 500;

const REDIRECT_SECONDS = 5;

const CONFIG: Record<
  ErrorCode,
  {
    label: string;
    title: string;
    description: string;
    tone: 'amber' | 'red' | 'green';
    autoRedirect: boolean;
  }
> = {
  401: {
    label: '401',
    title: 'Não autorizado',
    description: 'Você precisa estar autenticado para acessar esta página.',
    tone: 'amber',
    autoRedirect: true,
  },
  403: {
    label: '403',
    title: 'Acesso proibido',
    description: 'Você não tem permissão para acessar este recurso.',
    tone: 'red',
    autoRedirect: true,
  },
  404: {
    label: '404',
    title: 'Página não encontrada',
    description: 'A página que você está procurando não existe ou foi movida.',
    tone: 'green',
    autoRedirect: true,
  },
  500: {
    label: '500',
    title: 'Algo deu errado',
    description:
      'Ocorreu um erro inesperado ao carregar esta página. Tente novamente ou volte ao início.',
    tone: 'red',
    autoRedirect: false,
  },
};

interface ErrorPageProps {
  code: ErrorCode;
  title?: string;
  description?: string;
  /** Default: true para 401/403/404; false para 500. */
  autoRedirect?: boolean;
  primaryLabel?: string;
  onPrimary?: () => void;
  /** @deprecated Sempre volta à raiz; mantido por compatibilidade. */
  backHref?: string;
  /** @deprecated Sempre “Voltar ao início”. */
  backLabel?: string;
}

export function ErrorPage({
  code,
  title,
  description,
  autoRedirect,
  primaryLabel,
  onPrimary,
}: ErrorPageProps) {
  const cfg = CONFIG[code];
  const resolvedTitle = title ?? cfg.title;
  const resolvedDescription = description ?? cfg.description;
  const shouldRedirect = autoRedirect ?? cfg.autoRedirect;
  const navigate = useNavigate();
  const [secondsLeft, setSecondsLeft] = useState(REDIRECT_SECONDS);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!shouldRedirect) return;

    cancelled.current = false;
    setSecondsLeft(REDIRECT_SECONDS);

    const tick = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(tick);
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => {
      cancelled.current = true;
      window.clearInterval(tick);
    };
  }, [code, shouldRedirect]);

  useEffect(() => {
    if (!shouldRedirect || secondsLeft > 0 || cancelled.current) return;
    navigate('/', { replace: true });
  }, [navigate, secondsLeft, shouldRedirect]);

  function goHome() {
    cancelled.current = true;
    if (onPrimary) {
      onPrimary();
      return;
    }
    navigate('/', { replace: true });
  }

  return (
    <AuthPage>
      <AuthCard maxWidth={440}>
        <div className={styles.inner}>
          <div className={styles.brand}>
            <BrandMark />
          </div>

          <div className={cx(styles.hero, styles[cfg.tone])} aria-hidden>
            <span className={styles.codeGlow}>{cfg.label}</span>
          </div>

          <h1 className={styles.title}>{resolvedTitle}</h1>
          <p className={styles.description}>{resolvedDescription}</p>

          <button type="button" className={styles.primaryCta} onClick={goHome}>
            {primaryLabel ?? (shouldRedirect ? 'Voltar ao início' : 'Tentar novamente')}
          </button>

          {shouldRedirect ? (
            <p className={styles.countdown} aria-live="polite">
              {secondsLeft > 0 ? `Redirecionando em ${secondsLeft}s…` : 'Redirecionando…'}
            </p>
          ) : null}
        </div>
      </AuthCard>
    </AuthPage>
  );
}

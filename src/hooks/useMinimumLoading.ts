import { useEffect, useRef, useState } from 'react';

/** Tempo mínimo padrão de skeleton em todo o app. */
export const SKELETON_MIN_MS = 500;

/**
 * Mantém `true` por pelo menos `minMs` após o loading começar,
 * evitando flash skeleton → conteúdo quando a API responde rápido demais.
 * Se `loading` voltar a `true` antes do timer, o skeleton permanece (sem piscar).
 */
export function useMinimumLoading(loading: boolean, minMs: number = SKELETON_MIN_MS): boolean {
  const [visible, setVisible] = useState(loading);
  const startedAtRef = useRef<number | null>(loading ? Date.now() : null);

  useEffect(() => {
    if (loading) {
      if (startedAtRef.current == null) {
        startedAtRef.current = Date.now();
      }
      setVisible(true);
      return;
    }

    if (startedAtRef.current == null) {
      setVisible(false);
      return;
    }

    const elapsed = Date.now() - startedAtRef.current;
    const remaining = Math.max(0, minMs - elapsed);

    // Evita setVisible(false) síncrono no mesmo tick (remaining === 0) quando
    // o loading pode voltar a true no efeito seguinte do mesmo frame/ciclo.
    const timer = window.setTimeout(
      () => {
        startedAtRef.current = null;
        setVisible(false);
      },
      Math.max(remaining, 1),
    );

    return () => window.clearTimeout(timer);
  }, [loading, minMs]);

  return visible;
}

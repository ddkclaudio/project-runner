import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';

type DynamicOptions<P> = {
  ssr?: boolean;
  loading?: () => ReactNode;
};

/** Minimal shim for `next/dynamic`, Vite code splitting via lazy() + Suspense. */
export default function dynamic<P extends object>(
  loader: () => Promise<{ default: ComponentType<P> }>,
  options?: DynamicOptions<P>,
): ComponentType<P> {
  const Lazy = lazy(loader);
  const fallback = options?.loading?.() ?? null;

  function DynamicComponent(props: P) {
    return (
      <Suspense fallback={fallback}>
        <Lazy {...props} />
      </Suspense>
    );
  }

  return DynamicComponent;
}

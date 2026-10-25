import { useMemo } from 'react';
import {
  useNavigate,
  useLocation,
  useSearchParams as useRouterSearchParams,
  useParams as useRouterParams,
} from 'react-router-dom';

/** Drop-in shim for `next/navigation` useRouter. */
export function useRouter() {
  const navigate = useNavigate();
  return useMemo(
    () => ({
      push: (href: string, _opts?: { scroll?: boolean }) => navigate(href),
      replace: (href: string, _opts?: { scroll?: boolean }) => navigate(href, { replace: true }),
      back: () => navigate(-1),
      forward: () => navigate(1),
      refresh: () => window.location.reload(),
      prefetch: (_href: string) => {},
    }),
    [navigate],
  );
}

export function usePathname(): string {
  const { pathname } = useLocation();
  return pathname;
}

/** Next returns URLSearchParams; RR returns a tuple, shim matches Next API. */
export function useSearchParams(): URLSearchParams {
  const [searchParams] = useRouterSearchParams();
  return searchParams;
}

export function useParams<
  T extends Record<string, string | undefined> = Record<string, string | undefined>,
>(): T {
  const params = useRouterParams();
  const splat = params['*'];
  if (typeof splat === 'string' && splat.length > 0) {
    return { ...params, path: splat.split('/').filter(Boolean).join('/') } as unknown as T;
  }
  return params as T;
}

export function notFound(): never {
  window.location.replace('/404');
  throw new Error('NOT_FOUND');
}

export function redirect(href: string): never {
  window.location.replace(href);
  throw new Error('REDIRECT');
}

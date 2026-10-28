import { parseAppRoute } from '@/lib/launcher-nav';
import { appHref, libraryList, type AppView } from '@/lib/launcher-api';

export type SwitcherId = 'org' | 'app' | 'branch' | 'action';
export type ContextMode = 'library' | 'app' | 'none';

export const SWITCHER_STACK: SwitcherId[] = ['org', 'app', 'branch', 'action'];

export type ContextStack = {
  mode: ContextMode;
  layers: SwitcherId[];
  repository?: string;
  section?: string;
};

function isDeepLibraryPath(pathname: string): boolean {
  return (
    pathname.startsWith('/catalog') ||
    pathname.startsWith('/comunicacoes') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/orgs') ||
    pathname.startsWith('/apps/new') ||
    pathname.startsWith('/components')
  );
}

export function parseContextStack(pathname: string): ContextStack {
  const app = parseAppRoute(pathname);
  if (app) {
    return {
      mode: 'app',
      layers: ['org', 'app', 'branch', 'action'],
      repository: app.repository,
      section: app.section,
    };
  }
  if (pathname === '/' || isDeepLibraryPath(pathname)) {
    return { mode: 'library', layers: ['org'] };
  }
  return { mode: 'none', layers: [] };
}

/**
 * Pathname pai para a seta Voltar do topbar (estilo NeuronLab).
 * Declarativo a partir da URL — não usa history.back().
 */
export function backTarget(pathname: string): string | null {
  const app = parseAppRoute(pathname);
  if (app) {
    if (app.section) {
      if (app.folder) return appHref(app.folder);
      return appHref(app.repository);
    }
    return '/';
  }
  if (isDeepLibraryPath(pathname)) return '/';
  return null;
}

/** Encontra a app na library destino (folderName primeiro, senão repository). */
export function matchAppInLibrary(apps: AppView[], pathname: string): AppView | undefined {
  const route = parseAppRoute(pathname);
  if (!route) return undefined;
  const routeKey = (route.folder || route.repository).toLowerCase();
  if (route.folder) {
    return apps.find((app) => (app.folderName || '').toLowerCase() === routeKey);
  }
  return apps.find((app) => app.repository.toLowerCase() === routeKey);
}

/**
 * Após trocar de org (workspace já activo): manter `/app/...` só se a app
 * existir na library da destino; senão ir para a biblioteca.
 */
export async function resolveOrgSwitcherNavigation(pathname: string): Promise<string | null> {
  const route = parseAppRoute(pathname);
  if (!route) return null;

  const library = await libraryList();
  const match = matchAppInLibrary(library.apps ?? [], pathname);
  if (!match) return '/';

  const target = appHref(match, route.section);
  return target === pathname || decodeURIComponent(target) === pathname ? null : target;
}

/** Reescreve URL ao trocar app, preservando a secção (estilo NeuronLab). */
export function resolveSwitcherNavigation(
  changed: SwitcherId,
  newId: string,
  pathname: string,
): string | null {
  if (changed === 'org') {
    // Preferir resolveOrgSwitcherNavigation (async) no OrgSwitcher.
    return pathname.startsWith('/app/') || pathname.startsWith('/apps/') ? '/' : null;
  }
  if (changed === 'app') {
    const current = parseAppRoute(pathname);
    const section = current?.section ?? '';
    return appHref(newId, section);
  }
  return null;
}

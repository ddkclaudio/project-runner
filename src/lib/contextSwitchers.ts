import { parseAppRoute } from '@/lib/launcher-nav';
import { appHref } from '@/lib/launcher-api';

export type SwitcherId = 'org' | 'app' | 'branch' | 'action';
export type ContextMode = 'library' | 'app' | 'none';

export const SWITCHER_STACK: SwitcherId[] = ['org', 'app', 'branch', 'action'];

export type ContextStack = {
  mode: ContextMode;
  layers: SwitcherId[];
  repository?: string;
  section?: string;
};

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
  if (
    pathname === '/' ||
    pathname.startsWith('/catalog') ||
    pathname.startsWith('/settings') ||
    pathname.startsWith('/orgs') ||
    pathname.startsWith('/apps/new') ||
    pathname.startsWith('/components')
  ) {
    return { mode: 'library', layers: ['org'] };
  }
  return { mode: 'none', layers: [] };
}

/** Reescreve URL ao trocar app, preservando a secção (estilo NeuronLab). */
export function resolveSwitcherNavigation(
  changed: SwitcherId,
  newId: string,
  pathname: string,
): string | null {
  if (changed === 'org') {
    return pathname.startsWith('/app/') || pathname.startsWith('/apps/') ? '/' : null;
  }
  if (changed === 'app') {
    const current = parseAppRoute(pathname);
    const section = current?.section ?? '';
    return appHref(newId, section);
  }
  return null;
}

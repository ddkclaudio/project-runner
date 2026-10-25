export type AppRoute = {
  owner: string;
  repo: string;
  /** Chave da app: pasta (preferida) ou `dono/nome`. */
  repository: string;
  /** Pasta da app no disco, quando a rota é `/app/:folder`. */
  folder?: string;
  section: string;
};

export function parseAppRoute(pathname: string): AppRoute | null {
  const byFolder = pathname.match(/^\/app\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (byFolder) {
    const folder = decodeURIComponent(byFolder[1]);
    return {
      owner: '',
      repo: folder,
      repository: folder,
      folder,
      section: byFolder[2] ?? '',
    };
  }
  // Legado `/apps/f/:folder`
  const legacyFolder = pathname.match(/^\/apps\/f\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (legacyFolder) {
    const folder = decodeURIComponent(legacyFolder[1]);
    return {
      owner: '',
      repo: folder,
      repository: folder,
      folder,
      section: legacyFolder[2] ?? '',
    };
  }
  const match = pathname.match(/^\/apps\/([^/]+)\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (!match) return null;
  if (match[1] === 'f' || match[1] === 'new') return null;
  const owner = decodeURIComponent(match[1]);
  const repo = decodeURIComponent(match[2]);
  return {
    owner,
    repo,
    repository: `${owner}/${repo}`,
    section: match[3] ?? '',
  };
}

export function settingsSection(pathname: string) {
  if (pathname.startsWith('/settings/github')) return 'github';
  if (pathname.startsWith('/settings/appearance')) return 'appearance';
  if (pathname.startsWith('/settings/launch')) return 'launch';
  return 'general';
}

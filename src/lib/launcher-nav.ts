export type AppRoute = {
  owner: string;
  repo: string;
  repository: string;
  section: string;
};

export function parseAppRoute(pathname: string): AppRoute | null {
  const match = pathname.match(/^\/apps\/([^/]+)\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (!match) return null;
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

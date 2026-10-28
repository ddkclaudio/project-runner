import { Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { appHref, libraryList } from '@/lib/launcher-api';
import { PageShell } from '@/components/ui/PageShell';
import { useOrg } from '@/contexts/OrgContext';

/** `/apps/:owner/:repo` → `/app/:folder` se o repo for único; senão biblioteca. */
export function LegacyAppRedirect() {
  const { owner, repo, section } = useParams();
  const { activeOrg } = useOrg();
  const library = useQuery({
    queryKey: ['launcher', 'library', activeOrg?.id],
    queryFn: libraryList,
    enabled: Boolean(activeOrg?.id),
  });
  const key = `${owner ?? ''}/${repo ?? ''}`.toLowerCase();

  if (library.isLoading) {
    return (
      <PageShell>
        <p style={{ color: 'var(--text-muted)' }}>A carregar…</p>
      </PageShell>
    );
  }

  const matches = (library.data?.apps ?? []).filter((app) => app.repository.toLowerCase() === key);
  if (matches.length === 1) {
    return <Navigate to={appHref(matches[0], section ?? '')} replace />;
  }
  return <Navigate to="/" replace />;
}

/** `/apps/f/:folder` → `/app/:folder`. */
export function LegacyFolderRedirect() {
  const { folder, section } = useParams();
  if (!folder) return <Navigate to="/" replace />;
  const base = `/app/${encodeURIComponent(decodeURIComponent(folder))}`;
  return <Navigate to={section ? `${base}/${section}` : base} replace />;
}

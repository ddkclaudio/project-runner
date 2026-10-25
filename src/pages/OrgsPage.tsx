import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { IconAffiliate, IconPlus, IconTicket, IconUsers } from '@tabler/icons-react';
import { PageShell } from '@/components/ui/PageShell';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { useToast } from '@/components/ui/Toast';
import { useOrg } from '@/contexts/OrgContext';
import { authErrorMessage } from '@/lib/auth-api';
import styles from './library.module.css';

function roleLabel(role: string, isOwner: boolean) {
  if (isOwner || role === 'owner') return 'Dono';
  if (role === 'admin') return 'Admin';
  return 'Membro';
}

export function OrgsPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { orgs, activeOrg, loading, switchOrg } = useOrg();
  const [switchingId, setSwitchingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSwitch(orgId: string) {
    if (orgId === activeOrg?.id) return;
    setSwitchingId(orgId);
    setError(null);
    try {
      await switchOrg(orgId);
      toast.success('Organização ativa atualizada.');
    } catch (err) {
      const message = authErrorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setSwitchingId(null);
    }
  }

  return (
    <PageShell>
      <PageShell.Heading
        subtitle="Todas as organizações a que pertence."
        actions={
          <>
            <Button variant="secondary" size="sm" leftIcon={<IconPlus size={14} />} onClick={() => navigate('/orgs/new')}>
              Nova organização
            </Button>
            <Button size="sm" leftIcon={<IconTicket size={14} />} onClick={() => navigate('/orgs/invite')}>
              Aceitar convite
            </Button>
            {activeOrg ? (
              <Button size="sm" leftIcon={<IconUsers size={14} />} onClick={() => navigate(`/orgs/${activeOrg.id}/members`)}>
                Membros da ativa
              </Button>
            ) : null}
          </>
        }
      >
        Organizações
      </PageShell.Heading>

      {error ? <InlineAlert>{error}</InlineAlert> : null}

      {loading ? (
        <p className={styles.empty}>A carregar organizações…</p>
      ) : orgs.length === 0 ? (
        <p className={styles.empty}>
          Ainda não pertence a nenhuma organização. <Link to="/orgs/new">Criar uma</Link> ou{' '}
          <Link to="/orgs/invite">aceitar um convite</Link>.
        </p>
      ) : (
        <div className={styles.list}>
          {orgs.map((org) => {
            const isActive = activeOrg?.id === org.id;
            const busy = switchingId === org.id;
            return (
              <div key={org.id} className={styles.listRow}>
                <div className={styles.listMain}>
                  <IconAffiliate size={18} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
                  <div className={styles.listText}>
                    <div className={styles.listTitle}>
                      <span>{org.name}</span>
                      {isActive ? <Badge variant="green">Ativa</Badge> : null}
                    </div>
                    <div className={styles.listMeta}>
                      {org.slug} · {roleLabel(org.role, org.isOwner)}
                    </div>
                  </div>
                </div>
                <div className={styles.listActions}>
                  <Button onClick={() => navigate(`/orgs/${org.id}/members`)} leftIcon={<IconUsers size={14} />}>
                    Membros
                  </Button>
                  <Button
                    variant={isActive ? 'ghost' : 'secondary'}
                    disabled={isActive || busy}
                    loading={busy}
                    onClick={() => void handleSwitch(org.id)}
                  >
                    {isActive ? 'Em uso' : 'Usar'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}

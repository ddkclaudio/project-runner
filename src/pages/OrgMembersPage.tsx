import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageShell } from '@/components/ui/PageShell';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { FormCard, FormRow } from '@/components/ui/FormCard';
import { useToast } from '@/components/ui/Toast';
import { authErrorMessage } from '@/lib/auth-api';
import { inviteMember, listInvites, listMembers, removeMember, revokeInvite, updateMemberRole } from '@/lib/org-api';
import { useOrg } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import styles from './library.module.css';

export function OrgMembersPage() {
  const params = useParams();
  const orgId = params.orgId ?? '';
  const { activeOrg, orgs } = useOrg();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const org = orgs.find((item) => item.id === orgId) || (activeOrg?.id === orgId ? activeOrg : null);
  const members = useQuery({ queryKey: ['orgs', orgId, 'members'], queryFn: () => listMembers(orgId), enabled: Boolean(orgId) });
  const invites = useQuery({
    queryKey: ['orgs', orgId, 'invites'],
    queryFn: () => listInvites(orgId),
    enabled: Boolean(orgId) && Boolean(org?.isOwner),
  });
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function invite(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const invite = await inviteMember(orgId, email);
      toast.success(`Convite criado. Código: ${invite.code}`);
      setEmail('');
      await queryClient.invalidateQueries({ queryKey: ['orgs', orgId] });
    } catch (err) {
      setError(authErrorMessage(err));
    }
  }

  return (
    <PageShell>
      <PageShell.Heading subtitle={org?.name || orgId}>Membros</PageShell.Heading>
      {error ? <InlineAlert>{error}</InlineAlert> : null}
      {members.error ? <InlineAlert>{authErrorMessage(members.error)}</InlineAlert> : null}

      {members.isLoading ? (
        <p className={styles.empty}>A carregar membros…</p>
      ) : (members.data ?? []).length === 0 ? (
        <p className={styles.empty}>Nenhum membro nesta organização.</p>
      ) : (
        <div className={styles.list}>
          {(members.data ?? []).map((member) => (
            <div key={member.userId} className={styles.listRow}>
              <div className={styles.listText}>
                <div className={styles.listTitle}>{member.displayName}</div>
                <div className={styles.listMeta}>
                  {member.email} · {member.role}
                </div>
              </div>
              {org?.isOwner && member.userId !== user?.uid ? (
                <div className={styles.listActions}>
                  <Button
                    onClick={() =>
                      void updateMemberRole(orgId, member.userId, member.role === 'owner' ? 'member' : 'owner')
                        .then(() => queryClient.invalidateQueries({ queryKey: ['orgs', orgId] }))
                        .catch((err) => toast.error(authErrorMessage(err)))
                    }
                  >
                    Tornar {member.role === 'owner' ? 'member' : 'owner'}
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() =>
                      void removeMember(orgId, member.userId)
                        .then(() => queryClient.invalidateQueries({ queryKey: ['orgs', orgId] }))
                        .catch((err) => toast.error(authErrorMessage(err)))
                    }
                  >
                    Remover
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {org?.isOwner ? (
        <PageShell.Section className={styles.blockGap}>
          <FormCard onSubmit={(event) => void invite(event)} aria-label="Convidar membro">
            <FormCard.Header title="Convidar" subtitle="O código é local (como o reset de password)." />
            <FormRow label="E-mail">
              <Input value={email} onChange={(event) => setEmail(event.target.value)} />
            </FormRow>
            <FormCard.Footer right={<Button type="submit" variant="secondary">Criar convite</Button>} />
          </FormCard>

          {(invites.data ?? []).length > 0 ? (
            <div className={styles.list}>
              {(invites.data ?? []).map((invite) => (
                <div key={invite.id} className={styles.listRow}>
                  <div className={styles.listText}>
                    <div className={styles.listTitle}>{invite.email}</div>
                    <div className={styles.listMeta}>
                      Código <strong>{invite.code}</strong>
                    </div>
                  </div>
                  <div className={styles.listActions}>
                    <Button
                      variant="danger"
                      onClick={() =>
                        void revokeInvite(orgId, invite.id)
                          .then(() => queryClient.invalidateQueries({ queryKey: ['orgs', orgId] }))
                          .catch((err) => toast.error(authErrorMessage(err)))
                      }
                    >
                      Revogar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </PageShell.Section>
      ) : null}
    </PageShell>
  );
}

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
import { inviteMember, listInvites, revokeInvite } from '@/lib/org-api';
import { useOrg } from '@/contexts/OrgContext';
import styles from './library.module.css';

export function OrgMembersPage() {
  const params = useParams();
  const orgId = params.orgId ?? '';
  const { activeOrg, orgs } = useOrg();
  const toast = useToast();
  const queryClient = useQueryClient();
  const org = orgs.find((item) => item.id === orgId) || (activeOrg?.id === orgId ? activeOrg : null);
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

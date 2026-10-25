import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '@/components/ui/PageShell';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FormCard, FormRow } from '@/components/ui/FormCard';
import { useOrg } from '@/contexts/OrgContext';
import { authErrorMessage } from '@/lib/auth-api';

export function NewOrgPage() {
  const { create } = useOrg();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const org = await create(name);
      navigate(`/orgs/${org.id}/members`);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <FormCard onSubmit={(event) => void submit(event)} aria-label="Nova organização">
        {error ? <FormCard.Alert>{error}</FormCard.Alert> : null}
        <FormCard.Header
          title="Nova organização"
          subtitle="Cada organização tem a sua biblioteca e dados."
        />
        <FormRow label="Nome">
          <Input value={name} onChange={(event) => setName(event.target.value)} required />
        </FormRow>
        <FormCard.Footer
          right={
            <Button type="submit" variant="secondary" disabled={busy || !name.trim()} loading={busy}>
              Criar
            </Button>
          }
        />
      </FormCard>
    </PageShell>
  );
}

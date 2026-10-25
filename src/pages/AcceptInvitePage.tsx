import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageShell } from '@/components/ui/PageShell';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FormCard, FormRow } from '@/components/ui/FormCard';
import { useOrg } from '@/contexts/OrgContext';
import { authErrorMessage } from '@/lib/auth-api';

export function AcceptInvitePage() {
  const { accept } = useOrg();
  const navigate = useNavigate();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const org = await accept(code);
      navigate(`/orgs/${org.id}/members`);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell>
      <FormCard onSubmit={(event) => void submit(event)} aria-label="Aceitar convite">
        {error ? <FormCard.Alert>{error}</FormCard.Alert> : null}
        <FormCard.Header
          title="Aceitar convite"
          subtitle="Cole o código que recebeu do dono da organização."
        />
        <FormRow label="Código">
          <Input value={code} onChange={(event) => setCode(event.target.value)} required />
        </FormRow>
        <FormCard.Footer
          right={
            <Button type="submit" variant="secondary" disabled={busy || !code.trim()} loading={busy}>
              Aceitar
            </Button>
          }
        />
      </FormCard>
    </PageShell>
  );
}

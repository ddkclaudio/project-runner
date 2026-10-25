import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { PageShell } from '@/components/ui/PageShell';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FormCard, FormRow } from '@/components/ui/FormCard';
import { appHref, launcherError, librarySave } from '@/lib/launcher-api';

export function NewAppPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [repository, setRepository] = useState('');
  const [folderName, setFolderName] = useState('');
  const [appIconUrl, setAppIconUrl] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const saved = await librarySave({
        name,
        repository,
        folderName,
        appIconUrl: appIconUrl || null,
      });
      await queryClient.invalidateQueries({ queryKey: ['launcher'] });
      navigate(appHref(saved.repository));
    } catch (err) {
      setError(launcherError(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <PageShell>
      <FormCard onSubmit={(event) => void onSubmit(event)} aria-label="Nova app">
        {error ? <FormCard.Alert>{error}</FormCard.Alert> : null}
        <FormCard.Header
          title="Nova app"
          subtitle="A entrada fica em apps.json, ao lado do executável do Painel."
        />
        <FormRow label="Nome">
          <Input value={name} onChange={(event) => setName(event.target.value)} required />
        </FormRow>
        <FormRow label="Repositório">
          <Input placeholder="dono/nome" value={repository} onChange={(event) => setRepository(event.target.value)} required />
        </FormRow>
        <FormRow label="Pasta" optionalLabel="(opcional)">
          <Input value={folderName} onChange={(event) => setFolderName(event.target.value)} />
          <FormCard.Hint>Se ficar vazio, usa o nome do repositório.</FormCard.Hint>
        </FormRow>
        <FormRow label="Ícone" optionalLabel="(opcional)">
          <Input placeholder="https://..." value={appIconUrl} onChange={(event) => setAppIconUrl(event.target.value)} />
        </FormRow>
        <FormCard.Footer
          right={
            <Button type="submit" variant="secondary" loading={pending}>
              Adicionar
            </Button>
          }
        />
      </FormCard>
    </PageShell>
  );
}

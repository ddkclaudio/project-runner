import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { PageShell } from '@/components/ui/PageShell';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
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
      <PageShell.Heading subtitle="A entrada fica em apps.json, ao lado do executável do Painel.">Nova app</PageShell.Heading>
      <form onSubmit={(event) => void onSubmit(event)} style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 520 }}>
        {error ? <InlineAlert>{error}</InlineAlert> : null}
        <Input label="Nome" value={name} onChange={(event) => setName(event.target.value)} required />
        <Input label="Repositório" placeholder="dono/nome" value={repository} onChange={(event) => setRepository(event.target.value)} required />
        <Input label="Pasta" hint="Se ficar vazio, usa o nome do repositório." value={folderName} onChange={(event) => setFolderName(event.target.value)} />
        <Input label="Ícone" placeholder="https://..." value={appIconUrl} onChange={(event) => setAppIconUrl(event.target.value)} />
        <Button type="submit" variant="primary" loading={pending}>Adicionar</Button>
      </form>
    </PageShell>
  );
}

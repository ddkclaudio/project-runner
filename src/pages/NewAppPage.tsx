import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PageShell } from '@/components/ui/PageShell';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { FormCard, FormRow } from '@/components/ui/FormCard';
import { Modal } from '@/components/ui/Modal';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { StatusMessage } from '@/components/StatusMessage';
import { appHref, githubRepos, launcherError, librarySave, settingsGet, type GithubRepo } from '@/lib/launcher-api';
import { cx } from '@/utils';
import styles from './new-app.module.css';

export function NewAppPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['launcher', 'settings'], queryFn: settingsGet });
  const [choice, setChoice] = useState<'manual' | 'github' | null>(null);
  const [missingGithub, setMissingGithub] = useState(false);
  const [name, setName] = useState('');
  const [repository, setRepository] = useState('');
  const [appIconUrl, setAppIconUrl] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  const [repoQuery, setRepoQuery] = useState('');

  const hasGithub = Boolean(
    settings.data?.githubAccounts.some((account) => account.token.trim()) || settings.data?.githubApiToken.trim(),
  );
  const repos = useQuery({
    queryKey: ['launcher', 'github-repos'],
    queryFn: githubRepos,
    enabled: choice === 'github',
    retry: false,
  });

  const shown = useMemo(() => {
    const term = repoQuery.trim().toLowerCase();
    return (repos.data?.repos ?? []).filter((repo) => {
      if (!term) return true;
      return (
        repo.name.toLowerCase().includes(term) ||
        repo.fullName.toLowerCase().includes(term) ||
        repo.accountLabel.toLowerCase().includes(term)
      );
    });
  }, [repoQuery, repos.data]);

  function pickGithub() {
    if (settings.isLoading) return;
    if (!hasGithub) {
      setMissingGithub(true);
      return;
    }
    setMissingGithub(false);
    setChoice('github');
  }

  function fillFromRepo(repo: GithubRepo) {
    setName(repo.name);
    setRepository(repo.fullName);
    if (repo.avatarUrl) setAppIconUrl(repo.avatarUrl);
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      const saved = await librarySave({
        name,
        repository,
        folderName: '',
        appIconUrl: appIconUrl || null,
      });
      await queryClient.invalidateQueries({ queryKey: ['launcher'] });
      navigate(appHref(saved));
    } catch (err) {
      setError(launcherError(err));
    } finally {
      setPending(false);
    }
  }

  const warnings = repos.data?.warnings ?? [];

  return (
    <PageShell>
      <Modal isOpen={choice === null} onClose={() => navigate('/')} title="Nova app" maxWidth={560}>
        <Modal.Content>
          {missingGithub ? (
            <InlineAlert variant="warning">
              Nenhuma conta GitHub. <Link to="/settings/github">Configurar em Definições → GitHub</Link>
            </InlineAlert>
          ) : null}
          <div className={styles.choices}>
            <button type="button" className={styles.choice} onClick={() => setChoice('manual')}>
              <span className={styles.choiceTitle}>Sem conta GitHub</span>
              <span className={styles.choiceText}>Preencher nome e repositório à mão.</span>
            </button>
            <button type="button" className={styles.choice} onClick={pickGithub}>
              <span className={styles.choiceTitle}>Usar conta GitHub</span>
              <span className={styles.choiceText}>Escolher um repositório das contas guardadas.</span>
            </button>
          </div>
        </Modal.Content>
      </Modal>

      {choice ? (
        <FormCard onSubmit={(event) => void onSubmit(event)} aria-label="Nova app">
          {error ? <FormCard.Alert>{error}</FormCard.Alert> : null}
          <FormCard.Header
            title="Nova app"
            subtitle="Disco: {pasta}/{orgSlug}/{app}/repositories/{repo}/. Exemplo: gitname/react-gh-pages."
            actions={
              choice === 'manual' ? (
                <Button
                  type="button"
                  onClick={() => {
                    setName('React GH Pages');
                    setRepository('gitname/react-gh-pages');
                  }}
                >
                  Preencher exemplo React Hello World
                </Button>
              ) : undefined
            }
          />
          {choice === 'github' ? (
            <div className={styles.repos}>
              {repos.isPending ? <p className={styles.choiceText}>A carregar repositórios…</p> : null}
              {repos.error ? (
                <InlineAlert>
                  <StatusMessage text={launcherError(repos.error)} />
                </InlineAlert>
              ) : null}
              {warnings.length > 0 ? (
                <div className={styles.warnings}>
                  {warnings.map((warning) => (
                    <InlineAlert key={warning} variant="warning">
                      <StatusMessage text={warning} />
                    </InlineAlert>
                  ))}
                </div>
              ) : null}
              {repos.isSuccess ? (
                <div className={styles.picker}>
                  <Input
                    value={repoQuery}
                    onChange={(event) => setRepoQuery(event.target.value)}
                    placeholder="Buscar repositório ou conta"
                    aria-label="Buscar repositórios GitHub"
                  />
                  <div className={styles.repoList}>
                    {shown.length === 0 ? (
                      <p className={styles.empty}>Nenhum repositório</p>
                    ) : (
                      shown.map((repo) => {
                        const selected = repository === repo.fullName;
                        return (
                          <button
                            key={`${repo.accountId}:${repo.fullName}`}
                            type="button"
                            className={cx(styles.repo, selected && styles.selected)}
                            aria-current={selected ? 'true' : undefined}
                            onClick={() => fillFromRepo(repo)}
                          >
                            <span className={styles.repoName}>{repo.fullName}</span>
                            <span className={styles.repoAccount}>{repo.accountLabel}</span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <FormRow label="Nome">
            <Input value={name} onChange={(event) => setName(event.target.value)} required />
          </FormRow>
          <FormRow label="Repositório">
            <Input placeholder="dono/nome" value={repository} onChange={(event) => setRepository(event.target.value)} required />
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
      ) : null}
    </PageShell>
  );
}

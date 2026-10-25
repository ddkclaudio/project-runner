import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import { openUrl } from '@tauri-apps/plugin-opener';
import { PageShell } from '@/components/ui/PageShell';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Modal } from '@/components/ui/Modal';
import { DangerZone } from '@/components/ui/DangerZone';
import { useToast } from '@/components/ui/Toast';
import { ChoiceList, useLibraryMutations } from '@/components/launcher/LibraryCard';
import {
  appChangelog,
  appClearIcon,
  appDeleteInstall,
  appDetail,
  appExecutables,
  appLocate,
  appReleases,
  appSetExecutable,
  appSetIcon,
  appShortcutDesktop,
  appShortcutSteam,
  appSkipUpdate,
  launcherError,
  libraryRemove,
  librarySave,
  statusLabel,
  type AppView,
} from '@/lib/launcher-api';
import styles from './library.module.css';

export function AppPage() {
  const params = useParams();
  const section = params.section ?? '';
  const repository = `${params.owner}/${params.repo}`;
  const detail = useQuery({ queryKey: ['launcher', 'app', repository], queryFn: () => appDetail(repository) });
  const app = detail.data;
  if (detail.isLoading) return <PageShell><p className={styles.meta}>A carregar…</p></PageShell>;
  if (!app) return <PageShell><InlineAlert>{launcherError(detail.error) || 'App não encontrada.'}</InlineAlert></PageShell>;
  if (section === 'versions') return <Versions app={app} />;
  if (section === 'executable') return <Executable app={app} />;
  if (section === 'shortcuts') return <Shortcuts app={app} />;
  if (section === 'changelog') return <Changelog app={app} />;
  return <Overview app={app} />;
}

function Overview({ app }: { app: AppView }) {
  const actions = useLibraryMutations();
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [choice, setChoice] = useState<string[] | null>(null);
  const [confirmWine, setConfirmWine] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [name, setName] = useState(app.name);
  const [folderName, setFolderName] = useState(app.folderName);
  const [iconUrl, setIconUrl] = useState(app.appIconUrl || '');
  const [locate, setLocate] = useState('');
  const [iconFile, setIconFile] = useState('');

  async function primary(assetName?: string, wine = false) {
    if (app.status === 'installed' && !assetName) {
      const result = await actions.launch(app);
      if (result?.needsChoice) setChoice(result.executables);
      return;
    }
    const result = await actions.install(app, { assetName, confirmWine: wine });
    if (!result) return;
    setWarning(result.warning ?? null);
    setConfirmWine(result.needsConfirm);
    setChoice(result.needsChoice || result.needsConfirm ? result.assets : null);
    await queryClient.invalidateQueries({ queryKey: ['launcher', 'app', app.repository] });
  }

  async function saveEntry() {
    try {
      await librarySave({ ...app, name, folderName, appIconUrl: iconUrl || null }, app.repository);
      await queryClient.invalidateQueries({ queryKey: ['launcher'] });
      toast.success('Entrada atualizada.');
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  return (
    <PageShell>
      <PageShell.Heading
        subtitle={app.repository}
        actions={<StatusBadge label={statusLabel(app.status)} tone={app.status === 'update' ? 'warning' : app.status === 'installed' ? 'success' : 'muted'} />}
      >
        {app.name}
      </PageShell.Heading>
      <div className={styles.stack}>
        <p className={styles.meta}>
          {app.installedVersion ? `Instalada ${app.installedVersion}` : 'Por instalar'}
          {app.remoteVersion ? ` · remota ${app.remoteVersion}` : ''}
          {app.lastPlayed ? ` · último uso ${app.lastPlayed}` : ''}
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => void primary()}>{actions.primaryLabel(app)}</Button>
          <Button onClick={() => void actions.openFolder(app)}>Abrir pasta</Button>
          <Button onClick={() => void actions.hide(app)}>{app.manuallyHidden ? 'Mostrar' : 'Ocultar'}</Button>
          <Button onClick={() => void openUrl(`https://github.com/${app.repository}`)}>GitHub</Button>
          {app.remoteVersion ? (
            <Button onClick={() => void appSkipUpdate(app.repository, app.remoteVersion).then(() => queryClient.invalidateQueries({ queryKey: ['launcher'] })).catch((err) => toast.error(launcherError(err)))}>
              Saltar {app.remoteVersion}
            </Button>
          ) : null}
        </div>
        <Input label="Nome" value={name} onChange={(event) => setName(event.target.value)} />
        <Input label="Pasta" value={folderName} onChange={(event) => setFolderName(event.target.value)} />
        <Input label="Ícone remoto" value={iconUrl} onChange={(event) => setIconUrl(event.target.value)} />
        <Button onClick={() => void saveEntry()}>Guardar entrada</Button>
        <Input label="Imagem local" value={iconFile} onChange={(event) => setIconFile(event.target.value)} />
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={() => void appSetIcon(app.repository, iconFile).then(() => queryClient.invalidateQueries({ queryKey: ['launcher'] })).then(() => toast.success('Imagem guardada.')).catch((err) => toast.error(launcherError(err)))}>Usar imagem</Button>
          <Button onClick={() => void appClearIcon(app.repository).then(() => queryClient.invalidateQueries({ queryKey: ['launcher'] })).catch((err) => toast.error(launcherError(err)))}>Remover imagem</Button>
        </div>
        <Input label="Pasta já instalada" value={locate} onChange={(event) => setLocate(event.target.value)} />
        <Button onClick={() => void appLocate(app.repository, locate).then(() => queryClient.invalidateQueries({ queryKey: ['launcher'] })).then(() => toast.success('Instalação localizada.')).catch((err) => toast.error(launcherError(err)))}>Localizar</Button>
        <DangerZone
          title="Apagar a instalação"
          description="Remove a pasta instalada e mantém a entrada na biblioteca."
          action={<Button variant="danger" onClick={() => void appDeleteInstall(app.repository).then(() => queryClient.invalidateQueries({ queryKey: ['launcher'] })).then(() => toast.success('Instalação apagada.')).catch((err) => toast.error(launcherError(err)))}>Apagar pasta</Button>}
        />
        <DangerZone
          title="Remover da biblioteca"
          description="Tira a entrada de apps.json. A pasta instalada fica no disco."
          action={<Button variant="danger" onClick={() => void libraryRemove(app.repository).then(() => navigate('/')).catch((err) => toast.error(launcherError(err)))}>Remover</Button>}
        />
      </div>
      <Modal isOpen={Boolean(choice)} onClose={() => setChoice(null)} title={confirmWine ? 'Confirmar instalação' : 'Escolher ficheiro'}>
        <Modal.Content>
          {warning ? <InlineAlert variant="warning">{warning}</InlineAlert> : null}
          <ChoiceList
            options={choice ?? []}
            onPick={(asset) => {
              setChoice(null);
              void primary(asset, true);
            }}
          />
        </Modal.Content>
      </Modal>
    </PageShell>
  );
}

function Versions({ app }: { app: AppView }) {
  const toast = useToast();
  const actions = useLibraryMutations();
  const releases = useQuery({ queryKey: ['launcher', 'releases', app.repository], queryFn: () => appReleases(app.repository) });
  return (
    <PageShell>
      <PageShell.Heading subtitle={app.skippedUpdateVersion ? `A saltar ${app.skippedUpdateVersion}` : 'Tags publicadas no GitHub.'}>Versões</PageShell.Heading>
      {releases.error ? <InlineAlert>{launcherError(releases.error)}</InlineAlert> : null}
      <div className={styles.stack}>
        {(releases.data ?? []).map((release) => (
          <div key={release.tag} className={styles.row}>
            <div>
              <p className={styles.title}>{release.tag}</p>
              <p className={styles.meta}>{release.published}</p>
            </div>
            <Button size="sm" variant="secondary" onClick={() => void actions.install(app, { tag: release.tag }).catch(() => undefined)}>Instalar</Button>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

function Executable({ app }: { app: AppView }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const executables = useQuery({ queryKey: ['launcher', 'exe', app.repository], queryFn: () => appExecutables(app.repository) });
  return (
    <PageShell>
      <PageShell.Heading subtitle={app.selectedExecutable || 'Sem executável gravado.'}>Executável</PageShell.Heading>
      {executables.error ? <InlineAlert>{launcherError(executables.error)}</InlineAlert> : null}
      <div className={styles.choice}>
        {(executables.data ?? []).map((executable) => (
          <Button
            key={executable}
            variant="secondary"
            onClick={() => void appSetExecutable(app.repository, executable).then(() => queryClient.invalidateQueries({ queryKey: ['launcher'] })).then(() => toast.success('Executável gravado.')).catch((err) => toast.error(launcherError(err)))}
          >
            {executable}
          </Button>
        ))}
      </div>
    </PageShell>
  );
}

function Shortcuts({ app }: { app: AppView }) {
  const toast = useToast();
  return (
    <PageShell>
      <PageShell.Heading subtitle="O atalho abre o Painel com o nome desta app.">Atalhos</PageShell.Heading>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="secondary" onClick={() => void appShortcutDesktop(app.repository).then((path) => toast.success(path)).catch((err) => toast.error(launcherError(err)))}>Ambiente de trabalho</Button>
        <Button onClick={() => void appShortcutSteam(app.repository).then((path) => toast.success(path)).catch((err) => toast.error(launcherError(err)))}>Steam</Button>
      </div>
    </PageShell>
  );
}

function Changelog({ app }: { app: AppView }) {
  const notes = useQuery({ queryKey: ['launcher', 'notes', app.repository], queryFn: () => appChangelog(app.repository) });
  const text = notes.data || app.changelog || 'Ainda não há texto de release em cache. Atualize a biblioteca para o ir buscar.';
  return (
    <PageShell>
      <PageShell.Heading subtitle={app.remoteVersion || 'Release em cache'}>Changelog</PageShell.Heading>
      <div className={styles.stack}>
        <ReactMarkdown>{text}</ReactMarkdown>
      </div>
    </PageShell>
  );
}

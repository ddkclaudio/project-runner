import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { IconPlus } from '@tabler/icons-react';
import { PageShell } from '@/components/ui/PageShell';
import { Button } from '@/components/ui/Button';
import { GridView } from '@/components/ui/GridView';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { listen } from '@tauri-apps/api/event';
import { libraryList, libraryRefresh, librarySetFilter, librarySetSort, settingsGet, type AppView } from '@/lib/launcher-api';
import { isEditableTarget } from '@/lib/hotkeys';
import { ChoiceList, LibraryCard, useLibraryMutations } from '@/components/launcher/LibraryCard';
import { useToast } from '@/components/ui/Toast';
import { launcherError } from '@/lib/launcher-api';
import styles from './library.module.css';

const SORTS = [
  { value: 'LastPlayed', label: 'Último uso' },
  { value: 'Name', label: 'Nome' },
  { value: 'NameDesc', label: 'Nome inverso' },
  { value: 'Installed', label: 'Instaladas primeiro' },
  { value: 'NotInstalled', label: 'Por instalar primeiro' },
];

export function HomePage() {
  const toast = useToast();
  const navigate = useNavigate();
  const actions = useLibraryMutations();
  const library = useQuery({ queryKey: ['launcher', 'library'], queryFn: libraryList });
  const settings = useQuery({ queryKey: ['launcher', 'settings'], queryFn: settingsGet });
  const [showHidden, setShowHidden] = useState(false);
  const [focus, setFocus] = useState(0);
  const [progress, setProgress] = useState<Record<string, { percent: number; phase: string }>>({});
  const [choice, setChoice] = useState<{ app: AppView; assets: string[]; warning?: string | null; confirm?: boolean } | null>(null);
  const [exeChoice, setExeChoice] = useState<{ app: AppView; executables: string[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void libraryRefresh(false)
      .then(() => {
        if (!cancelled) void library.refetch();
      })
      .catch((err) => {
        if (!cancelled) toast.error(launcherError(err));
      });
    const unlisten = listen<{ repository: string; percent: number; phase: string }>('launcher-progress', (event) => {
      setProgress((current) => ({ ...current, [event.payload.repository]: event.payload }));
    });
    return () => {
      cancelled = true;
      void unlisten.then((stop) => stop());
    };
    // Corre uma vez ao abrir a biblioteca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apps = useMemo(() => {
    const all = library.data?.apps ?? [];
    return all.filter((app) => {
      if (app.filterHidden) return false;
      if (!showHidden && app.manuallyHidden) return false;
      return true;
    });
  }, [library.data, showHidden]);

  const continueApp = apps.find((app) => app.repository === library.data?.continueRepository);

  useEffect(() => {
    if (settings.data && !settings.data.enableGamepadInput) return;
    let index = 0;
    let axisHeld = false;
    let axisSince = 0;
    let buttonSince = 0;
    const cards = () => Array.from(document.querySelectorAll<HTMLElement>('[data-library-card]'));
    const move = (delta: number) => {
      const items = cards();
      if (!items.length) return;
      index = (index + delta + items.length) % items.length;
      setFocus(index);
      items[index]?.focus();
    };
    const onKey = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        move(1);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        move(-1);
      } else if (event.key === ' ') {
        event.preventDefault();
        cards()[index]?.querySelector<HTMLElement>('[role="button"]')?.click();
      } else if (event.key === 'Shift' && event.location === 1) {
        (document.activeElement as HTMLElement | null)?.blur();
      }
    };
    let frame = 0;
    const poll = (time: number) => {
      frame = requestAnimationFrame(poll);
      if (document.hidden) return;
      const pad = navigator.getGamepads?.().find(Boolean);
      if (!pad) return;
      const axis = pad.axes[0] ?? 0;
      const pressed = Math.abs(axis) > 0.3 || pad.buttons[14]?.pressed || pad.buttons[15]?.pressed;
      if (!pressed) {
        axisHeld = false;
        return;
      }
      const delay = axisHeld ? 150 : 500;
      if (time - axisSince < delay) return;
      axisHeld = true;
      axisSince = time;
      move(axis > 0 || pad.buttons[15]?.pressed ? 1 : -1);
      if (pad.buttons[0]?.pressed && time - buttonSince > 300) {
        buttonSince = time;
        cards()[index]?.querySelector<HTMLElement>('[role="button"]')?.click();
      }
    };
    window.addEventListener('keydown', onKey);
    frame = requestAnimationFrame(poll);
    return () => {
      window.removeEventListener('keydown', onKey);
      cancelAnimationFrame(frame);
    };
  }, [apps.length, settings.data?.enableGamepadInput]);

  async function primary(app: AppView) {
    if (app.status === 'installed') {
      const result = await actions.launch(app);
      if (result?.needsChoice) setExeChoice({ app, executables: result.executables });
      return;
    }
    const result = await actions.install(app);
    if (!result) return;
    if (result.needsChoice || result.needsConfirm) {
      setChoice({ app, assets: result.assets, warning: result.warning, confirm: result.needsConfirm });
    } else {
      setProgress((current) => {
        const next = { ...current };
        delete next[app.repository];
        return next;
      });
    }
  }

  async function changeSort(sortBy: string) {
    try {
      await librarySetSort(sortBy);
      await library.refetch();
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  async function changeFilter(installedOnly: boolean) {
    try {
      await librarySetFilter(installedOnly);
      await library.refetch();
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  return (
    <PageShell>
      <PageShell.Heading
        subtitle="As apps vêm do GitHub, instalam-se numa pasta local e arrancam daqui."
        actions={
          <Button variant="primary" leftIcon={<IconPlus size={15} />} onClick={() => navigate('/apps/new')}>
            Nova app
          </Button>
        }
      >
        Biblioteca
      </PageShell.Heading>
      <PageShell.Toolbar
        left={
          <>
            <Button
              variant={library.data?.installedOnly ? 'secondary' : 'primary'}
              onClick={() => void changeFilter(false)}
            >
              Todas
            </Button>
            <Button
              variant={library.data?.installedOnly ? 'primary' : 'secondary'}
              onClick={() => void changeFilter(true)}
            >
              Instaladas
            </Button>
            <Button variant="ghost" onClick={() => setShowHidden((value) => !value)}>
              {showHidden ? 'Esconder ocultas' : 'Mostrar ocultas'}
            </Button>
            {continueApp ? (
              <Button variant="secondary" onClick={() => void primary(continueApp)}>
                Continuar {continueApp.name}
              </Button>
            ) : null}
          </>
        }
        right={
          <Select
            aria-label="Ordenar"
            value={library.data?.sortBy || 'LastPlayed'}
            onChange={(value) => void changeSort(value)}
            options={SORTS}
          />
        }
      />
      {library.data?.useGrid === false ? (
        <div className={styles.list}>
          {apps.map((app, index) => (
            <LibraryCard key={app.repository} app={app} focused={focus === index} progress={progress[app.repository]} onPrimary={(item) => void primary(item)} />
          ))}
          {apps.length === 0 ? <p className={styles.meta}>A biblioteca está vazia.</p> : null}
        </div>
      ) : (
        <GridView
          items={apps}
          keyField="repository"
          loading={library.isLoading}
          emptyMessage="A biblioteca está vazia. Adicione uma app ou abra o catálogo."
          renderItem={(app) => (
            <LibraryCard
              app={app}
              focused={apps[focus]?.repository === app.repository}
              progress={progress[app.repository]}
              onPrimary={(item) => void primary(item)}
            />
          )}
        />
      )}
      <Modal isOpen={Boolean(choice)} onClose={() => setChoice(null)} title="Escolher ficheiro">
        <Modal.Content>
          {choice?.warning ? <InlineAlert variant="warning">{choice.warning}</InlineAlert> : null}
          <Modal.Text>{choice?.confirm ? 'Confirme para continuar a instalação.' : 'Há mais do que um ficheiro compatível.'}</Modal.Text>
          <ChoiceList
            options={choice?.assets ?? []}
            onPick={(asset) => {
              const app = choice?.app;
              setChoice(null);
              if (app) void actions.install(app, { assetName: asset, confirmWine: true });
            }}
          />
        </Modal.Content>
      </Modal>
      <Modal isOpen={Boolean(exeChoice)} onClose={() => setExeChoice(null)} title="Escolher executável">
        <Modal.Content>
          <ChoiceList
            options={exeChoice?.executables ?? []}
            onPick={(executable) => {
              const app = exeChoice?.app;
              setExeChoice(null);
              if (app) void actions.launch(app, executable);
            }}
          />
        </Modal.Content>
      </Modal>
    </PageShell>
  );
}

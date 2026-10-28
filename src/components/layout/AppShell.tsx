import { Fragment, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { convertFileSrc } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { IconArrowLeft } from '@tabler/icons-react';
import { LayoutNavEffects, useLayoutNav } from '@/hooks/useLayoutNav';
import { AppMenuSidebar, LibrarySidebar } from './AppSidebar';
import { AppSwitcher } from './AppSwitcher';
import { OrgSwitcher } from './OrgSwitcher';
import { BranchSwitcher } from './BranchSwitcher';
import { ActionSwitcher } from './ActionSwitcher';
import { SidebarCatalog, SidebarSettings } from './SectionNav';
import { SidebarComponents } from './SidebarComponents';
import { ForcePortModal } from '@/components/launcher/ForcePortModal';
import { InstallChoiceModal } from '@/components/launcher/InstallChoiceModal';
import { Topbar, TopbarBrand, TopbarMenuButton, TopbarRightControls, TopbarSeparator } from '@/components/ui/Topbar';
import { TopbarActionButton } from '@/components/ui/TopbarActionButton';
import { launcherBoot, settingsGet } from '@/lib/launcher-api';
import { logInfo } from '@/lib/activity-log';
import { backTarget, parseContextStack, type SwitcherId } from '@/lib/contextSwitchers';
import { useOrg } from '@/contexts/OrgContext';
import { useAppProgressStore, type AppProgressKind } from '@/stores/app-progress';
import styles from './shell.module.css';

function inferProgressKind(phase: string): AppProgressKind {
  const lower = phase.toLowerCase();
  if (lower.includes('deepseek') || lower.includes('launchfile') || lower.includes('explorar')) {
    return 'deepseek';
  }
  if (lower.includes('clon') || lower.includes('transfer') || lower.includes('descarreg') || lower.includes('depend')) {
    return 'install';
  }
  return 'launch';
}

function SwitcherTrail({
  layers,
  repository,
  pathname,
}: {
  layers: SwitcherId[];
  repository?: string;
  pathname: string;
}) {
  const nodes: React.ReactNode[] = [];
  for (const layer of layers) {
    let piece: React.ReactNode = null;
    if (layer === 'org') piece = <OrgSwitcher key="org" />;
    if (layer === 'app' && repository) piece = <AppSwitcher key="app" pathname={pathname} />;
    if (layer === 'branch' && repository) piece = <BranchSwitcher key="branch" repository={repository} />;
    if (layer === 'action' && repository) piece = <ActionSwitcher key="action" repository={repository} />;
    if (!piece) continue;
    nodes.push(
      <Fragment key={`sep-${layer}`}>
        <TopbarSeparator />
        {piece}
      </Fragment>,
    );
  }
  return <>{nodes}</>;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { navOpen, toggleNav, closeNav } = useLayoutNav();
  const { activeOrg, loading: orgLoading } = useOrg();
  const stack = parseContextStack(pathname);
  const back = backTarget(pathname);
  const settings = useQuery({
    queryKey: ['launcher', 'settings', activeOrg?.id],
    queryFn: settingsGet,
    enabled: Boolean(activeOrg),
  });
  const audioRef = useRef<HTMLAudioElement>(null);
  const prevPath = useRef<string | null>(null);

  useEffect(() => {
    const from = prevPath.current;
    if (from !== pathname) {
      if (from != null) logInfo('nav', `${from} → ${pathname}`);
      else logInfo('nav', pathname);
      prevPath.current = pathname;
    }
  }, [pathname]);

  useEffect(() => {
    if (!activeOrg) return;
    void launcherBoot().catch(() => undefined);
  }, [activeOrg?.id]);

  useEffect(() => {
    const setProgress = useAppProgressStore.getState().setProgress;
    const clearProgress = useAppProgressStore.getState().clearProgress;
    const timers = new Map<string, number>();
    const unlisten = listen<{ repository: string; percent: number; phase: string }>('launcher-progress', (event) => {
      const id = event.payload.repository;
      const percent = event.payload.percent;
      setProgress(id, {
        percent,
        phase: event.payload.phase,
        kind: inferProgressKind(event.payload.phase),
      });
      const existing = timers.get(id);
      if (existing) window.clearTimeout(existing);
      if (percent >= 100) {
        timers.set(
          id,
          window.setTimeout(() => {
            clearProgress(id);
            timers.delete(id);
          }, 800),
        );
      }
    });
    return () => {
      void unlisten.then((stop) => stop());
      for (const timer of timers.values()) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = settings.data?.musicVolume ?? 0.2;
  }, [settings.data?.musicVolume, settings.data?.launcherMusicPath]);

  useEffect(() => {
    const fade = () => {
      const audio = audioRef.current;
      if (!audio) return;
      const start = audio.volume;
      const begun = performance.now();
      const step = (now: number) => {
        const amount = Math.min(1, (now - begun) / 800);
        audio.volume = start * (1 - amount);
        if (amount < 1) requestAnimationFrame(step);
        else audio.pause();
      };
      requestAnimationFrame(step);
    };
    window.addEventListener('painel-fade-music', fade);
    return () => window.removeEventListener('painel-fade-music', fade);
  }, []);

  const image = settings.data?.backgroundImagePath;
  const opacity = settings.data?.backgroundOpacity ?? 0.15;
  const onAppRoute = stack.mode === 'app';

  return (
    <div className={styles.shell}>
      <a className={styles.skip} href="#main-content">
        Saltar para o conteúdo
      </a>
      <LayoutNavEffects />
      {image ? <div className={styles.atmosphere} style={{ backgroundImage: `url("${convertFileSrc(image)}")` }} /> : null}
      {image ? <div className={styles.atmosphereScrim} style={{ opacity: 1 - opacity }} /> : null}
      {settings.data?.launcherMusicPath ? (
        <audio ref={audioRef} src={convertFileSrc(settings.data.launcherMusicPath)} loop autoPlay />
      ) : null}
      <div className={styles.topbarHost}>
        <Topbar
          left={
            <>
              <TopbarMenuButton open={navOpen} onClick={toggleNav} />
              <TopbarBrand />
              {back ? (
                <>
                  <TopbarSeparator />
                  <TopbarActionButton
                    icon={<IconArrowLeft size={16} aria-hidden="true" />}
                    label="Voltar"
                    onClick={() => navigate(back)}
                  />
                </>
              ) : null}
              <SwitcherTrail layers={stack.layers} repository={stack.repository} pathname={pathname} />
            </>
          }
          right={<TopbarRightControls />}
        />
      </div>
      <div className={styles.body}>
        {onAppRoute && stack.repository ? <AppMenuSidebar repository={stack.repository} /> : <LibrarySidebar />}
        {pathname.startsWith('/components') ? <SidebarComponents /> : null}
        {pathname.startsWith('/catalog') ? <SidebarCatalog /> : null}
        {pathname.startsWith('/settings') ? <SidebarSettings /> : null}
        {navOpen ? (
          <button type="button" className={styles.backdrop} aria-label="Fechar menu de navegação" onClick={closeNav} />
        ) : null}
        <main
          className={pathname.startsWith('/comunicacoes') ? styles.mainCanvas : styles.main}
          id="main-content"
          tabIndex={-1}
        >
          {orgLoading ? <p style={{ color: 'var(--text-muted)', padding: 24 }}>A carregar organização…</p> : null}
          {!orgLoading && !activeOrg ? (
            <p style={{ color: 'var(--text-muted)', padding: 24 }}>Crie ou escolha uma organização para continuar.</p>
          ) : null}
          {!orgLoading && activeOrg ? children : null}
        </main>
      </div>
      <ForcePortModal />
      <InstallChoiceModal />
    </div>
  );
}

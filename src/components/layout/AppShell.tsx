import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { convertFileSrc } from '@tauri-apps/api/core';
import { LayoutNavEffects, useLayoutNav } from '@/hooks/useLayoutNav';
import { AppMenuSidebar, LibrarySidebar } from './AppSidebar';
import { AppSwitcher } from './AppSwitcher';
import { SidebarCatalog, SidebarSettings } from './SectionNav';
import { SidebarComponents } from './SidebarComponents';
import { Topbar, TopbarBrand, TopbarMenuButton, TopbarRightControls, TopbarSeparator } from '@/components/ui/Topbar';
import { launcherBoot, settingsGet } from '@/lib/launcher-api';
import { parseAppRoute } from '@/lib/launcher-nav';
import styles from './shell.module.css';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const { navOpen, toggleNav, closeNav } = useLayoutNav();
  const appRoute = parseAppRoute(pathname);
  const settings = useQuery({ queryKey: ['launcher', 'settings'], queryFn: settingsGet });
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    void launcherBoot().catch(() => undefined);
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

  return (
    <div className={styles.shell}>
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
              <TopbarSeparator />
              {appRoute ? <AppSwitcher pathname={pathname} /> : null}
            </>
          }
          right={<TopbarRightControls />}
        />
      </div>
      <div className={styles.body}>
        {appRoute ? <AppMenuSidebar repository={appRoute.repository} /> : <LibrarySidebar />}
        {pathname.startsWith('/components') ? <SidebarComponents /> : null}
        {pathname.startsWith('/catalog') ? <SidebarCatalog /> : null}
        {pathname.startsWith('/settings') ? <SidebarSettings /> : null}
        {navOpen ? (
          <button type="button" className={styles.backdrop} aria-label="Fechar menu de navegação" onClick={closeNav} />
        ) : null}
        <main className={styles.main} id="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}

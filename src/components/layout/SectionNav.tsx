import { useLocation } from 'react-router-dom';
import { SectionSidebar } from '@/components/ui/SectionSidebar';

export function SidebarCatalog() {
  const { pathname } = useLocation();
  return (
    <SectionSidebar
      title="Catálogo"
      ariaLabel="Secções do catálogo"
      groups={[
        {
          title: 'ORIGEM',
          items: [
            { label: 'Remoto', href: '/catalog', active: pathname === '/catalog' },
            { label: 'Importar e exportar', href: '/catalog/files', active: pathname.startsWith('/catalog/files') },
          ],
        },
      ]}
    />
  );
}

export function SidebarSettings() {
  const { pathname } = useLocation();
  const item = (label: string, href: string) => ({
    label,
    href,
    active: href === '/settings' ? pathname === '/settings' : pathname.startsWith(href),
  });
  return (
    <SectionSidebar
      title="Definições"
      ariaLabel="Secções das definições"
      groups={[
        {
          title: 'PAINEL',
          items: [
            item('Geral', '/settings'),
            item('GitHub', '/settings/github'),
            item('Aparência', '/settings/appearance'),
            item('Lançamento', '/settings/launch'),
          ],
        },
      ]}
    />
  );
}

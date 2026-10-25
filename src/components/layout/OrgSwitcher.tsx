import { useNavigate } from 'react-router-dom';
import { IconAffiliate, IconArrowRight, IconPlus, IconUsers, IconTicket } from '@tabler/icons-react';
import { SwitcherDropdown } from '@/components/ui/SwitcherDropdown';
import { useOrg } from '@/contexts/OrgContext';

export function OrgSwitcher() {
  const navigate = useNavigate();
  const { orgs, activeOrg, loading, switchOrg } = useOrg();

  return (
    <SwitcherDropdown
      aria-label="Trocar organização"
      panelLabel="Organizações"
      searchPlaceholder="Buscar organização..."
      searchAriaLabel="Buscar organizações"
      items={orgs.map((org) => ({ id: org.id, label: org.name, searchText: `${org.name} ${org.slug}` }))}
      selectedId={activeOrg?.id ?? ''}
      loading={loading}
      onSelect={(id) => void switchOrg(id)}
      getEmptyMessage={(query) => (query ? `Nenhum resultado para "${query}"` : 'Nenhuma organização ainda.')}
      actions={[
        { label: 'Nova organização', icon: <IconPlus size={14} />, onClick: () => navigate('/orgs/new') },
        {
          label: 'Membros',
          icon: <IconUsers size={14} />,
          onClick: () => activeOrg && navigate(`/orgs/${activeOrg.id}/members`),
        },
        { label: 'Aceitar convite', icon: <IconTicket size={14} />, onClick: () => navigate('/orgs/invite') },
        {
          label: 'Ver todas as organizações',
          icon: <IconArrowRight size={14} />,
          onClick: () => navigate('/orgs'),
        },
      ]}
      trigger={
        <>
          <IconAffiliate size={14} aria-hidden="true" />
          <span>{activeOrg?.name || 'Organização'}</span>
        </>
      }
    />
  );
}

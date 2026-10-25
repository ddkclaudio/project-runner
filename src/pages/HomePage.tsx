import { Link } from 'react-router-dom';
import { PageShell } from '@/components/ui/PageShell';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/contexts/AuthContext';

export function HomePage() {
  const { user } = useAuth();
  const name = user?.displayName || user?.email || 'utilizador';

  return (
    <PageShell>
      <PageShell.Heading subtitle="O painel está pronto. As próximas páginas montam-se com os componentes do catálogo.">
        Olá, {name}
      </PageShell.Heading>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 20, maxWidth: 560 }}>
        Esta é a área autenticada. O menu tem só Início e Componentes. Organizações e membros não
        fazem parte deste app.
      </p>
      <Link to="/components">
        <Button variant="primary">Abrir catálogo</Button>
      </Link>
    </PageShell>
  );
}

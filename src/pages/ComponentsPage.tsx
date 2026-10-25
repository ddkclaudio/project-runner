import { useSearchParams } from 'react-router-dom';
import { ComponentsView } from '@/components/features/components/ComponentsView';

export function ComponentsPage() {
  const [searchParams] = useSearchParams();
  const secao = searchParams.get('secao') ?? '';
  return <ComponentsView secao={secao} />;
}

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IconGitBranch } from '@tabler/icons-react';
import { SwitcherDropdown } from '@/components/ui/SwitcherDropdown';
import { appBranches, appDetail, appSetBranch, launcherError } from '@/lib/launcher-api';
import { appId } from '@/components/launcher/LibraryCard';
import { useToast } from '@/components/ui/Toast';
import { useAppProgressStore } from '@/stores/app-progress';
import { useOrg } from '@/contexts/OrgContext';

export function BranchSwitcher({ repository }: { repository: string }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { activeOrg } = useOrg();
  const detail = useQuery({
    queryKey: ['launcher', 'app', activeOrg?.id, repository],
    queryFn: () => appDetail(repository),
    refetchInterval: 3000,
    enabled: Boolean(activeOrg?.id),
  });
  const branches = useQuery({
    queryKey: ['launcher', 'branches', activeOrg?.id, repository],
    queryFn: () => appBranches(repository),
    enabled: Boolean(activeOrg?.id && detail.data?.gitClone),
  });

  const progressId = detail.data ? appId(detail.data) : repository;
  const progress = useAppProgressStore((s) => s.byId[progressId]);

  if (!detail.data?.gitClone) return null;

  const selected = detail.data?.selectedBranch || branches.data?.find((name) => name === 'main' || name === 'master') || branches.data?.[0] || 'main';
  const items = (branches.data ?? []).map((name) => ({ id: name, label: name, searchText: name }));
  if (selected && !items.some((item) => item.id === selected)) {
    items.unshift({ id: selected, label: selected, searchText: selected });
  }

  return (
    <SwitcherDropdown
      aria-label="Trocar branch"
      panelLabel="Branches"
      searchPlaceholder="Buscar branch..."
      searchAriaLabel="Buscar branches"
      items={items}
      selectedId={selected}
      loading={branches.isLoading || Boolean(progress)}
      onSelect={(branch) => {
        const stopped = Boolean(detail.data?.running);
        const { setProgress, clearProgress, isBusy } = useAppProgressStore.getState();
        if (isBusy(progressId)) {
          toast.error('Já em curso…');
          return;
        }
        setProgress(progressId, { percent: 1, phase: 'A mudar de branch…', kind: 'launch' });
        void appSetBranch(repository, branch)
          .then(() => {
            toast.success(
              stopped
                ? `Branch actualizada para ${branch}. A app foi parada.`
                : `Branch actualizada para ${branch}.`,
            );
            return queryClient.invalidateQueries({ queryKey: ['launcher'] });
          })
          .catch((err) => toast.error(launcherError(err)))
          .finally(() => {
            window.setTimeout(() => clearProgress(progressId), 700);
          });
      }}
      getEmptyMessage={(query) =>
        query ? `Nenhum resultado para "${query}"` : branches.error ? launcherError(branches.error) : 'Nenhuma branch encontrada.'
      }
      trigger={
        <>
          <IconGitBranch size={14} aria-hidden="true" />
          <span>{selected}</span>
        </>
      }
    />
  );
}

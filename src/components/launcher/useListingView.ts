import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast';
import type { ViewMode } from '@/components/ui/ViewToolbar';
import { launcherError, settingsGet, settingsSave } from '@/lib/launcher-api';

export function useListingView() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['launcher', 'settings'], queryFn: settingsGet });
  const view: ViewMode = settings.data?.useGridView === false ? 'list' : 'grid';

  async function changeView(mode: ViewMode) {
    const current = settings.data;
    if (!current) return;
    const { dataDir: _dataDir, appVersion: _appVersion, ...rest } = current;
    try {
      await settingsSave({ ...rest, useGridView: mode === 'grid' });
      await queryClient.invalidateQueries({ queryKey: ['launcher'] });
    } catch (err) {
      toast.error(launcherError(err));
    }
  }

  return { view, changeView, settings };
}

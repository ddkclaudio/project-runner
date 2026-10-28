import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import {
  acceptInvite,
  createOrg,
  currentOrg,
  listOrgs,
  setActiveOrg,
  type PublicOrg,
} from '@/lib/org-api';

type OrgContextValue = {
  orgs: PublicOrg[];
  activeOrg: PublicOrg | null;
  loading: boolean;
  refresh: () => Promise<void>;
  switchOrg: (orgId: string) => Promise<void>;
  create: (name: string) => Promise<PublicOrg>;
  accept: (code: string) => Promise<PublicOrg>;
};

const OrgContext = createContext<OrgContextValue | null>(null);

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [orgs, setOrgs] = useState<PublicOrg[]>([]);
  const [activeOrg, setActive] = useState<PublicOrg | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setOrgs([]);
      setActive(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [list, current] = await Promise.all([listOrgs(), currentOrg()]);
      setOrgs(list);
      setActive(current);
    } catch {
      setOrgs([]);
      setActive(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const invalidateLauncher = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['launcher'] });
  }, [queryClient]);

  const clearLauncherCache = useCallback(() => {
    queryClient.removeQueries({ queryKey: ['launcher'] });
  }, [queryClient]);

  const switchOrg = useCallback(
    async (orgId: string) => {
      const next = await setActiveOrg(orgId);
      setActive(next);
      setOrgs(await listOrgs());
      clearLauncherCache();
    },
    [clearLauncherCache],
  );

  const create = useCallback(
    async (name: string) => {
      const next = await createOrg(name);
      setActive(next);
      setOrgs(await listOrgs());
      await invalidateLauncher();
      return next;
    },
    [invalidateLauncher],
  );

  const accept = useCallback(
    async (code: string) => {
      const next = await acceptInvite(code);
      setActive(next);
      setOrgs(await listOrgs());
      await invalidateLauncher();
      return next;
    },
    [invalidateLauncher],
  );

  const value = useMemo(
    () => ({ orgs, activeOrg, loading, refresh, switchOrg, create, accept }),
    [orgs, activeOrg, loading, refresh, switchOrg, create, accept],
  );

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg(): OrgContextValue {
  const value = useContext(OrgContext);
  if (!value) throw new Error('useOrg must be used within OrgProvider');
  return value;
}

import { useCallback, useEffect, useState } from 'react';
import { aiName, appSlug } from '@/lib/brand';

export type SidebarBehavior = 'open' | 'closed' | 'expand-on-hover';

export type AccountLocalPrefs = {
  timezone: string;
  sidebarBehavior: SidebarBehavior;
  username: string;
  phone: string;
  shortcuts: Record<string, boolean>;
  dashboard: Record<string, boolean>;
  sendTelemetry: boolean;
};

const STORAGE_PREFIX = `${appSlug()}-account-prefs`;

export const DEFAULT_SHORTCUTS: { id: string; title: string; keys: string[] }[] = [
  { id: 'command-menu', title: 'Abrir menu de comandos', keys: ['Ctrl', 'K'] },
  { id: 'ai-assistant', title: 'Alternar painel do assistente de IA', keys: ['Ctrl', 'I'] },
  { id: 'chat', title: `Abrir chat ${aiName()}`, keys: ['Ctrl', 'E'] },
  { id: 'copy-markdown', title: 'Copiar resultados como Markdown', keys: ['Ctrl', '⇧', 'M'] },
  { id: 'copy-json', title: 'Copiar resultados como JSON', keys: ['Ctrl', '⇧', 'J'] },
  { id: 'copy-csv', title: 'Copiar resultados como CSV', keys: ['Ctrl', '⇧', 'C'] },
  { id: 'download-csv', title: 'Baixar resultados como CSV', keys: ['Ctrl', '⇧', 'D'] },
  { id: 'invite-members', title: 'Convidar membros', keys: ['⇧', 'N'] },
  { id: 'new-project', title: 'Novo projeto', keys: ['⇧', 'N'] },
  { id: 'refresh-audit', title: 'Atualizar logs de auditoria', keys: ['⇧', 'R'] },
];

export const DEFAULT_DASHBOARD: { id: string; title: string; description: string }[] = [
  {
    id: 'compact-tables',
    title: 'Tabelas compactas',
    description: 'Reduz espaçamento nas listagens e tabelas deste navegador.',
  },
  {
    id: 'confirm-destructive',
    title: 'Confirmar ações destrutivas',
    description: 'Exige confirmação extra antes de excluir itens.',
  },
];

function storageKey(uid: string) {
  return `${STORAGE_PREFIX}:${uid}`;
}

function defaultPrefs(username = ''): AccountLocalPrefs {
  return {
    timezone: 'America/Sao_Paulo',
    sidebarBehavior: 'expand-on-hover',
    username,
    phone: '',
    shortcuts: Object.fromEntries(DEFAULT_SHORTCUTS.map((s) => [s.id, true])),
    dashboard: Object.fromEntries(DEFAULT_DASHBOARD.map((d) => [d.id, false])),
    sendTelemetry: true,
  };
}

function readPrefs(uid: string, usernameFallback: string): AccountLocalPrefs {
  const base = defaultPrefs(usernameFallback);
  if (typeof window === 'undefined') return base;
  try {
    const raw = localStorage.getItem(storageKey(uid));
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<AccountLocalPrefs>;
    return {
      ...base,
      ...parsed,
      shortcuts: { ...base.shortcuts, ...(parsed.shortcuts ?? {}) },
      dashboard: { ...base.dashboard, ...(parsed.dashboard ?? {}) },
      username: parsed.username?.trim() ? parsed.username : usernameFallback,
    };
  } catch {
    return base;
  }
}

function writePrefs(uid: string, prefs: AccountLocalPrefs) {
  try {
    localStorage.setItem(storageKey(uid), JSON.stringify(prefs));
  } catch {
    /* private mode */
  }
}

export function useAccountLocalPrefs(uid: string | undefined, usernameFallback = '') {
  const [prefs, setPrefsState] = useState<AccountLocalPrefs>(() => defaultPrefs(usernameFallback));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!uid) {
      setPrefsState(defaultPrefs(usernameFallback));
      setReady(false);
      return;
    }
    setPrefsState(readPrefs(uid, usernameFallback));
    setReady(true);
  }, [uid, usernameFallback]);

  const setPrefs = useCallback(
    (updater: AccountLocalPrefs | ((prev: AccountLocalPrefs) => AccountLocalPrefs)) => {
      setPrefsState((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (uid) writePrefs(uid, next);
        return next;
      });
    },
    [uid],
  );

  const patch = useCallback(
    (partial: Partial<AccountLocalPrefs>) => {
      setPrefs((prev) => ({ ...prev, ...partial }));
    },
    [setPrefs],
  );

  return { prefs, setPrefs, patch, ready };
}

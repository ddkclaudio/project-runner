import { useSyncExternalStore } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import {
  appGenerateLaunchfile,
  appLaunchConfigGet,
  appLaunchConfigSave,
  type LaunchConfigView,
  type LaunchField,
} from '@/lib/launcher-api';

/**
 * Único leitor e gravador do Launchfile.
 * `appId` é a identidade de `appId()` em LibraryCard: pasta, ou o repositório se a pasta vier vazia.
 * O snapshot salvo fica na query ['launcher', 'launch-config', appId].
 * O rascunho fica neste módulo, para o Executável e o detalhe partilharem a mesma edição.
 */

const EMPTY_FIELDS: LaunchField[] = [];

let queryClientRef: QueryClient | null = null;

export function bindLaunchQueryClient(client: QueryClient) {
  queryClientRef = client;
}

function requireClient(): QueryClient {
  if (!queryClientRef) {
    throw new Error('O gerenciador do Launchfile ainda não está ligado.');
  }
  return queryClientRef;
}

export function launchConfigQueryKey(appId: string) {
  return ['launcher', 'launch-config', appId] as const;
}

export function httpPort(value: string): string | null {
  const match = value.trim().match(/^https?:\/\/[^/\s:]+:(\d+)(?=\/|$)/i);
  return match?.[1] ?? null;
}

export function linkedPorts(previous: string, next: string): { oldPort: string; newPort: string } | null {
  const prev = previous.trim();
  const nextTrim = next.trim();
  if (!prev || prev === nextTrim) return null;
  if (/^\d+$/.test(prev) && /^\d+$/.test(nextTrim)) {
    return { oldPort: prev, newPort: nextTrim };
  }
  const oldUrlPort = httpPort(prev);
  const newUrlPort = httpPort(nextTrim);
  if (oldUrlPort && newUrlPort && oldUrlPort !== newUrlPort) {
    return { oldPort: oldUrlPort, newPort: newUrlPort };
  }
  return null;
}

export function replacePortToken(value: string, oldPort: string, newPort: string): string {
  if (value.trim() === oldPort) return newPort;
  const colon = new RegExp(`:${oldPort}(?!\\d)`, 'g');
  const standalone = new RegExp(`(^|[\\s=])${oldPort}(?!\\d)`, 'g');
  return value.replace(colon, `:${newPort}`).replace(standalone, `$1${newPort}`);
}

export function propagateLaunchValue(fields: LaunchField[], key: string, value: string): LaunchField[] {
  const previous = fields.find((item) => item.key === key)?.value ?? '';
  const ports = linkedPorts(previous, value);
  return fields.map((item) => {
    if (item.key === key) return { ...item, value };
    if (!ports) return item;
    return { ...item, value: replacePortToken(item.value, ports.oldPort, ports.newPort) };
  });
}

/** Mesma comparação que o Salvar usava: valor por chave, e chave nova no rascunho. */
export function launchFieldsDiffer(saved: LaunchField[], working: LaunchField[]): boolean {
  return (
    saved.some((field) => {
      const current = working.find((item) => item.key === field.key);
      return (current?.value ?? '') !== field.value;
    }) || working.some((field) => !saved.some((item) => item.key === field.key))
  );
}

const drafts = new Map<string, LaunchField[]>();
const draftListeners = new Set<() => void>();
const writeTails = new Map<string, Promise<void>>();
let draftEpoch = 0;

function emitDrafts() {
  draftEpoch += 1;
  for (const listener of [...draftListeners]) listener();
}

export function subscribeLaunchDrafts(listener: () => void) {
  draftListeners.add(listener);
  return () => {
    draftListeners.delete(listener);
  };
}

export function launchDraftEpoch() {
  return draftEpoch;
}

function subscribeDrafts(listener: () => void) {
  return subscribeLaunchDrafts(listener);
}

function setDraft(appId: string, fields: LaunchField[] | undefined) {
  const current = drafts.get(appId);
  if (fields) {
    if (current === fields) return;
    drafts.set(appId, fields);
  } else if (current === undefined) {
    return;
  } else {
    drafts.delete(appId);
  }
  emitDrafts();
}

function enqueue<T>(appId: string, work: () => Promise<T>): Promise<T> {
  const previous = writeTails.get(appId) ?? Promise.resolve();
  const run = previous.then(work, work);
  writeTails.set(
    appId,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  return run;
}

function cloneFields(fields: LaunchField[]): LaunchField[] {
  return fields.map((field) => ({ ...field }));
}

/** Garante a chave e aplica a mesma propagação de `patchField` (porta exata, :porta e argumento numérico). */
function withPropagatedValue(fields: LaunchField[], key: string, value: string, template?: LaunchField): LaunchField[] {
  const base = fields.some((field) => field.key === key)
    ? fields
    : [
        ...fields,
        template
          ? { ...template, value: '' }
          : { key, label: key, value: '', fieldType: 'text' as const },
      ];
  return propagateLaunchValue(base, key, value);
}

function fetchLaunchConfig(appId: string) {
  return appLaunchConfigGet(appId);
}

function saveLaunchFields(appId: string, fields: LaunchField[]) {
  return appLaunchConfigSave(appId, { fields: cloneFields(fields) });
}

async function invalidateSavedQueries(appId: string) {
  const client = requireClient();
  await client.invalidateQueries({ queryKey: ['launcher'] });
  await client.invalidateQueries({ queryKey: launchConfigQueryKey(appId) });
  await client.invalidateQueries({ queryKey: ['launcher', 'exe', appId] });
}

export function readSnapshot(appId: string): LaunchConfigView | undefined {
  return queryClientRef?.getQueryData<LaunchConfigView>(launchConfigQueryKey(appId));
}

export function readDraft(appId: string): LaunchField[] | undefined {
  return drafts.get(appId);
}

export function readField(appId: string, key: string): string | undefined {
  const draft = drafts.get(appId);
  if (draft) {
    const field = draft.find((item) => item.key === key);
    if (field) return field.value;
  }
  return readSnapshot(appId)?.fields.find((item) => item.key === key)?.value;
}

export function isLaunchConfigDirty(appId: string): boolean {
  const draft = drafts.get(appId);
  if (!draft) return false;
  const saved = readSnapshot(appId);
  if (!saved) return true;
  return launchFieldsDiffer(saved.fields, draft);
}

async function loadSnapshot(appId: string): Promise<LaunchConfigView> {
  const cached = readSnapshot(appId);
  if (cached) return cached;
  const loaded = await fetchLaunchConfig(appId);
  requireClient().setQueryData(launchConfigQueryKey(appId), loaded);
  return loaded;
}

/** Atualiza o rascunho. A propagação da porta corre uma vez, nas URLs e nos argumentos numéricos. */
export function patchField(appId: string, key: string, value: string) {
  const saved = readSnapshot(appId);
  if (!saved) return;
  const base = drafts.get(appId) ?? cloneFields(saved.fields);
  const next = propagateLaunchValue(base, key, value);
  if (launchFieldsDiffer(saved.fields, next)) setDraft(appId, next);
  else setDraft(appId, undefined);
}

async function commitNow(appId: string): Promise<LaunchConfigView | undefined> {
  const saved = readSnapshot(appId);
  const draft = drafts.get(appId);
  if (!draft) return saved;
  if (saved && !launchFieldsDiffer(saved.fields, draft)) {
    setDraft(appId, undefined);
    return saved;
  }
  const saving = draft;
  const view = await saveLaunchFields(appId, saving);
  const client = requireClient();
  client.setQueryData(launchConfigQueryKey(appId), view);
  if (drafts.get(appId) === saving) setDraft(appId, undefined);
  await invalidateSavedQueries(appId);
  return client.getQueryData<LaunchConfigView>(launchConfigQueryKey(appId)) ?? view;
}

/** Grava o rascunho, substitui o snapshot e esconde Salvar quando os dois ficam iguais. */
export function commit(appId: string): Promise<LaunchConfigView | undefined> {
  return enqueue(appId, () => commitNow(appId));
}

async function applyComputedNow(appId: string, key: string, value: string): Promise<LaunchConfigView> {
  const saved = await loadSnapshot(appId);
  const view = await saveLaunchFields(appId, withPropagatedValue(saved.fields, key, value));
  const client = requireClient();
  client.setQueryData(launchConfigQueryKey(appId), view);
  const draft = drafts.get(appId);
  if (draft) {
    const written = view.fields.find((field) => field.key === key);
    const nextDraft = withPropagatedValue(draft, key, value, written);
    if (launchFieldsDiffer(view.fields, nextDraft)) setDraft(appId, nextDraft);
    else setDraft(appId, undefined);
  }
  return view;
}

/**
 * Grava `value` nesta app. A propagação de `patchField` corre no snapshot e no rascunho aberto;
 * o disco recebe o snapshot uma vez. Um campo do rascunho que não contém a porta antiga
 * continua por gravar. Quem chama escolhe o destino; a origem não entra aqui.
 */
export function applyComputed(appId: string, key: string, value: string): Promise<LaunchConfigView> {
  return enqueue(appId, () => applyComputedNow(appId, key, value));
}

async function regenerateNow(appId: string): Promise<string> {
  const message = await appGenerateLaunchfile(appId);
  const view = await fetchLaunchConfig(appId);
  setDraft(appId, undefined);
  requireClient().setQueryData(launchConfigQueryKey(appId), view);
  await invalidateSavedQueries(appId);
  return message;
}

/** O DeepSeek substitui o snapshot e descarta o rascunho desta app. */
export function regenerateLaunchConfig(appId: string): Promise<string> {
  return enqueue(appId, () => regenerateNow(appId));
}

export function useLaunchConfig(appId: string, enabled = true) {
  const queryClient = useQueryClient();
  bindLaunchQueryClient(queryClient);
  const query = useQuery({
    queryKey: launchConfigQueryKey(appId || 'idle'),
    queryFn: () => fetchLaunchConfig(appId),
    enabled: enabled && Boolean(appId),
  });
  const draft = useSyncExternalStore(
    subscribeDrafts,
    () => readDraft(appId),
    () => readDraft(appId),
  );
  const fields = draft ?? query.data?.fields ?? EMPTY_FIELDS;
  return { ...query, fields };
}

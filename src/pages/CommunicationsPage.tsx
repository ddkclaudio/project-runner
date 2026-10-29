import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
  applyEdgeChanges,
  applyNodeChanges,
  Handle,
  Position,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  type NodeProps,
  type OnConnectEnd,
} from '@xyflow/react';
import { IconArrowBackUp, IconArrowForwardUp, IconExternalLink, IconFolder, IconPlayerPlay } from '@tabler/icons-react';
import { FlowCanvas } from '@/components/ui/FlowCanvas';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { PreferenceToggleRow } from '@/components/ui/PreferenceToggleRow';
import { SearchableListPanel } from '@/components/ui/SearchableListPanel';
import { SideDrawer, SideDrawerIconButton } from '@/components/ui/SideDrawer';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { LaunchConfigPanel } from '@/components/launcher/LaunchConfigForm';
import { appId, useLibraryMutations } from '@/components/launcher/LibraryCard';
import { useOrg } from '@/contexts/OrgContext';
import {
  appHref,
  appLaunchConfigGet,
  communicationsGet,
  communicationsOpenDir,
  communicationsSave,
  launcherError,
  libraryList,
  statusLabel,
  type AppView,
  type CommunicationEdge,
  type CommunicationNode,
  type CommunicationOpKind,
  type CommunicationsGraph,
  type LaunchField,
} from '@/lib/launcher-api';
import {
  applyComputed,
  commit as commitLaunch,
  isLaunchConfigDirty,
  launchConfigQueryKey,
  launchDraftEpoch,
  readDraft,
  readField,
  readSnapshot,
  subscribeLaunchDrafts,
  useLaunchConfig,
} from '@/lib/launch-config';
import { cx } from '@/utils';
import styles from './communications.module.css';

type Graph = CommunicationsGraph;
type AppNodeData = { label: string; repository: string };
type OpNodeData = { label: string };
type AppFlowNode = Node<AppNodeData, 'app'>;
type OpFlowNode = Node<OpNodeData, 'op'>;
type FlowNode = AppFlowNode | OpFlowNode;
type ValueType = 'number' | 'boolean' | 'url' | 'text';
type ChainReason =
  | 'cycle'
  | 'missing-source'
  | 'missing-app'
  | 'not-installed'
  | 'missing-field'
  | 'non-numeric'
  | 'unavailable';
type ChainSuccess = { ok: true; value: string; numeric: boolean };
type ChainFailure = { ok: false; nodeId: string; nodeName: string; reason: ChainReason };
type ChainResult = ChainSuccess | ChainFailure;
type PlannedWrite = {
  sourceName: string;
  appId: string;
  key: string;
  value: string;
  valueType: ValueType;
  destNode: CommunicationNode;
  destName: string;
};
type WritePlan = { ok: true; writes: PlannedWrite[] } | { ok: false; message: string };
type FieldPrompt =
  | {
      step: 'field';
      purpose: 'create';
      op: CommunicationOpKind;
      sourceId: string;
      flowX: number;
      flowY: number;
    }
  | { step: 'field'; purpose: 'bind'; sourceId: string; targetId: string }
  | { step: 'field'; purpose: 'retarget'; sourceId: string; targetId: string };
type LiteralPrompt = {
  step: 'literal';
  purpose: 'create';
  op: 'value';
  sourceId: string;
  flowX: number;
  flowY: number;
  sourceField?: string;
  initial: string;
};
type Prompt = FieldPrompt | LiteralPrompt;
type OpMenuState = {
  x: number;
  y: number;
  flowX: number;
  flowY: number;
  sourceId: string;
  showMath: boolean;
};

const HISTORY_LIMIT = 50;
const EMPTY_APPS: AppView[] = [];
const EMPTY_TAKEN = new Set<string>();
const OP_MENU: { kind: CommunicationOpKind; label: string }[] = [
  { kind: 'increment', label: 'Incrementar' },
  { kind: 'decrement', label: 'Decrementar' },
  { kind: 'value', label: 'Definir valor' },
  { kind: 'get', label: 'Get' },
];

type CommunicationsContextValue = {
  graph: Graph;
  apps: AppView[];
  libraryPending: boolean;
};

const CommunicationsContext = createContext<CommunicationsContextValue | null>(null);

function useCommunicationsGraph() {
  const value = useContext(CommunicationsContext);
  if (!value) throw new Error('O grafo de comunicações não está disponível.');
  return value;
}

function signature(graph: Graph): string {
  const nodes = graph.nodes
    .map((node) =>
      [
        node.id,
        node.folderName,
        node.repository,
        node.name,
        node.x,
        node.y,
        node.alwaysOn ? 1 : 0,
        node.kind ?? '',
        node.sourceNodeId ?? '',
        node.sourceField ?? '',
        node.literal ?? '',
        node.step ?? '',
      ].join('\t'),
    )
    .sort()
    .join('\n');
  const edges = graph.edges
    .map((edge) => [edge.id, edge.source, edge.target, edge.targetField ?? ''].join('\t'))
    .sort()
    .join('\n');
  return `${nodes}\n--\n${edges}`;
}

function opKind(kind: CommunicationNode['kind']): CommunicationOpKind | undefined {
  return kind === 'increment' || kind === 'decrement' || kind === 'value' || kind === 'get' ? kind : undefined;
}

function opLabel(kind: CommunicationOpKind): string {
  if (kind === 'increment') return 'Incrementar';
  if (kind === 'decrement') return 'Decrementar';
  if (kind === 'get') return 'Get';
  return 'Definir valor';
}

function kindLabel(kind: string): string {
  switch (kind.trim().toLowerCase()) {
    case 'site':
      return 'Site';
    case 'api':
      return 'API';
    case 'desktop':
      return 'Desktop';
    case 'cli':
      return 'CLI';
    default:
      return 'Tipo desconhecido';
  }
}

function nodeTitle(node: CommunicationNode): string {
  const kind = opKind(node.kind);
  const label = kind ? opLabel(kind) : node.name || 'App';
  return node.sourceField ? `${label} (${node.sourceField})` : label;
}

function normalize(graph: CommunicationsGraph): Graph {
  return {
    nodes: (graph.nodes ?? []).map((node) => {
      const kind = opKind(node.kind);
      const next: CommunicationNode = {
        id: node.id,
        folderName: node.folderName,
        repository: node.repository,
        name: node.name,
        x: node.x,
        y: node.y,
        alwaysOn: Boolean(node.alwaysOn),
      };
      if (!kind) return next;
      next.kind = kind;
      if (node.sourceNodeId) next.sourceNodeId = node.sourceNodeId;
      if (node.sourceField) next.sourceField = node.sourceField;
      if (kind === 'value') next.literal = node.literal ?? '';
      if (kind === 'increment' || kind === 'decrement') next.step = node.step?.trim() || '1';
      return next;
    }),
    edges: (graph.edges ?? []).map((edge) => {
      const next: CommunicationEdge = { id: edge.id, source: edge.source, target: edge.target };
      if (edge.targetField) next.targetField = edge.targetField;
      return next;
    }),
  };
}

function toFlow(graph: Graph, selectedId: string | null): FlowNode[] {
  return graph.nodes.map((node) => {
    const kind = opKind(node.kind);
    if (kind) {
      return {
        id: node.id,
        type: 'op',
        position: { x: node.x, y: node.y },
        selected: node.id === selectedId,
        data: { label: node.name || opLabel(kind) },
      };
    }
    return {
      id: node.id,
      type: 'app',
      position: { x: node.x, y: node.y },
      selected: node.id === selectedId,
      data: { label: node.name || 'App', repository: node.repository },
    };
  });
}

function toEdges(graph: Graph): Edge[] {
  return graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'smoothstep',
  }));
}

function mergeNodes(next: FlowNode[], previous: FlowNode[]): FlowNode[] {
  const prior = new Map(previous.map((node) => [node.id, node]));
  return next.map((node) => {
    const old = prior.get(node.id);
    if (old?.dragging && old.position) return { ...node, position: old.position, dragging: true };
    return node;
  });
}

function fold(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}

function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'));
}

function liveApp(apps: AppView[], node: CommunicationNode) {
  return (
    apps.find((app) => app.folderName && app.folderName === node.folderName) ??
    apps.find((app) => node.repository && app.repository === node.repository)
  );
}

function anchorStyle(x: number, y: number) {
  return {
    left: Math.max(8, Math.min(x, window.innerWidth - 300)),
    top: Math.max(8, Math.min(y, window.innerHeight - 280)),
  };
}

function pointerClient(event: MouseEvent | TouchEvent): { x: number; y: number } | null {
  if ('changedTouches' in event) {
    const touch = event.changedTouches.item(0);
    if (!touch) return null;
    return { x: touch.clientX, y: touch.clientY };
  }
  return { x: event.clientX, y: event.clientY };
}

function disconnectSource(node: CommunicationNode): CommunicationNode {
  const next: CommunicationNode = { ...node };
  delete next.sourceNodeId;
  delete next.sourceField;
  return next;
}

function dropNodes(current: Graph, removed: string[], moved: { id: string; x: number; y: number }[]): Graph {
  const drop = new Set(removed);
  const nodes = current.nodes
    .filter((node) => !drop.has(node.id))
    .map((node) => {
      const move = moved.find((item) => item.id === node.id);
      let next = move ? { ...node, x: Math.round(move.x), y: Math.round(move.y) } : node;
      if (next.sourceNodeId && drop.has(next.sourceNodeId)) next = disconnectSource(next);
      return next;
    });
  const edges =
    drop.size === 0 ? current.edges : current.edges.filter((edge) => !drop.has(edge.source) && !drop.has(edge.target));
  return { nodes, edges };
}

function dropEdges(current: Graph, removed: string[]): Graph {
  const drop = new Set(removed);
  const gone = current.edges.filter((edge) => drop.has(edge.id));
  const nodes = current.nodes.map((node) => {
    if (!opKind(node.kind) || !node.sourceNodeId) return node;
    const cut = gone.some((edge) => edge.target === node.id && edge.source === node.sourceNodeId);
    return cut ? disconnectSource(node) : node;
  });
  return { nodes, edges: current.edges.filter((edge) => !drop.has(edge.id)) };
}

function isLaunchVariable(key: string): boolean {
  return (
    key === 'port' ||
    key === 'url' ||
    key === 'cwd' ||
    key === 'pre-start' ||
    key.startsWith('pre-start.') ||
    key === 'start' ||
    key.startsWith('start.') ||
    key.startsWith('env.')
  );
}

function isNumericField(field: LaunchField): boolean {
  if (field.key === 'port') return true;
  return (field.fieldType || '').toLowerCase() === 'number';
}

function normalizedFieldType(field: LaunchField): string {
  if (field.key === 'port') return 'number';
  return (field.fieldType || 'text').toLowerCase();
}

function parseChainNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatChainNumber(value: number): string {
  if (!Number.isFinite(value)) return '';
  const rounded = Math.round(value * 1e6) / 1e6;
  if (Object.is(rounded, -0)) return '0';
  return String(rounded);
}

function classifyValue(value: string): ValueType {
  const trimmed = value.trim();
  if (/^(true|false|yes|no|on|off)$/i.test(trimmed)) return 'boolean';
  if (/^https?:\/\//i.test(trimmed)) return 'url';
  if (parseChainNumber(trimmed) !== null) return 'number';
  return 'text';
}

function fieldAccepts(field: LaunchField, type: ValueType): boolean {
  const fieldType = normalizedFieldType(field);
  if (type === 'number') return fieldType === 'number';
  if (type === 'boolean') return fieldType === 'boolean';
  if (type === 'url') return fieldType === 'url';
  return fieldType === 'text' || fieldType === 'multiline';
}

function failure(node: CommunicationNode | undefined, nodeId: string, reason: ChainReason): ChainFailure {
  return { ok: false, nodeId, nodeName: node ? nodeTitle(node) : 'Operação', reason };
}

function previewFailure(reason: ChainReason): string {
  switch (reason) {
    case 'cycle':
      return 'Ciclo na cadeia';
    case 'missing-source':
      return 'Origem ausente';
    case 'missing-app':
      return 'App indisponível';
    case 'not-installed':
      return 'App não instalada';
    case 'missing-field':
      return 'Campo indisponível';
    case 'non-numeric':
      return 'Valor não numérico';
    case 'unavailable':
      return 'Launchfile indisponível';
  }
}

function failureMessage(result: ChainFailure): string {
  const name = result.nodeName;
  switch (result.reason) {
    case 'cycle':
      return `${name} falhou: a cadeia fecha um ciclo.`;
    case 'missing-source':
      return `${name} falhou: a origem não está no grafo.`;
    case 'missing-app':
      return `${name} falhou: a app de origem não está na biblioteca.`;
    case 'not-installed':
      return `${name} falhou: a app de origem não está instalada.`;
    case 'missing-field':
      return `${name} falhou: o campo de origem não está no Launchfile.`;
    case 'non-numeric':
      return `${name} falhou: o valor não é numérico.`;
    case 'unavailable':
      return `${name} falhou: o Launchfile da origem está indisponível.`;
  }
}

function applyStep(node: CommunicationNode, upstream: ChainSuccess): ChainResult {
  if (!upstream.numeric) return failure(node, node.id, 'non-numeric');
  const parsed = parseChainNumber(upstream.value);
  const amount = parseChainNumber(node.step ?? '');
  if (parsed === null || amount === null || (node.kind !== 'increment' && node.kind !== 'decrement')) {
    return failure(node, node.id, 'non-numeric');
  }
  const delta = node.kind === 'decrement' ? -amount : amount;
  const next = formatChainNumber(parsed + delta);
  if (parseChainNumber(next) === null) return failure(node, node.id, 'non-numeric');
  return { ok: true, value: next, numeric: true };
}

/**
 * Sobe pela origem até um campo de app ou um Definir valor.
 * Definir valor devolve o literal e ignora o que veio antes.
 * Get devolve o valor copiado. Incrementar e Decrementar aplicam o passo nessa volta.
 */
function evaluateChain(graph: Graph, apps: AppView[], nodeId: string, seen: Set<string>): ChainResult {
  const node = graph.nodes.find((item) => item.id === nodeId);
  if (!node || !opKind(node.kind)) return failure(node, nodeId, 'missing-source');
  if (node.kind === 'value') {
    const literal = node.literal ?? '';
    return { ok: true, value: literal, numeric: parseChainNumber(literal) !== null };
  }
  if (seen.has(node.id)) return failure(node, node.id, 'cycle');
  const nextSeen = new Set(seen);
  nextSeen.add(node.id);
  if (!node.sourceNodeId) return failure(node, node.id, 'missing-source');
  const source = graph.nodes.find((item) => item.id === node.sourceNodeId);
  if (!source) return failure(node, node.id, 'missing-source');
  let upstream: ChainResult;
  if (opKind(source.kind)) {
    upstream = evaluateChain(graph, apps, source.id, nextSeen);
  } else {
    const live = liveApp(apps, source);
    if (!live) return failure(node, node.id, 'missing-app');
    if (live.status === 'not_installed') return failure(node, node.id, 'not-installed');
    const id = appId(live);
    if (!readSnapshot(id) && !readDraft(id)) return failure(node, node.id, 'unavailable');
    if (!node.sourceField) return failure(node, node.id, 'missing-field');
    const raw = readField(id, node.sourceField);
    if (raw === undefined) return failure(node, node.id, 'missing-field');
    upstream = { ok: true, value: raw, numeric: parseChainNumber(raw) !== null };
  }
  if (!upstream.ok) return upstream;
  if (node.kind === 'get') return upstream;
  return applyStep(node, upstream);
}

function outputType(source: CommunicationNode, value: string): ValueType {
  if (source.kind === 'increment' || source.kind === 'decrement') return 'number';
  return classifyValue(value);
}

function producedValue(graph: Graph, apps: AppView[], source: CommunicationNode): string {
  if (source.kind === 'value') return source.literal ?? '';
  if (source.kind === 'increment' || source.kind === 'decrement') return '0';
  const result = evaluateChain(graph, apps, source.id, new Set());
  return result.ok ? result.value : '';
}

function outputIsNumeric(graph: Graph, apps: AppView[], nodeId: string): boolean {
  const node = graph.nodes.find((item) => item.id === nodeId);
  const kind = opKind(node?.kind);
  if (!node || !kind) return false;
  if (kind === 'value') return parseChainNumber(node.literal ?? '') !== null;
  const result = evaluateChain(graph, apps, nodeId, new Set());
  return result.ok && result.numeric;
}

function showMathForSource(graph: Graph, apps: AppView[], source: CommunicationNode): boolean {
  if (!opKind(source.kind)) return true;
  return outputIsNumeric(graph, apps, source.id);
}

function chainAppNode(graph: Graph, nodeId: string): CommunicationNode | null {
  const seen = new Set<string>();
  let current = graph.nodes.find((node) => node.id === nodeId);
  while (current && opKind(current.kind)) {
    if (current.kind === 'value') return null;
    if (seen.has(current.id)) return null;
    seen.add(current.id);
    const sourceId = current.sourceNodeId;
    if (!sourceId) return null;
    const source = graph.nodes.find((node) => node.id === sourceId);
    if (!source) return null;
    if (!opKind(source.kind)) return source;
    current = source;
  }
  return null;
}

function wouldCycle(graph: Graph, sourceId: string, targetId: string): boolean {
  const seen = new Set<string>();
  let current: string | undefined = sourceId;
  while (current) {
    if (current === targetId) return true;
    if (seen.has(current)) return false;
    seen.add(current);
    current = graph.nodes.find((node) => node.id === current)?.sourceNodeId;
  }
  return false;
}

function takenTargetFields(graph: Graph, apps: AppView[], target: CommunicationNode): Set<string> {
  const key = appKey(apps, target);
  const taken = new Set<string>();
  for (const edge of graph.edges) {
    if (!edge.targetField) continue;
    const dest = graph.nodes.find((node) => node.id === edge.target);
    if (!dest || appKey(apps, dest) !== key) continue;
    taken.add(edge.targetField);
  }
  return taken;
}

function appKey(apps: AppView[], node: CommunicationNode): string {
  const live = liveApp(apps, node);
  if (live) return appId(live);
  return node.folderName?.trim() || node.repository || node.id;
}

function dirtyLaunchIds(graph: Graph, apps: AppView[]): string[] {
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (opKind(node.kind)) continue;
    const live = liveApp(apps, node);
    if (!live || live.status === 'not_installed') continue;
    const id = appId(live);
    if (isLaunchConfigDirty(id)) ids.add(id);
  }
  return [...ids];
}

function destinationDrift(graph: Graph, apps: AppView[]): boolean {
  if (!graph.edges.some((edge) => edge.targetField?.trim())) return false;
  const plan = planWrites(graph, apps);
  if (!plan.ok) return true;
  return plan.writes.some((write) => readField(write.appId, write.key) !== write.value);
}

function planWrites(graph: Graph, apps: AppView[]): WritePlan {
  const writes: PlannedWrite[] = [];
  const seen = new Set<string>();
  for (const edge of graph.edges) {
    const key = edge.targetField?.trim() ?? '';
    if (!key) continue;
    const source = graph.nodes.find((node) => node.id === edge.source);
    const dest = graph.nodes.find((node) => node.id === edge.target);
    if (!source || !opKind(source.kind)) {
      return { ok: false, message: 'Uma ligação falhou: a origem não está no grafo.' };
    }
    if (!dest || opKind(dest.kind)) {
      return { ok: false, message: `${nodeTitle(source)} falhou: o destino não é uma app.` };
    }
    const live = liveApp(apps, dest);
    if (!live) {
      return { ok: false, message: `${dest.name || 'App'} falhou: a app de destino não está na biblioteca.` };
    }
    const slot = `${appId(live)}\0${key}`;
    if (seen.has(slot)) {
      return { ok: false, message: `${nodeTitle(source)} falhou: o campo ${key} já tem uma ligação.` };
    }
    seen.add(slot);
    const result = evaluateChain(graph, apps, source.id, new Set());
    if (!result.ok) return { ok: false, message: failureMessage(result) };
    writes.push({
      sourceName: nodeTitle(source),
      appId: appId(live),
      key,
      value: result.value,
      valueType: outputType(source, result.value),
      destNode: dest,
      destName: live.name || dest.name || 'App',
    });
  }
  return { ok: true, writes };
}

function sourceLabel(graph: Graph, node: CommunicationNode): string {
  if (!node.sourceNodeId) return 'Origem ausente';
  const source = graph.nodes.find((item) => item.id === node.sourceNodeId);
  if (!source) return 'Origem ausente';
  const kind = opKind(source.kind);
  return kind ? opLabel(kind) : source.name || 'App';
}

function fieldHint(prompt: FieldPrompt, graph: Graph): string {
  if (prompt.purpose === 'bind') return 'O Salvar grava o valor calculado neste campo.';
  if (prompt.purpose === 'create' && prompt.op === 'value') return 'O texto digitado fica guardado neste node.';
  if (prompt.purpose === 'create' && prompt.op === 'get') return 'O node copia este valor. O Salvar grava só no destino.';
  if (prompt.purpose === 'create') return 'O node mostra o valor calculado. O Salvar grava só no destino.';
  const target = graph.nodes.find((node) => node.id === prompt.targetId);
  if (target?.kind === 'value') return 'O valor guardado continua o mesmo.';
  if (target?.kind === 'get') return 'O Get passa a copiar este campo.';
  return 'Esta ligação passa a ser a entrada da operação.';
}

function idleEmpty(prompt: FieldPrompt, graph: Graph): string {
  if (prompt.purpose === 'bind') return 'Nenhum campo aceita este valor.';
  if (prompt.purpose === 'create' && (prompt.op === 'increment' || prompt.op === 'decrement')) return 'Nenhum campo numérico.';
  if (prompt.purpose === 'retarget') {
    const target = graph.nodes.find((node) => node.id === prompt.targetId);
    if (target?.kind === 'increment' || target?.kind === 'decrement') return 'Nenhum campo numérico.';
  }
  return 'Nenhuma variável.';
}

function acceptsField(field: LaunchField, numeric: boolean, valueType: ValueType | null, taken: Set<string>): boolean {
  if (!isLaunchVariable(field.key) || taken.has(field.key)) return false;
  if (valueType) return fieldAccepts(field, valueType);
  if (numeric) return isNumericField(field);
  return true;
}

async function warmLaunch(client: QueryClient, id: string) {
  if (readSnapshot(id)) return;
  await client.fetchQuery({
    queryKey: launchConfigQueryKey(id),
    queryFn: () => appLaunchConfigGet(id),
    staleTime: 0,
  });
}

async function warmChain(client: QueryClient, graph: Graph, apps: AppView[], nodeId: string) {
  const root = chainAppNode(graph, nodeId);
  if (!root) return;
  const live = liveApp(apps, root);
  if (!live || live.status === 'not_installed') return;
  try {
    await warmLaunch(client, appId(live));
  } catch {
    // A pré-visualização mostra o Launchfile indisponível.
  }
}

async function warmGraph(client: QueryClient, graph: Graph, apps: AppView[]) {
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (!opKind(node.kind)) continue;
    const root = chainAppNode(graph, node.id);
    if (!root) continue;
    const live = liveApp(apps, root);
    if (!live || live.status === 'not_installed') continue;
    ids.add(appId(live));
  }
  for (const id of ids) {
    try {
      await warmLaunch(client, id);
    } catch {
      // evaluateChain marca a cadeia como indisponível.
    }
  }
}

function PreviewText({ nodeId, result, plain }: { nodeId: string; result: ChainResult; plain?: boolean }) {
  const { graph } = useCommunicationsGraph();
  const node = graph.nodes.find((item) => item.id === nodeId);
  const text = result.ok
    ? node?.kind === 'value' && result.value.trim() === ''
      ? 'Sem valor'
      : result.value
    : previewFailure(result.reason);
  const muted = !result.ok || text === 'Sem valor';
  return (
    <span className={plain ? undefined : cx(styles.nodeMeta, !muted && styles.opValue)} title={text}>
      {text}
    </span>
  );
}

function ChainPreviewValue({ nodeId, plain }: { nodeId: string; plain?: boolean }) {
  const { graph, apps } = useCommunicationsGraph();
  const result = evaluateChain(graph, apps, nodeId, new Set());
  return <PreviewText nodeId={nodeId} result={result} plain={plain} />;
}

function ChainPreviewLoaded({ nodeId, launchId, plain }: { nodeId: string; launchId: string; plain?: boolean }) {
  const config = useLaunchConfig(launchId);
  const { graph, apps } = useCommunicationsGraph();
  if (config.isPending && !config.data && !readDraft(launchId)) {
    return <span className={plain ? undefined : styles.nodeMeta}>A carregar…</span>;
  }
  if ((config.isError || !config.data) && !readDraft(launchId) && !readSnapshot(launchId)) {
    return <span className={plain ? undefined : styles.nodeMeta}>Launchfile indisponível</span>;
  }
  const result = evaluateChain(graph, apps, nodeId, new Set());
  return <PreviewText nodeId={nodeId} result={result} plain={plain} />;
}

function ChainPreview({ nodeId, plain }: { nodeId: string; plain?: boolean }) {
  const { graph, apps, libraryPending } = useCommunicationsGraph();
  const node = graph.nodes.find((item) => item.id === nodeId);
  if (!node || !opKind(node.kind)) return null;
  if (libraryPending) return <span className={plain ? undefined : styles.nodeMeta}>A carregar…</span>;
  const root = chainAppNode(graph, node.id);
  if (!root) return <ChainPreviewValue nodeId={node.id} plain={plain} />;
  const live = liveApp(apps, root);
  if (!live) return <span className={plain ? undefined : styles.nodeMeta}>App indisponível</span>;
  if (live.status === 'not_installed') return <span className={plain ? undefined : styles.nodeMeta}>App não instalada</span>;
  return <ChainPreviewLoaded nodeId={node.id} launchId={appId(live)} plain={plain} />;
}

function appReads(graph: Graph, nodeId: string): boolean {
  return graph.nodes.some((node) => {
    if (!opKind(node.kind)) return false;
    if (chainAppNode(graph, node.id)?.id === nodeId) return true;
    return node.kind === 'value' && node.sourceNodeId === nodeId && Boolean(node.sourceField);
  });
}

function appReceives(graph: Graph, nodeId: string): boolean {
  return graph.edges.some((edge) => edge.target === nodeId && Boolean(edge.targetField?.trim()));
}

function AppTypeHeader({ launchId }: { launchId: string }) {
  const config = useLaunchConfig(launchId);
  const kind = config.fields.find((field) => field.key === 'kind')?.value ?? '';
  return <div className={styles.nodeHeader}>{kindLabel(kind)}</div>;
}

function NodeHeader({ children }: { children: string }) {
  return <div className={styles.nodeHeader}>{children}</div>;
}

function AppNode({ id, data, selected }: NodeProps<AppFlowNode>) {
  const { graph, apps } = useCommunicationsGraph();
  const node = graph.nodes.find((item) => item.id === id);
  const reads = node ? appReads(graph, node.id) : false;
  const receives = node ? appReceives(graph, node.id) : false;
  const live = node ? liveApp(apps, node) : undefined;
  const launchId = live && live.status !== 'not_installed' ? appId(live) : '';
  let header = 'Tipo desconhecido';
  if (reads && receives) header = 'Get · Set';
  else if (reads) header = 'Get';
  else if (receives) header = 'Set';
  return (
    <div className={cx(styles.node, selected && styles.nodeSelected)}>
      <Handle type="target" position={Position.Left} />
      {reads || receives ? <NodeHeader>{header}</NodeHeader> : launchId ? <AppTypeHeader launchId={launchId} /> : <NodeHeader>{header}</NodeHeader>}
      <div className={styles.nodeBody}>
        <div className={styles.nodeTitle}>{data.label}</div>
        <div className={styles.nodeMeta}>{data.repository || 'Sem repositório'}</div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function OpNode({ id, selected }: NodeProps<OpFlowNode>) {
  const { graph } = useCommunicationsGraph();
  const node = graph.nodes.find((item) => item.id === id);
  const kind = opKind(node?.kind);
  return (
    <div className={cx(styles.node, styles.opNode, selected && styles.nodeSelected)}>
      <Handle type="target" position={Position.Left} />
      <NodeHeader>Get</NodeHeader>
      <div className={styles.nodeBody}>
        <div className={styles.nodeTitle}>{kind ? opLabel(kind) : 'Operação'}</div>
        {node && kind ? <ChainPreview nodeId={node.id} /> : null}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { app: AppNode, op: OpNode };

function NodeDetails({
  node,
  apps,
  onAlwaysOn,
}: {
  node: CommunicationNode;
  apps: AppView[];
  onAlwaysOn: (alwaysOn: boolean) => void;
}) {
  const live = liveApp(apps, node);
  const installed = Boolean(live && live.status !== 'not_installed');
  return (
    <div className={styles.details}>
      <PreferenceToggleRow
        title="Sempre ligado"
        description="O Run flow inicia esta app se ela estiver parada."
        checked={node.alwaysOn}
        onChange={onAlwaysOn}
      />
      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>Repositório</dt>
          <dd>{node.repository || '—'}</dd>
        </div>
        <div className={styles.fact}>
          <dt>Pasta</dt>
          <dd>{node.folderName || '—'}</dd>
        </div>
        <div className={styles.fact}>
          <dt>Node</dt>
          <dd className={styles.uuid}>{node.id}</dd>
        </div>
        {live ? (
          <div className={styles.fact}>
            <dt>Biblioteca</dt>
            <dd>
              <div className={styles.badges}>
                <StatusBadge label={statusLabel(live.status)} tone={live.status === 'installed' ? 'success' : live.status === 'update' ? 'warning' : 'muted'} />
                <StatusBadge label={live.running ? 'Em execução' : 'Parada'} tone={live.running ? 'success' : 'muted'} />
              </div>
            </dd>
          </div>
        ) : (
          <p className={styles.missing}>Este app não está mais na biblioteca.</p>
        )}
      </dl>
      {installed && live ? <LaunchConfigPanel app={live} showSave={false} /> : null}
      {live && !installed ? (
        <p className={styles.missing}>Os campos do Executável aparecem depois da instalação. O Run flow instala esta app.</p>
      ) : null}
    </div>
  );
}

function OpDetails({
  node,
  onStep,
  onLiteral,
}: {
  node: CommunicationNode;
  onStep: (step: string) => void;
  onLiteral: (literal: string) => void;
}) {
  const { graph } = useCommunicationsGraph();
  const kind = opKind(node.kind);
  const stepLabel = kind === 'decrement' ? 'Decremento' : 'Incremento';
  return (
    <div className={styles.details}>
      <dl className={styles.facts}>
        <div className={styles.fact}>
          <dt>Operação</dt>
          <dd>{kind ? opLabel(kind) : '—'}</dd>
        </div>
        <div className={styles.fact}>
          <dt>Pré-visualização</dt>
          <dd>
            <ChainPreview nodeId={node.id} plain />
          </dd>
        </div>
        <div className={styles.fact}>
          <dt>Origem</dt>
          <dd>{sourceLabel(graph, node)}</dd>
        </div>
        {node.sourceField ? (
          <div className={styles.fact}>
            <dt>Campo</dt>
            <dd>{node.sourceField}</dd>
          </div>
        ) : null}
      </dl>
      {kind === 'increment' || kind === 'decrement' ? (
        <label className={styles.configField}>
          <span className={styles.configLabel}>{stepLabel}</span>
          <Input
            value={node.step ?? '1'}
            onChange={(event) => onStep(event.target.value)}
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
      ) : null}
      {kind === 'value' ? (
        <label className={styles.configField}>
          <span className={styles.configLabel}>Valor</span>
          <Input
            value={node.literal ?? ''}
            onChange={(event) => onLiteral(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            maxLength={2000}
          />
        </label>
      ) : null}
    </div>
  );
}

function FieldList({
  launchId,
  numeric,
  valueType,
  taken,
  idleMessage,
  onPick,
}: {
  launchId: string;
  numeric: boolean;
  valueType: ValueType | null;
  taken: Set<string>;
  idleMessage: string;
  onPick: (field: LaunchField) => void;
}) {
  const config = useLaunchConfig(launchId);
  const [query, setQuery] = useState('');
  if (config.isPending && !config.isSuccess && config.fields.length === 0) {
    return <p className={styles.missing}>A carregar variáveis…</p>;
  }
  if (config.isError && config.fields.length === 0) {
    return <p className={styles.missing}>Launchfile indisponível.</p>;
  }
  const available = config.fields.filter((field) => acceptsField(field, numeric, valueType, taken));
  const term = fold(query.trim());
  const shown = available.filter((field) => !term || fold(`${field.label} ${field.key} ${field.value}`).includes(term));
  return (
    <SearchableListPanel
      className={styles.fieldList}
      query={query}
      onQueryChange={setQuery}
      placeholder="Buscar variável..."
      emptyMessage={available.length === 0 ? idleMessage : 'Nenhuma variável'}
      aria-label="Variáveis do Launchfile"
      items={shown}
      renderItem={(field) => (
        <button type="button" className={styles.item} onClick={() => onPick(field)}>
          <span className={styles.itemBody}>
            <span className={styles.itemLabel}>{field.label || field.key}</span>
            <span className={styles.itemDetail}>
              {field.key} · {field.value.trim() ? field.value : 'vazio'}
            </span>
          </span>
        </button>
      )}
    />
  );
}

function FieldModal({
  prompt,
  onPick,
  onClose,
}: {
  prompt: FieldPrompt;
  onPick: (field: LaunchField) => void;
  onClose: () => void;
}) {
  const { graph, apps, libraryPending } = useCommunicationsGraph();
  const appNodeId = prompt.purpose === 'bind' ? prompt.targetId : prompt.sourceId;
  const appNode = graph.nodes.find((node) => node.id === appNodeId);
  const live = appNode && !opKind(appNode.kind) ? liveApp(apps, appNode) : undefined;
  const launchId = live ? appId(live) : '';
  const status = libraryPending ? 'pending' : !live ? 'missing' : live.status === 'not_installed' ? 'not-installed' : 'ready';
  const numeric =
    prompt.purpose === 'create'
      ? prompt.op === 'increment' || prompt.op === 'decrement'
      : prompt.purpose === 'retarget'
        ? (() => {
            const targetKind = graph.nodes.find((node) => node.id === prompt.targetId)?.kind;
            return targetKind === 'increment' || targetKind === 'decrement';
          })()
        : false;
  const source = prompt.purpose === 'bind' ? graph.nodes.find((node) => node.id === prompt.sourceId) : undefined;
  const sourceRoot = source?.kind === 'get' ? chainAppNode(graph, source.id) : null;
  const sourceLive = sourceRoot ? liveApp(apps, sourceRoot) : undefined;
  const sourceLaunchId = sourceLive && sourceLive.status !== 'not_installed' ? appId(sourceLive) : '';
  useLaunchConfig(sourceLaunchId, Boolean(sourceLaunchId));
  const valueType: ValueType | null =
    prompt.purpose === 'bind' && source && opKind(source.kind)
      ? source.kind === 'increment' || source.kind === 'decrement'
        ? 'number'
        : source.kind === 'value'
          ? classifyValue(source.literal ?? '')
          : (() => {
              const result = evaluateChain(graph, apps, source.id, new Set());
              return result.ok ? classifyValue(result.value) : 'text';
            })()
      : null;
  const taken = prompt.purpose === 'bind' && appNode ? takenTargetFields(graph, apps, appNode) : EMPTY_TAKEN;
  const statusText =
    status === 'pending'
      ? 'A carregar…'
      : status === 'not-installed'
        ? 'Esta app não está instalada. Os campos do Executável aparecem depois da instalação.'
        : 'Esta app não está na biblioteca.';

  return (
    <Modal isOpen onClose={onClose} title={prompt.purpose === 'bind' ? 'Variável de destino' : 'Variável de origem'} maxWidth={440}>
      <Modal.Content>
        <Modal.Text>{fieldHint(prompt, graph)}</Modal.Text>
        {status === 'ready' && launchId ? (
          <FieldList
            launchId={launchId}
            numeric={numeric}
            valueType={valueType}
            taken={taken}
            idleMessage={idleEmpty(prompt, graph)}
            onPick={onPick}
          />
        ) : (
          <p className={styles.missing}>{statusText}</p>
        )}
      </Modal.Content>
    </Modal>
  );
}

function LiteralModal({
  initial,
  onConfirm,
  onClose,
}: {
  initial: string;
  onConfirm: (value: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <Modal isOpen onClose={onClose} title="Definir valor" maxWidth={440}>
      <Modal.Content>
        <Modal.Text>O texto fica guardado neste node.</Modal.Text>
        <Modal.Field label="Valor">
          <Input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            maxLength={2000}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onConfirm(value);
              }
            }}
          />
        </Modal.Field>
      </Modal.Content>
      <Modal.Footer>
        <Button type="button" onClick={onClose}>
          Cancelar
        </Button>
        <Button type="button" variant="primary" onClick={() => onConfirm(value)}>
          Definir
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

function CommunicationsCanvas({ orgId, initial }: { orgId: string; initial: Graph }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const toast = useToast();
  const mutations = useLibraryMutations();
  const { screenToFlowPosition, fitView } = useReactFlow();
  const library = useQuery({
    queryKey: ['launcher', 'library', orgId],
    queryFn: libraryList,
  });
  const apps = library.data?.apps ?? EMPTY_APPS;
  const [graph, setGraph] = useState(initial);
  const [baseline, setBaseline] = useState(() => signature(initial));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<FlowNode[]>(() => toFlow(initial, null));
  const [edges, setEdges] = useState(() => toEdges(initial));
  const [picker, setPicker] = useState<{ x: number; y: number; flowX: number; flowY: number } | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [opMenu, setOpMenu] = useState<OpMenuState | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [saving, setSaving] = useState(false);
  const [runningFlow, setRunningFlow] = useState(false);
  const [flowPhase, setFlowPhase] = useState('');
  const [error, setError] = useState('');
  const [steps, setSteps] = useState({ undo: 0, redo: 0 });
  const graphRef = useRef(graph);
  const appsRef = useRef(apps);
  const pastRef = useRef<Graph[]>([]);
  const futureRef = useRef<Graph[]>([]);
  const pendingRef = useRef<Graph | null>(null);
  const queuedRef = useRef(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const opMenuRef = useRef<HTMLDivElement>(null);
  const fitOnce = useRef(initial.nodes.length > 0);
  const runningRef = useRef(false);
  const suppressPaneRef = useRef(false);
  const menuToken = useRef(0);
  graphRef.current = graph;
  appsRef.current = apps;

  const contextValue = useMemo(
    () => ({ graph, apps, libraryPending: library.isPending }),
    [graph, apps, library.isPending],
  );

  function syncSteps() {
    setSteps({ undo: pastRef.current.length, redo: futureRef.current.length });
  }

  function commit(next: Graph) {
    pendingRef.current = null;
    if (signature(next) === signature(graphRef.current)) return;
    pastRef.current = [...pastRef.current, graphRef.current].slice(-HISTORY_LIMIT);
    futureRef.current = [];
    graphRef.current = next;
    setGraph(next);
    syncSteps();
  }

  function queueCommit(recipe: (current: Graph) => Graph) {
    const base = pendingRef.current ?? graphRef.current;
    pendingRef.current = recipe(base);
    if (queuedRef.current) return;
    queuedRef.current = true;
    queueMicrotask(() => {
      queuedRef.current = false;
      const next = pendingRef.current;
      pendingRef.current = null;
      if (next) commit(next);
    });
  }

  function undo() {
    const prev = pastRef.current[pastRef.current.length - 1];
    if (!prev) return;
    pastRef.current = pastRef.current.slice(0, -1);
    futureRef.current = [...futureRef.current, graphRef.current].slice(-HISTORY_LIMIT);
    graphRef.current = prev;
    setGraph(prev);
    setSelectedId((id) => (id && prev.nodes.some((node) => node.id === id) ? id : null));
    setPicker(null);
    setOpMenu(null);
    setPrompt(null);
    syncSteps();
  }

  function redo() {
    const next = futureRef.current[futureRef.current.length - 1];
    if (!next) return;
    futureRef.current = futureRef.current.slice(0, -1);
    pastRef.current = [...pastRef.current, graphRef.current].slice(-HISTORY_LIMIT);
    graphRef.current = next;
    setGraph(next);
    setSelectedId((id) => (id && next.nodes.some((node) => node.id === id) ? id : null));
    setPicker(null);
    setOpMenu(null);
    setPrompt(null);
    syncSteps();
  }

  const undoRef = useRef(undo);
  const redoRef = useRef(redo);
  undoRef.current = undo;
  redoRef.current = redo;

  useEffect(() => {
    setNodes((prev) => mergeNodes(toFlow(graph, selectedId), prev));
    setEdges(toEdges(graph));
  }, [graph, selectedId]);

  useEffect(() => {
    if (!fitOnce.current) return;
    const frame = requestAnimationFrame(() => {
      fitOnce.current = false;
      fitView({ padding: 0.4 });
    });
    return () => cancelAnimationFrame(frame);
  }, [fitView]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return;
      const meta = event.ctrlKey || event.metaKey;
      if (!meta) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undoRef.current();
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        redoRef.current();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!picker && !opMenu) return;
    function onPointer(event: MouseEvent) {
      const target = event.target as globalThis.Node;
      if (pickerRef.current?.contains(target) || opMenuRef.current?.contains(target)) return;
      setPicker(null);
      setOpMenu(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setPicker(null);
        setOpMenu(null);
      }
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [picker, opMenu]);

  useEffect(() => {
    if (opMenu && !graph.nodes.some((node) => node.id === opMenu.sourceId)) setOpMenu(null);
  }, [graph, opMenu]);

  useEffect(() => {
    if (!prompt) return;
    const ids = prompt.purpose === 'create' ? [prompt.sourceId] : [prompt.sourceId, prompt.targetId];
    if (ids.some((id) => !graph.nodes.some((node) => node.id === id))) setPrompt(null);
  }, [graph, prompt]);

  const selected = graph.nodes.find((node) => node.id === selectedId) ?? null;
  const draftEpoch = useSyncExternalStore(subscribeLaunchDrafts, launchDraftEpoch, launchDraftEpoch);
  const [warmEpoch, setWarmEpoch] = useState(0);
  const graphDirty = signature(graph) !== baseline;
  const needsSave = useMemo(
    () => graphDirty || dirtyLaunchIds(graph, apps).length > 0 || destinationDrift(graph, apps),
    [graphDirty, graph, apps, draftEpoch, warmEpoch],
  );

  useEffect(() => {
    let cancel = false;
    void warmGraph(queryClient, graph, apps).finally(() => {
      if (!cancel) setWarmEpoch((value) => value + 1);
    });
    return () => {
      cancel = true;
    };
  }, [graph, apps, queryClient]);
  const term = fold(pickerQuery.trim());
  const pickerItems = apps.filter((app) => !term || fold(`${app.name} ${app.repository} ${app.folderName}`).includes(term));
  const menuItems = OP_MENU.filter((item) => item.kind === 'value' || item.kind === 'get' || opMenu?.showMath);

  function openPicker(event: { clientX: number; clientY: number; preventDefault: () => void }) {
    event.preventDefault();
    const flow = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    setSelectedId(null);
    setPickerQuery('');
    setOpMenu(null);
    setPicker({ x: event.clientX, y: event.clientY, flowX: flow.x, flowY: flow.y });
  }

  function addApp(app: AppView) {
    if (!picker) return;
    const id = crypto.randomUUID();
    commit({
      ...graphRef.current,
      nodes: [
        ...graphRef.current.nodes,
        {
          id,
          folderName: app.folderName,
          repository: app.repository,
          name: app.name,
          x: Math.round(picker.flowX),
          y: Math.round(picker.flowY),
          alwaysOn: false,
        },
      ],
    });
    setSelectedId(id);
    setPicker(null);
  }

  function canConnect(connection: Connection | Edge) {
    if (!connection.source || !connection.target || connection.source === connection.target) return false;
    if (graphRef.current.edges.some((edge) => edge.source === connection.source && edge.target === connection.target)) {
      return false;
    }
    const target = graphRef.current.nodes.find((node) => node.id === connection.target);
    if (target && opKind(target.kind) && wouldCycle(graphRef.current, connection.source, connection.target)) return false;
    return true;
  }

  function createLinkedOp(input: {
    kind: CommunicationOpKind;
    source: CommunicationNode;
    flowX: number;
    flowY: number;
    sourceField?: string;
    literal?: string;
  }) {
    const sourceIsApp = !opKind(input.source.kind);
    if (sourceIsApp && !input.sourceField) return;
    if (input.kind === 'value' && input.literal === undefined) return;
    const id = crypto.randomUUID();
    const created: CommunicationNode = {
      id,
      folderName: '',
      repository: '',
      name: opLabel(input.kind),
      x: Math.round(input.flowX),
      y: Math.round(input.flowY),
      alwaysOn: false,
      kind: input.kind,
      sourceNodeId: input.source.id,
    };
    if (sourceIsApp && input.sourceField) created.sourceField = input.sourceField;
    if (input.kind === 'value') created.literal = input.literal ?? '';
    if (input.kind === 'increment' || input.kind === 'decrement') created.step = '1';
    commit({
      nodes: [...graphRef.current.nodes, created],
      edges: [...graphRef.current.edges, { id: crypto.randomUUID(), source: input.source.id, target: id }],
    });
    setSelectedId(id);
  }

  function replaceOpInput(sourceId: string, targetId: string, field?: LaunchField) {
    const current = graphRef.current;
    if (wouldCycle(current, sourceId, targetId)) {
      toast.error('Esta ligação fecharia um ciclo.');
      return;
    }
    const source = current.nodes.find((node) => node.id === sourceId);
    const target = current.nodes.find((node) => node.id === targetId);
    if (!source || !target || !opKind(target.kind)) return;
    const sourceIsApp = !opKind(source.kind);
    if (sourceIsApp) {
      if (!field || !isLaunchVariable(field.key)) return;
      if ((target.kind === 'increment' || target.kind === 'decrement') && !isNumericField(field)) return;
    }
    const edges = current.edges.filter((edge) => edge.target !== targetId);
    edges.push({ id: crypto.randomUUID(), source: sourceId, target: targetId });
    const nodes = current.nodes.map((node) => {
      if (node.id !== targetId) return node;
      const next: CommunicationNode = { ...node, sourceNodeId: sourceId };
      if (sourceIsApp && field) next.sourceField = field.key;
      else delete next.sourceField;
      return next;
    });
    commit({ nodes, edges });
  }

  function bindTarget(sourceId: string, targetId: string, field: LaunchField) {
    const current = graphRef.current;
    const source = current.nodes.find((node) => node.id === sourceId);
    const target = current.nodes.find((node) => node.id === targetId);
    if (!source || !target || !opKind(source.kind) || opKind(target.kind)) return;
    if (!isLaunchVariable(field.key) || !fieldAccepts(field, outputType(source, producedValue(current, appsRef.current, source)))) {
      toast.error(`${nodeTitle(source)} falhou: tipo incompatível com ${field.label || field.key}.`);
      return;
    }
    if (current.edges.some((edge) => edge.source === sourceId && edge.target === targetId)) return;
    if (takenTargetFields(current, appsRef.current, target).has(field.key)) {
      toast.error('Este campo já tem uma ligação.');
      return;
    }
    commit({
      ...current,
      edges: [...current.edges, { id: crypto.randomUUID(), source: sourceId, target: targetId, targetField: field.key }],
    });
  }

  function onFieldPicked(field: LaunchField) {
    if (!prompt || prompt.step !== 'field') return;
    const source = graphRef.current.nodes.find((node) => node.id === prompt.sourceId);
    if (prompt.purpose === 'create') {
      if (!source) {
        setPrompt(null);
        return;
      }
      if (prompt.op === 'value') {
        const live = liveApp(appsRef.current, source);
        const id = live ? appId(live) : '';
        const initial = (id && readField(id, field.key)) ?? field.value;
        setPrompt({
          step: 'literal',
          purpose: 'create',
          op: 'value',
          sourceId: source.id,
          flowX: prompt.flowX,
          flowY: prompt.flowY,
          sourceField: field.key,
          initial,
        });
        return;
      }
      createLinkedOp({
        kind: prompt.op,
        source,
        flowX: prompt.flowX,
        flowY: prompt.flowY,
        sourceField: field.key,
      });
      setPrompt(null);
      return;
    }
    if (prompt.purpose === 'bind') {
      bindTarget(prompt.sourceId, prompt.targetId, field);
      setPrompt(null);
      return;
    }
    replaceOpInput(prompt.sourceId, prompt.targetId, field);
    setPrompt(null);
  }

  function confirmLiteral(literal: string) {
    if (!prompt || prompt.step !== 'literal') return;
    const source = graphRef.current.nodes.find((node) => node.id === prompt.sourceId);
    if (!source) {
      setPrompt(null);
      return;
    }
    createLinkedOp({
      kind: 'value',
      source,
      flowX: prompt.flowX,
      flowY: prompt.flowY,
      sourceField: prompt.sourceField,
      literal: literal.trim(),
    });
    setPrompt(null);
  }

  function chooseOp(kind: CommunicationOpKind) {
    const menu = opMenu;
    if (!menu) return;
    const source = graphRef.current.nodes.find((node) => node.id === menu.sourceId);
    setOpMenu(null);
    if (!source) return;
    if ((kind === 'increment' || kind === 'decrement') && opKind(source.kind) && !outputIsNumeric(graphRef.current, appsRef.current, source.id)) {
      toast.error(`${opLabel(kind)} precisa de um valor numérico.`);
      return;
    }
    if (opKind(source.kind)) {
      if (kind === 'value') {
        const result = evaluateChain(graphRef.current, appsRef.current, source.id, new Set());
        setPrompt({
          step: 'literal',
          purpose: 'create',
          op: 'value',
          sourceId: source.id,
          flowX: menu.flowX,
          flowY: menu.flowY,
          initial: result.ok ? result.value : '',
        });
        return;
      }
      createLinkedOp({ kind, source, flowX: menu.flowX, flowY: menu.flowY });
      return;
    }
    setPrompt({
      step: 'field',
      purpose: 'create',
      op: kind,
      sourceId: source.id,
      flowX: menu.flowX,
      flowY: menu.flowY,
    });
  }

  function onConnect(connection: Connection) {
    if (!connection.source || !connection.target || !canConnect(connection)) return;
    const current = graphRef.current;
    const source = current.nodes.find((node) => node.id === connection.source);
    const target = current.nodes.find((node) => node.id === connection.target);
    if (!source || !target) return;
    setPicker(null);
    setOpMenu(null);
    const sourceIsOp = Boolean(opKind(source.kind));
    const targetIsOp = Boolean(opKind(target.kind));
    if (!sourceIsOp && !targetIsOp) {
      commit({
        ...current,
        edges: [...current.edges, { id: crypto.randomUUID(), source: source.id, target: target.id }],
      });
      return;
    }
    if (targetIsOp) {
      if (wouldCycle(current, source.id, target.id)) return;
      if (sourceIsOp) {
        replaceOpInput(source.id, target.id);
        return;
      }
      setPrompt({ step: 'field', purpose: 'retarget', sourceId: source.id, targetId: target.id });
      return;
    }
    setPrompt({ step: 'field', purpose: 'bind', sourceId: source.id, targetId: target.id });
  }

  function armPaneSuppress() {
    suppressPaneRef.current = true;
    window.setTimeout(() => {
      suppressPaneRef.current = false;
    }, 120);
  }

  async function openOpMenu(sourceId: string, point: { x: number; y: number }) {
    const token = ++menuToken.current;
    armPaneSuppress();
    const source = graphRef.current.nodes.find((node) => node.id === sourceId);
    if (!source) return;
    const flow = screenToFlowPosition(point);
    if (opKind(source.kind)) await warmChain(queryClient, graphRef.current, appsRef.current, source.id);
    if (token !== menuToken.current) return;
    const latest = graphRef.current.nodes.find((node) => node.id === sourceId);
    if (!latest) return;
    armPaneSuppress();
    setPicker(null);
    setSelectedId(null);
    setOpMenu({
      x: point.x,
      y: point.y,
      flowX: flow.x,
      flowY: flow.y,
      sourceId,
      showMath: showMathForSource(graphRef.current, appsRef.current, latest),
    });
  }

  const onConnectEnd: OnConnectEnd = (event, state) => {
    const fromId = state.fromNode?.id;
    const toId = state.toNode?.id;
    if (fromId && toId) {
      if (fromId !== toId && state.isValid === false && state.fromHandle?.type === 'source') {
        const target = graphRef.current.nodes.find((node) => node.id === toId);
        if (target && opKind(target.kind) && wouldCycle(graphRef.current, fromId, toId)) {
          toast.error('Esta ligação fecharia um ciclo.');
        }
      }
      return;
    }
    if (!fromId || state.fromHandle?.type !== 'source') return;
    const point = pointerClient(event);
    if (!point) return;
    void openOpMenu(fromId, point);
  };

  function onNodesChange(changes: NodeChange<FlowNode>[]) {
    setNodes((current) => applyNodeChanges(changes, current));
    const removed: string[] = [];
    const moved: { id: string; x: number; y: number }[] = [];
    for (const change of changes) {
      if (change.type === 'remove') removed.push(change.id);
      if (change.type === 'position' && change.dragging === false && change.position) {
        moved.push({ id: change.id, x: change.position.x, y: change.position.y });
      }
      if (change.type === 'select' && removed.length === 0 && moved.length === 0) {
        setSelectedId((id) => (change.selected ? change.id : id === change.id ? null : id));
      }
    }
    if (removed.length === 0 && moved.length === 0) return;
    if (removed.length > 0) {
      const drop = new Set(removed);
      setSelectedId((id) => (id && drop.has(id) ? null : id));
    }
    queueCommit((current) => dropNodes(current, removed, moved));
  }

  function onEdgesChange(changes: EdgeChange[]) {
    setEdges((current) => applyEdgeChanges(changes, current));
    const removed = changes.filter((change) => change.type === 'remove').map((change) => change.id);
    if (removed.length === 0) return;
    queueCommit((current) => dropEdges(current, removed));
  }

  function setAlwaysOn(id: string, alwaysOn: boolean) {
    commit({
      ...graphRef.current,
      nodes: graphRef.current.nodes.map((node) => (node.id === id ? { ...node, alwaysOn } : node)),
    });
  }

  async function typecheckWrites(writes: PlannedWrite[]): Promise<boolean> {
    for (const write of writes) {
      setFlowPhase(`A preparar ${write.destName}…`);
      let view;
      try {
        view = await queryClient.fetchQuery({
          queryKey: launchConfigQueryKey(write.appId),
          queryFn: () => appLaunchConfigGet(write.appId),
          staleTime: 0,
        });
      } catch (err) {
        toast.error(`${write.sourceName} falhou: ${launcherError(err)}`);
        return false;
      }
      const field = view.fields.find((item) => item.key === write.key);
      if (!field) {
        toast.error(`${write.sourceName} falhou: o campo ${write.key} não está no Launchfile.`);
        return false;
      }
      if (write.valueType === 'number' && parseChainNumber(write.value) === null) {
        toast.error(`${write.sourceName} falhou: o valor não é numérico.`);
        return false;
      }
      if (!fieldAccepts(field, write.valueType)) {
        toast.error(`${write.sourceName} falhou: tipo incompatível com ${field.label || write.key}.`);
        return false;
      }
    }
    return true;
  }

  async function installMissing(writes: PlannedWrite[]): Promise<PlannedWrite[] | null> {
    const pending: PlannedWrite[] = [];
    const ready: PlannedWrite[] = [];
    let snapshot = await libraryList();
    for (const write of writes) {
      const app = liveApp(snapshot.apps, write.destNode);
      if (!app) {
        toast.error(`${write.destName} falhou: a app de destino não está na biblioteca.`);
        return null;
      }
      if (app.status === 'not_installed') pending.push(write);
      else ready.push(write);
    }
    if (!(await typecheckWrites(ready))) return null;
    for (const write of pending) {
      snapshot = await libraryList();
      const app = liveApp(snapshot.apps, write.destNode);
      if (!app) {
        toast.error(`${write.destName} falhou: a app de destino não está na biblioteca.`);
        return null;
      }
      if (app.status !== 'not_installed') continue;
      setFlowPhase(`A instalar ${app.name}…`);
      const installed = await mutations.install(app);
      if (!installed || installed.needsChoice || installed.needsConfirm) return null;
      snapshot = await libraryList();
      const refreshed = liveApp(snapshot.apps, write.destNode);
      if (!refreshed || refreshed.status === 'not_installed') {
        toast.error(`${write.destName} falhou: a instalação não concluiu.`);
        return null;
      }
    }
    if (!(await typecheckWrites(pending))) return null;
    return writes;
  }

  async function runFlow() {
    if (runningRef.current || saving) return;
    const current = graphRef.current;
    const enabled = current.nodes.filter((node) => node.alwaysOn && !opKind(node.kind));
    if (enabled.length === 0) {
      setError('Nenhuma app marcada como sempre ligada.');
      return;
    }
    runningRef.current = true;
    setRunningFlow(true);
    setError('');
    try {
      const seen = new Set<string>();
      for (const node of enabled) {
        const key = node.folderName || node.repository;
        if (!key || seen.has(key)) continue;
        seen.add(key);
        const snapshot = await libraryList();
        const app = liveApp(snapshot.apps, node);
        if (!app || app.running) continue;
        setFlowPhase(`A iniciar ${app.name}…`);
        if (app.status === 'not_installed') {
          const installed = await mutations.install(app);
          if (!installed || installed.needsChoice || installed.needsConfirm) return;
        }
        const launched = await mutations.launch(app);
        if (!launched || launched.needsChoice || launched.needsForce || !launched.started) return;
      }
    } catch (err) {
      toast.error(launcherError(err));
    } finally {
      runningRef.current = false;
      setRunningFlow(false);
      setFlowPhase('');
    }
  }

  async function openConfigDir() {
    setError('');
    try {
      await communicationsOpenDir();
    } catch (err) {
      setError(launcherError(err));
    }
  }

  function patchNode(id: string, patch: Partial<CommunicationNode>) {
    commit({
      ...graphRef.current,
      nodes: graphRef.current.nodes.map((node) => (node.id === id ? { ...node, ...patch } : node)),
    });
  }

  async function save() {
    if (!needsSave || saving || runningRef.current) return;
    const current = graphRef.current;
    const hasTargets = current.edges.some((edge) => edge.targetField?.trim());
    setSaving(true);
    setError('');
    try {
      if (hasTargets) {
        const snapshot = await libraryList();
        await warmGraph(queryClient, current, snapshot.apps);
        const plan = planWrites(current, snapshot.apps);
        if (!plan.ok) {
          toast.error(plan.message);
          return;
        }
        for (const id of dirtyLaunchIds(current, snapshot.apps)) await commitLaunch(id);
        if (plan.writes.length > 0) {
          const ready = await installMissing(plan.writes);
          if (!ready) return;
          for (const write of ready) {
            setFlowPhase(`A gravar ${write.destName}…`);
            await applyComputed(write.appId, write.key, write.value);
          }
        }
      } else {
        for (const id of dirtyLaunchIds(current, appsRef.current)) await commitLaunch(id);
      }
      if (signature(graphRef.current) !== baseline) {
        const saved = normalize(await communicationsSave(graphRef.current));
        graphRef.current = saved;
        setGraph(saved);
        setBaseline(signature(saved));
        queryClient.setQueryData(['launcher', 'communications', orgId], saved);
      }
    } catch (err) {
      setError(launcherError(err));
    } finally {
      setSaving(false);
      setFlowPhase('');
    }
  }

  return (
    <CommunicationsContext.Provider value={contextValue}>
      <div className={styles.editor}>
        <div className={styles.chrome}>
          {error ? (
            <div className={styles.alerts}>
              <InlineAlert variant="error">{error}</InlineAlert>
            </div>
          ) : null}
          <div className={styles.bar}>
            {flowPhase ? <p className={styles.flowPhase}>{flowPhase}</p> : null}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={steps.undo === 0}
              leftIcon={<IconArrowBackUp size={14} aria-hidden="true" />}
              onClick={undo}
            >
              Desfazer
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={steps.redo === 0}
              leftIcon={<IconArrowForwardUp size={14} aria-hidden="true" />}
              onClick={redo}
            >
              Refazer
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Abrir pasta da configuração"
              title="Abrir pasta da configuração"
              onClick={() => void openConfigDir()}
              style={{ width: 28, padding: 0 }}
              leftIcon={<IconFolder size={15} aria-hidden="true" />}
            />
            {needsSave ? (
              <Button type="button" variant="primary" size="sm" loading={saving} onClick={() => void save()}>
                Salvar
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={runningFlow}
                disabled={runningFlow}
                leftIcon={<IconPlayerPlay size={14} aria-hidden="true" />}
                onClick={() => void runFlow()}
              >
                Run flow
              </Button>
            )}
          </div>
        </div>
        <div className={styles.stage}>
          <div className={styles.canvas}>
            <FlowCanvas<FlowNode>
              className={styles.flow}
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onConnectEnd={onConnectEnd}
              isValidConnection={canConnect}
              connectionRadius={36}
              deleteKeyCode={['Backspace', 'Delete']}
              fitView={false}
              defaultViewport={{ x: 0, y: 0, zoom: 1 }}
              fill
              dragToSelect
              defaultEdgeOptions={{
                type: 'smoothstep',
                markerEnd: { type: MarkerType.ArrowClosed, width: 12, height: 12, color: 'context-stroke' },
              }}
              onPaneClick={() => {
                if (suppressPaneRef.current) return;
                setSelectedId(null);
                setPicker(null);
                setOpMenu(null);
              }}
              onPaneContextMenu={openPicker}
              onNodeClick={(_event, node) => {
                setSelectedId(node.id);
                setPicker(null);
                setOpMenu(null);
              }}
              onNodeContextMenu={(event, node) => {
                event.preventDefault();
                setSelectedId(node.id);
                setPicker(null);
                setOpMenu(null);
              }}
              empty={<p className={styles.emptyHint}>Clique com o botão direito para adicionar um app.</p>}
            />
            {picker ? (
              <div ref={pickerRef} className={styles.picker} style={anchorStyle(picker.x, picker.y)}>
                <SearchableListPanel
                  query={pickerQuery}
                  onQueryChange={setPickerQuery}
                  placeholder="Buscar app..."
                  emptyMessage="Nenhum app"
                  aria-label="Adicionar app"
                  items={pickerItems}
                  renderItem={(app) => (
                    <button type="button" className={styles.item} onClick={() => addApp(app)}>
                      <span className={styles.itemBody}>
                        <span className={styles.itemLabel}>{app.name}</span>
                        <span className={styles.itemDetail}>{app.repository}</span>
                      </span>
                    </button>
                  )}
                />
              </div>
            ) : null}
            {opMenu ? (
              <div ref={opMenuRef} className={styles.menu} style={anchorStyle(opMenu.x, opMenu.y)} role="menu" aria-label="Criar operação">
                {menuItems.map((item) => (
                  <button key={item.kind} type="button" role="menuitem" className={styles.item} onClick={() => chooseOp(item.kind)}>
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <SideDrawer
            modal={false}
            lockScroll={false}
            open={selected !== null}
            onClose={() => setSelectedId(null)}
            title={selected?.name || 'App'}
            ariaLabel={selected ? `Detalhes de ${selected.name || 'app'}` : 'Detalhes'}
            headerActions={
              selected && !opKind(selected.kind) && liveApp(apps, selected) ? (
                <SideDrawerIconButton
                  label="Abrir no Painel"
                  onClick={() => {
                    const live = liveApp(apps, selected);
                    if (live) navigate(appHref(live));
                  }}
                >
                  <IconExternalLink size={18} aria-hidden="true" />
                </SideDrawerIconButton>
              ) : null
            }
          >
            {selected ? (
              opKind(selected.kind) ? (
                <OpDetails
                  node={selected}
                  onStep={(step) => patchNode(selected.id, { step })}
                  onLiteral={(literal) => patchNode(selected.id, { literal })}
                />
              ) : (
                <NodeDetails node={selected} apps={apps} onAlwaysOn={(alwaysOn) => setAlwaysOn(selected.id, alwaysOn)} />
              )
            ) : null}
          </SideDrawer>
        </div>
        {prompt?.step === 'field' ? <FieldModal prompt={prompt} onPick={onFieldPicked} onClose={() => setPrompt(null)} /> : null}
        {prompt?.step === 'literal' ? (
          <LiteralModal initial={prompt.initial} onConfirm={confirmLiteral} onClose={() => setPrompt(null)} />
        ) : null}
      </div>
    </CommunicationsContext.Provider>
  );
}

export function CommunicationsPage() {
  const { activeOrg } = useOrg();
  const query = useQuery({
    queryKey: ['launcher', 'communications', activeOrg?.id],
    queryFn: communicationsGet,
    enabled: Boolean(activeOrg?.id),
  });

  if (!activeOrg) return null;
  if (query.isPending) {
    return (
      <div className={styles.editor}>
        <p className={styles.loading}>A carregar comunicações…</p>
      </div>
    );
  }
  if (query.isError || !query.data) {
    return (
      <div className={styles.editor}>
        <div className={styles.loading}>
          <InlineAlert variant="error">{launcherError(query.error)}</InlineAlert>
        </div>
      </div>
    );
  }

  return (
    <ReactFlowProvider>
      <CommunicationsCanvas key={activeOrg.id} orgId={activeOrg.id} initial={normalize(query.data)} />
    </ReactFlowProvider>
  );
}

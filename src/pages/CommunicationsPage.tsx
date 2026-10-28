import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
} from '@xyflow/react';
import { IconArrowBackUp, IconArrowForwardUp, IconFolder, IconPlayerPlay } from '@tabler/icons-react';
import { FlowCanvas } from '@/components/ui/FlowCanvas';
import { Button } from '@/components/ui/Button';
import { InlineAlert } from '@/components/ui/InlineAlert';
import { PreferenceToggleRow } from '@/components/ui/PreferenceToggleRow';
import { SearchableListPanel } from '@/components/ui/SearchableListPanel';
import { SideDrawer } from '@/components/ui/SideDrawer';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { TextLink } from '@/components/ui/TextLink';
import { useToast } from '@/components/ui/Toast';
import { LaunchConfigPanel } from '@/components/launcher/LaunchConfigForm';
import { useLibraryMutations } from '@/components/launcher/LibraryCard';
import { useOrg } from '@/contexts/OrgContext';
import {
  appHref,
  communicationsGet,
  communicationsOpenDir,
  communicationsSave,
  launcherError,
  libraryList,
  statusLabel,
  type AppView,
  type CommunicationNode,
  type CommunicationsGraph,
} from '@/lib/launcher-api';
import { cx } from '@/utils';
import styles from './communications.module.css';

type Graph = CommunicationsGraph;
type AppNodeData = { label: string; repository: string };
type AppFlowNode = Node<AppNodeData, 'app'>;

const HISTORY_LIMIT = 50;

function signature(graph: Graph): string {
  const nodes = graph.nodes
    .map((node) => `${node.id}\t${node.folderName}\t${node.repository}\t${node.name}\t${node.x}\t${node.y}\t${node.alwaysOn ? 1 : 0}`)
    .sort()
    .join('\n');
  const edges = graph.edges.map((edge) => `${edge.id}\t${edge.source}\t${edge.target}`).sort().join('\n');
  return `${nodes}\n--\n${edges}`;
}

function normalize(graph: CommunicationsGraph): Graph {
  return {
    nodes: (graph.nodes ?? []).map((node) => ({ ...node, alwaysOn: Boolean(node.alwaysOn) })),
    edges: graph.edges ?? [],
  };
}

function toFlow(graph: Graph, selectedId: string | null): AppFlowNode[] {
  return graph.nodes.map((node) => ({
    id: node.id,
    type: 'app',
    position: { x: node.x, y: node.y },
    selected: node.id === selectedId,
    data: { label: node.name || 'App', repository: node.repository },
  }));
}

function toEdges(graph: Graph): Edge[] {
  return graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'smoothstep',
  }));
}

function mergeNodes(next: AppFlowNode[], previous: AppFlowNode[]): AppFlowNode[] {
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

function AppNode({ data, selected }: NodeProps<AppFlowNode>) {
  return (
    <div className={cx(styles.node, selected && styles.nodeSelected)}>
      <Handle type="target" position={Position.Left} />
      <div className={styles.nodeBody}>
        <div className={styles.nodeTitle}>{data.label}</div>
        <div className={styles.nodeMeta}>{data.repository || 'Sem repositório'}</div>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = { app: AppNode };

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
        {live ? <TextLink href={appHref(live)}>Abrir no Painel</TextLink> : null}
      </dl>
      {installed && live ? <LaunchConfigPanel app={live} /> : null}
      {live && !installed ? (
        <p className={styles.missing}>Os campos do Executável aparecem depois da instalação. O Run flow instala esta app.</p>
      ) : null}
    </div>
  );
}

function CommunicationsCanvas({ orgId, initial }: { orgId: string; initial: Graph }) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const mutations = useLibraryMutations();
  const { screenToFlowPosition, fitView } = useReactFlow();
  const library = useQuery({
    queryKey: ['launcher', 'library', orgId],
    queryFn: libraryList,
  });
  const apps = library.data?.apps ?? [];
  const [graph, setGraph] = useState(initial);
  const [baseline, setBaseline] = useState(() => signature(initial));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nodes, setNodes] = useState(() => toFlow(initial, null));
  const [edges, setEdges] = useState(() => toEdges(initial));
  const [picker, setPicker] = useState<{ x: number; y: number; flowX: number; flowY: number } | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [runningFlow, setRunningFlow] = useState(false);
  const [flowPhase, setFlowPhase] = useState('');
  const [error, setError] = useState('');
  const [steps, setSteps] = useState({ undo: 0, redo: 0 });
  const graphRef = useRef(graph);
  const pastRef = useRef<Graph[]>([]);
  const futureRef = useRef<Graph[]>([]);
  const pendingRef = useRef<Graph | null>(null);
  const queuedRef = useRef(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const fitOnce = useRef(initial.nodes.length > 0);
  graphRef.current = graph;

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
    if (!picker) return;
    function onPointer(event: MouseEvent) {
      if (pickerRef.current?.contains(event.target as globalThis.Node)) return;
      setPicker(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setPicker(null);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [picker]);

  const selected = graph.nodes.find((node) => node.id === selectedId) ?? null;
  const dirty = signature(graph) !== baseline;
  const term = fold(pickerQuery.trim());
  const pickerItems = apps.filter((app) => !term || fold(`${app.name} ${app.repository} ${app.folderName}`).includes(term));

  function openPicker(event: { clientX: number; clientY: number; preventDefault: () => void }) {
    event.preventDefault();
    const flow = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    setSelectedId(null);
    setPickerQuery('');
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
    return !graphRef.current.edges.some((edge) => edge.source === connection.source && edge.target === connection.target);
  }

  function onConnect(connection: Connection) {
    if (!connection.source || !connection.target || !canConnect(connection)) return;
    commit({
      ...graphRef.current,
      edges: [
        ...graphRef.current.edges,
        { id: crypto.randomUUID(), source: connection.source, target: connection.target },
      ],
    });
    setPicker(null);
  }

  function onNodesChange(changes: NodeChange<AppFlowNode>[]) {
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
    queueCommit((current) => {
      let nextNodes = current.nodes.map((node) => {
        const move = moved.find((item) => item.id === node.id);
        return move ? { ...node, x: Math.round(move.x), y: Math.round(move.y) } : node;
      });
      let nextEdges = current.edges;
      if (removed.length > 0) {
        const drop = new Set(removed);
        nextNodes = nextNodes.filter((node) => !drop.has(node.id));
        nextEdges = nextEdges.filter((edge) => !drop.has(edge.source) && !drop.has(edge.target));
      }
      return { nodes: nextNodes, edges: nextEdges };
    });
  }

  function onEdgesChange(changes: EdgeChange[]) {
    setEdges((current) => applyEdgeChanges(changes, current));
    const removed = changes.filter((change) => change.type === 'remove').map((change) => change.id);
    if (removed.length === 0) return;
    const drop = new Set(removed);
    queueCommit((current) => ({
      ...current,
      edges: current.edges.filter((edge) => !drop.has(edge.id)),
    }));
  }

  function setAlwaysOn(id: string, alwaysOn: boolean) {
    commit({
      ...graphRef.current,
      nodes: graphRef.current.nodes.map((node) => (node.id === id ? { ...node, alwaysOn } : node)),
    });
  }

  async function runFlow() {
    if (runningFlow) return;
    const enabled = graphRef.current.nodes.filter((node) => node.alwaysOn);
    if (enabled.length === 0) {
      setError('Nenhuma app marcada como sempre ligada.');
      return;
    }
    setRunningFlow(true);
    setError('');
    const seen = new Set<string>();
    try {
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

  async function save() {
    if (!dirty || saving) return;
    setSaving(true);
    setError('');
    try {
      const saved = normalize(await communicationsSave(graphRef.current));
      graphRef.current = saved;
      setGraph(saved);
      setBaseline(signature(saved));
      queryClient.setQueryData(['launcher', 'communications', orgId], saved);
    } catch (err) {
      setError(launcherError(err));
    } finally {
      setSaving(false);
    }
  }

  const pickerStyle = picker
    ? {
        left: Math.max(8, Math.min(picker.x, window.innerWidth - 300)),
        top: Math.max(8, Math.min(picker.y, window.innerHeight - 280)),
      }
    : undefined;

  return (
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
          {dirty ? (
            <Button type="button" variant="primary" size="sm" loading={saving} onClick={() => void save()}>
              Salvar
            </Button>
          ) : null}
        </div>
      </div>
      <div className={styles.stage}>
        <div className={styles.canvas}>
          <FlowCanvas<AppFlowNode>
            className={styles.flow}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            isValidConnection={canConnect}
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
              setSelectedId(null);
              setPicker(null);
            }}
            onPaneContextMenu={openPicker}
            onNodeClick={(_event, node) => {
              setSelectedId(node.id);
              setPicker(null);
            }}
            onNodeContextMenu={(event, node) => {
              event.preventDefault();
              setSelectedId(node.id);
              setPicker(null);
            }}
            empty={<p className={styles.emptyHint}>Clique com o botão direito para adicionar um app.</p>}
          />
          {picker ? (
            <div ref={pickerRef} className={styles.picker} style={pickerStyle}>
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
        </div>
        <SideDrawer
          modal={false}
          lockScroll={false}
          open={selected !== null}
          onClose={() => setSelectedId(null)}
          title={selected?.name || 'App'}
          ariaLabel={selected ? `Detalhes de ${selected.name || 'app'}` : 'Detalhes'}
        >
          {selected ? <NodeDetails node={selected} apps={apps} onAlwaysOn={(alwaysOn) => setAlwaysOn(selected.id, alwaysOn)} /> : null}
        </SideDrawer>
      </div>
    </div>
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

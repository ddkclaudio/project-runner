'use client';

import React from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  Panel,
  BackgroundVariant,
  SelectionMode,
  useViewport,
  type Node,
  type Edge,
  type NodeTypes,
  type EdgeTypes,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type OnConnectEnd,
  type FitViewOptions,
  type DefaultEdgeOptions,
  type IsValidConnection,
  type OnMoveEnd,
  type Viewport,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Skeleton } from '@/components/ui/Skeleton';
import { useMinimumLoading } from '@/hooks/useMinimumLoading';
import { cx } from '@/utils';
import styles from './FlowCanvas.module.css';

function ZoomLabel() {
  const { zoom } = useViewport();
  return (
    <Panel position="bottom-right">
      <div className={styles.zoomLabel}>{Math.round(zoom * 100)}%</div>
    </Panel>
  );
}

const DEFAULT_FIT: FitViewOptions = { padding: 0.4 };
/** Botão do meio move a tela; o direito fica livre para o menu de contexto. */
const DRAG_TO_SELECT = {
  selectionOnDrag: true,
  panOnDrag: [1],
  panActivationKeyCode: 'Space',
  selectionMode: SelectionMode.Partial,
  multiSelectionKeyCode: ['Control', 'Meta'],
};
const DEFAULT_EDGE: DefaultEdgeOptions = {
  style: { stroke: 'var(--edge-stroke)', strokeWidth: 2 },
  type: 'smoothstep',
};

export interface FlowCanvasProps<N extends Node = Node> {
  nodes: N[];
  edges: Edge[];
  onNodesChange?: OnNodesChange<N>;
  onEdgesChange?: OnEdgesChange;
  onConnect?: OnConnect;
  onConnectEnd?: OnConnectEnd;
  onNodeClick?: (event: React.MouseEvent, node: N) => void;
  onPaneClick?: (event: React.MouseEvent) => void;
  onPaneContextMenu?: (event: MouseEvent | React.MouseEvent<Element, MouseEvent>) => void;
  onNodeContextMenu?: (event: React.MouseEvent, node: N) => void;
  /** Teclas que removem a seleção (padrão do React Flow: Backspace). */
  deleteKeyCode?: string | string[] | null;
  /** Recusa ligações (ao arrastar entre handles) quando retorna false. */
  isValidConnection?: IsValidConnection;
  nodeTypes?: NodeTypes;
  edgeTypes?: EdgeTypes;
  fitView?: boolean;
  fitViewOptions?: FitViewOptions;
  /** Pan e zoom iniciais quando `fitView` é false. */
  defaultViewport?: Viewport;
  /** Chamado ao terminar de mover ou dar zoom. */
  onMoveEnd?: OnMoveEnd;
  defaultEdgeOptions?: DefaultEdgeOptions;
  /** Botões extras dentro de `<Controls>` (ex.: auto-layout). */
  controlButtons?: React.ReactNode;
  /** Conteúdo quando não há nodes. */
  empty?: React.ReactNode;
  /** Painéis / elementos extras dentro do ReactFlow. */
  children?: React.ReactNode;
  showZoomLabel?: boolean;
  showControls?: boolean;
  showBackground?: boolean;
  /** Preenche o container pai com position absolute. */
  fill?: boolean;
  /**
   * Arrastar no fundo desenha a caixa de seleção (estilo Figma); a tela se move com o botão
   * do meio ou Espaço + arrastar, e Ctrl/Cmd + clique soma nodes à seleção.
   */
  dragToSelect?: boolean;
  /** When true, shows fluid skeleton (holds ~500ms via useMinimumLoading) */
  loading?: boolean;
  /** Distância, em coordenadas do fluxo, em que soltar perto de um handle ainda liga. */
  connectionRadius?: number;
  className?: string;
}

export function FlowCanvas<N extends Node = Node>({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onConnectEnd,
  onNodeClick,
  onPaneClick,
  onPaneContextMenu,
  onNodeContextMenu,
  deleteKeyCode,
  isValidConnection,
  nodeTypes,
  edgeTypes,
  fitView = true,
  fitViewOptions = DEFAULT_FIT,
  defaultViewport,
  onMoveEnd,
  defaultEdgeOptions = DEFAULT_EDGE,
  controlButtons,
  empty,
  children,
  showZoomLabel = true,
  showControls = true,
  showBackground = true,
  fill = false,
  dragToSelect = false,
  loading = false,
  connectionRadius,
  className,
}: FlowCanvasProps<N>) {
  const showSkeleton = useMinimumLoading(loading);

  if (showSkeleton) {
    return (
      <div
        className={cx(styles.canvas, fill && styles.canvasFill, styles.canvasLoading, className)}
        role="status"
        aria-busy="true"
        aria-label="Carregando diagrama"
      >
        <Skeleton.Fluid className={styles.skeleton} />
      </div>
    );
  }

  return (
    <div className={cx(styles.canvas, fill && styles.canvasFill, className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onConnectEnd={onConnectEnd}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        {...(deleteKeyCode !== undefined && { deleteKeyCode })}
        isValidConnection={isValidConnection}
        {...(connectionRadius !== undefined && { connectionRadius })}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        selectNodesOnDrag={false}
        nodesFocusable={false}
        zoomOnPinch
        {...(dragToSelect ? DRAG_TO_SELECT : { panOnDrag: true })}
        zoomOnScroll
        fitView={fitView}
        fitViewOptions={fitViewOptions}
        {...(defaultViewport && { defaultViewport })}
        onMoveEnd={onMoveEnd}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={defaultEdgeOptions}
      >
        {showBackground && (
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1.5}
            color="var(--canvas-dot)"
          />
        )}
        {showControls && (
          <Controls showInteractive={false} position="bottom-left">
            {controlButtons}
          </Controls>
        )}
        {showZoomLabel && <ZoomLabel />}
        {children}
      </ReactFlow>

      {nodes.length === 0 && empty && <div className={styles.empty}>{empty}</div>}
    </div>
  );
}

/** Atalho para demos: provider + canvas com altura fixa. */
export function FlowCanvasDemo<N extends Node = Node>({
  height = 360,
  ...props
}: FlowCanvasProps<N> & { height?: number | string }) {
  return (
    <ReactFlowProvider>
      <div style={{ height, width: '100%' }}>
        <FlowCanvas<N> {...props} />
      </div>
    </ReactFlowProvider>
  );
}

'use client';

import { useCallback } from 'react';
import {
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
} from '@xyflow/react';
import { FlowCanvasDemo } from './FlowCanvas';

const DEMO_NODES: Node[] = [
  { id: '1', position: { x: 120, y: 20 }, data: { label: 'Orquestrador' } },
  { id: '2', position: { x: 20, y: 140 }, data: { label: 'Especialista A' } },
  { id: '3', position: { x: 220, y: 140 }, data: { label: 'Especialista B' } },
];

const DEMO_EDGES: Edge[] = [
  { id: 'e1-2', source: '1', target: '2', type: 'smoothstep' },
  { id: 'e1-3', source: '1', target: '3', type: 'smoothstep' },
];

export function FlowCanvasCatalogDemo() {
  const [nodes, , onNodesChange] = useNodesState(DEMO_NODES);
  const [edges, setEdges, onEdgesChange] = useEdgesState(DEMO_EDGES);

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdges((eds) => addEdge({ ...connection, type: 'smoothstep' }, eds)),
    [setEdges],
  );

  return (
    <FlowCanvasDemo
      height={380}
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
    />
  );
}

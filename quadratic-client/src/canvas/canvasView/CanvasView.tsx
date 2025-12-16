import {
  canvasAtom,
  canvasEdgesAtom,
  canvasNodesAtom,
  canvasSelectedNodeIdAtom,
  updateNodePositions,
} from '@/canvas/atoms/canvasAtom';
import { edgeTypes } from '@/canvas/canvasView/edges/edgeTypes';
import { nodeTypes } from '@/canvas/canvasView/nodes/nodeTypes';
import { TableIcon } from '@/shared/components/Icons';
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type OnSelectionChangeFunc,
  type Node,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './canvasView.css';
import { useCallback, useEffect, useRef } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';

export function CanvasView() {
  const [recoilNodes] = useRecoilState(canvasNodesAtom);
  const [recoilEdges] = useRecoilState(canvasEdgesAtom);
  const setSelectedNodeId = useSetRecoilState(canvasSelectedNodeIdAtom);
  const setRecoilState = useSetRecoilState(canvasAtom);

  const [nodes, setNodes, onNodesChange] = useNodesState(recoilNodes as any);
  const [edges, setEdges, onEdgesChange] = useEdgesState(recoilEdges as any);
  const { fitView } = useReactFlow();

  // Track if we're currently dragging to avoid unnecessary state updates
  const isDraggingRef = useRef(false);

  // Sync recoil state with local state (skip during drag to avoid conflicts)
  useEffect(() => {
    if (isDraggingRef.current) return;
    setNodes(recoilNodes as any);
    // Auto-fit view when nodes change (only on actual node count changes, not position changes)
  }, [recoilNodes, setNodes]);

  // Auto-fit view when node count changes
  const prevNodeCountRef = useRef(0);
  useEffect(() => {
    if (recoilNodes.length !== prevNodeCountRef.current && recoilNodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 100);
    }
    prevNodeCountRef.current = recoilNodes.length;
  }, [recoilNodes.length, fitView]);

  useEffect(() => {
    // Add marker end to all edges and set animation based on target node execution state
    const edgesWithMarkers = recoilEdges.map((edge) => {
      // Find the target node to check if it's running
      const targetNode = recoilNodes.find((n) => n.id === edge.target);
      // Only code nodes have executionState
      const isTargetRunning =
        targetNode?.data?.nodeType === 'code' &&
        (targetNode.data as { executionState?: string }).executionState === 'running';

      return {
        ...edge,
        animated: isTargetRunning, // Only animate when target is running
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color: '#94a3b8',
        },
      };
    });
    setEdges(edgesWithMarkers);
  }, [recoilEdges, recoilNodes, setEdges]);

  const onSelectionChange: OnSelectionChangeFunc = useCallback(
    ({ nodes: selectedNodes }) => {
      if (selectedNodes.length === 1) {
        setSelectedNodeId(selectedNodes[0].id);
      } else {
        setSelectedNodeId(null);
      }
    },
    [setSelectedNodeId]
  );

  // Handle node drag start
  const onNodeDragStart = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  // Handle node drag stop - sync positions back to recoil state
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, _node: Node, draggedNodes: Node[]) => {
      isDraggingRef.current = false;

      // Collect position updates for all dragged nodes
      const positionUpdates = draggedNodes.map((n) => ({
        id: n.id,
        position: n.position,
      }));

      // Update recoil state with new positions
      setRecoilState((prev) => ({
        ...prev,
        nodes: updateNodePositions(prev, positionUpdates),
      }));
    },
    [setRecoilState]
  );

  const proOptions = { hideAttribution: true };

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={onSelectionChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        proOptions={proOptions}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        defaultEdgeOptions={{
          type: 'dependency',
          animated: false, // Animation is controlled per-edge based on execution state
        }}
        // Enable node dragging for manual rearrangement
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        selectNodesOnDrag={false}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
        <Controls showInteractive={false} />

        {/* Empty state */}
        {nodes.length === 0 && <EmptyCanvasState />}
      </ReactFlow>
    </div>
  );
}

function EmptyCanvasState() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="pointer-events-auto rounded-lg border border-dashed border-border bg-background/90 p-8 text-center backdrop-blur-sm">
        <div className="mb-3 flex justify-center">
          <TableIcon className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="mb-1 font-semibold text-foreground">Your canvas is empty</h3>
        <p className="text-sm text-muted-foreground">Use the chat to describe what you want to build.</p>
      </div>
    </div>
  );
}

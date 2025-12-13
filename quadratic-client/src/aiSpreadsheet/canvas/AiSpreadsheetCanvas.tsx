import {
  aiSpreadsheetEdgesAtom,
  aiSpreadsheetNodesAtom,
  aiSpreadsheetSelectedNodeIdAtom,
} from '@/aiSpreadsheet/atoms/aiSpreadsheetAtom';
import { edgeTypes } from '@/aiSpreadsheet/canvas/edges/edgeTypes';
import { nodeTypes } from '@/aiSpreadsheet/canvas/nodes/nodeTypes';
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
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import './aiSpreadsheetCanvas.css';
import { useCallback, useEffect } from 'react';
import { useRecoilState, useSetRecoilState } from 'recoil';

export function AiSpreadsheetCanvas() {
  const [recoilNodes] = useRecoilState(aiSpreadsheetNodesAtom);
  const [recoilEdges] = useRecoilState(aiSpreadsheetEdgesAtom);
  const setSelectedNodeId = useSetRecoilState(aiSpreadsheetSelectedNodeIdAtom);

  const [nodes, setNodes, onNodesChange] = useNodesState(recoilNodes as any);
  const [edges, setEdges, onEdgesChange] = useEdgesState(recoilEdges as any);
  const { fitView } = useReactFlow();

  // Sync recoil state with local state
  useEffect(() => {
    setNodes(recoilNodes as any);
    // Auto-fit view when nodes change
    if (recoilNodes.length > 0) {
      setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 100);
    }
  }, [recoilNodes, setNodes, fitView]);

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

  const proOptions = { hideAttribution: true };

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onSelectionChange={onSelectionChange}
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
        // Disable editing - this is view-only
        nodesDraggable={false}
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
        <h3 className="mb-1 font-semibold text-foreground">Your spreadsheet is empty</h3>
        <p className="text-sm text-muted-foreground">Use the chat to describe what you want to build.</p>
      </div>
    </div>
  );
}

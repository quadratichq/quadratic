import type { CanvasNodeData } from '@/canvas/types';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { TableIcon, DataObjectIcon, CodeIcon } from '@/shared/components/Icons';

export function OutputNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as CanvasNodeData;

  const getIcon = () => {
    switch (nodeData.nodeType) {
      case 'table':
        return <TableIcon size="sm" />;
      case 'chart':
        return <DataObjectIcon size="sm" />;
      case 'htmlOutput':
        return <CodeIcon size="sm" />;
      default:
        return null;
    }
  };

  const getSubtitle = () => {
    switch (nodeData.nodeType) {
      case 'table':
        return `${nodeData.columns.length} cols × ${nodeData.totalRows ?? nodeData.rows.length} rows`;
      case 'chart':
        return `${nodeData.chartType} chart`;
      case 'htmlOutput':
        return 'HTML Output';
      default:
        return '';
    }
  };

  return (
    <div
      className={`min-w-[280px] rounded-lg border-2 bg-pink-50 shadow-md transition-shadow ${
        selected ? 'border-pink-600 shadow-lg ring-2 ring-pink-300' : 'border-pink-400'
      }`}
    >
      {/* Input handle on the left */}
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-pink-600 !bg-pink-400" />

      <div className="flex items-center gap-2 rounded-t-md bg-pink-500 px-3 py-2 text-white">
        {getIcon()}
        <span className="font-semibold">{nodeData.label}</span>
      </div>
      <div className="px-3 py-2 text-xs text-pink-700">{getSubtitle()}</div>
    </div>
  );
}

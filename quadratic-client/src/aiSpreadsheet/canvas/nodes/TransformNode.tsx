import type { AiSpreadsheetNodeData } from '@/aiSpreadsheet/types';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { FunctionIcon, CodeIcon } from '@/shared/components/Icons';

export function TransformNode({ data, selected }: NodeProps) {
  const nodeData = data as unknown as AiSpreadsheetNodeData;

  const getIcon = () => {
    switch (nodeData.nodeType) {
      case 'formula':
        return <FunctionIcon size="sm" />;
      case 'code':
        return <CodeIcon size="sm" />;
      default:
        return null;
    }
  };

  const getSubtitle = () => {
    switch (nodeData.nodeType) {
      case 'formula':
        return 'Formula';
      case 'code':
        return nodeData.language === 'python' ? 'Python' : 'JavaScript';
      default:
        return '';
    }
  };

  const getPreview = () => {
    if (nodeData.nodeType === 'formula') {
      return nodeData.formula.length > 30 ? nodeData.formula.slice(0, 30) + '...' : nodeData.formula;
    }
    if (nodeData.nodeType === 'code') {
      const firstLine = nodeData.code.split('\n')[0];
      return firstLine.length > 30 ? firstLine.slice(0, 30) + '...' : firstLine;
    }
    return '';
  };

  return (
    <div
      className={`min-w-40 rounded-lg border-2 bg-blue-50 shadow-md transition-shadow ${
        selected ? 'border-blue-600 shadow-lg ring-2 ring-blue-300' : 'border-blue-400'
      }`}
    >
      {/* Input handle on the left */}
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !border-2 !border-blue-600 !bg-blue-400" />

      <div className="flex items-center gap-2 rounded-t-md bg-blue-500 px-3 py-2 text-white">
        {getIcon()}
        <span className="font-semibold">{nodeData.label}</span>
      </div>
      <div className="px-3 py-2">
        <div className="text-xs text-blue-600">{getSubtitle()}</div>
        {getPreview() && <div className="mt-1 truncate font-mono text-xs text-blue-800">{getPreview()}</div>}
      </div>

      {/* Output handle on the right */}
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !border-2 !border-blue-600 !bg-blue-400" />
    </div>
  );
}

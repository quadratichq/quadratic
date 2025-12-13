import type { CodeNodeData, CodeExecutionResult } from '@/aiSpreadsheet/types';
import { useExecution } from '@/aiSpreadsheet/execution/ExecutionContext';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { FunctionIcon, CodeIcon, RefreshIcon } from '@/shared/components/Icons';
import { useState, useCallback } from 'react';

// Result display component
function ResultDisplay({ result }: { result: CodeExecutionResult }) {
  if (result.type === 'error') {
    return (
      <div className="mt-2 rounded border border-red-300 bg-red-50 p-2">
        <div className="text-xs font-medium text-red-700">Error</div>
        <div className="mt-1 font-mono text-xs text-red-600">{result.error}</div>
      </div>
    );
  }

  if (result.type === 'value') {
    return (
      <div className="mt-2 rounded border border-emerald-300 bg-emerald-50 p-2">
        <div className="text-xs font-medium text-emerald-700">Result</div>
        <div className="mt-1 font-mono text-sm font-semibold text-emerald-800">{String(result.value)}</div>
      </div>
    );
  }

  if (result.type === 'table' && result.columns && result.rows) {
    return (
      <div className="mt-2 max-h-96 overflow-auto rounded border border-emerald-300 bg-white">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-emerald-100">
            <tr>
              {result.columns.map((col, i) => (
                <th key={i} className="px-2 py-1 text-left font-medium text-emerald-800">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-emerald-50/50'}>
                {row.map((cell, j) => (
                  <td key={j} className="px-2 py-1 text-slate-700">
                    {String(cell ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (result.type === 'html' && result.htmlContent) {
    return (
      <div className="mt-2 overflow-hidden rounded border border-purple-300 bg-white">
        <div className="max-h-48 overflow-auto p-2" dangerouslySetInnerHTML={{ __html: result.htmlContent }} />
      </div>
    );
  }

  if (result.type === 'chart' && result.htmlContent) {
    return (
      <div className="mt-2 overflow-hidden rounded border border-purple-300 bg-white">
        <div className="chart-container" dangerouslySetInnerHTML={{ __html: result.htmlContent }} />
      </div>
    );
  }

  return null;
}

// Helper to get handle color class
function getHandleColorClass(hasError: boolean, hasResult: boolean): string {
  if (hasError) return '!border-red-600 !bg-red-400';
  if (hasResult) return '!border-emerald-600 !bg-emerald-400';
  return '!border-blue-600 !bg-blue-400';
}

export function TransformNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as CodeNodeData;
  const { executeCodeNode } = useExecution();
  const [showCode, setShowCode] = useState(false);

  const handleRerun = (e: React.MouseEvent) => {
    e.stopPropagation();
    executeCodeNode(id);
  };

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowCode((prev) => !prev);
  }, []);

  // Only handle code nodes (formula nodes are skipped for now)
  if (nodeData.nodeType !== 'code') {
    return (
      <div
        className={`relative min-w-[280px] rounded-lg border-2 bg-slate-50 shadow-md ${
          selected ? 'border-slate-600 shadow-lg ring-2 ring-slate-300' : 'border-slate-400'
        }`}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="!h-3 !w-3 !border-2 !border-slate-600 !bg-slate-400"
        />
        <div className="flex items-center gap-2 rounded-t-md bg-slate-500 px-3 py-2 text-white">
          <FunctionIcon size="sm" />
          <span className="font-semibold">{nodeData.label}</span>
        </div>
        <div className="px-3 py-2 text-xs text-slate-600">Formula (coming soon)</div>
        <Handle
          type="source"
          position={Position.Right}
          className="!h-3 !w-3 !border-2 !border-slate-600 !bg-slate-400"
        />
      </div>
    );
  }

  const getCodePreview = () => {
    const lines = nodeData.code.split('\n').slice(0, 3);
    return lines.map((line) => (line.length > 40 ? line.slice(0, 40) + '...' : line)).join('\n');
  };

  const isRunning = nodeData.executionState === 'running';
  const hasResult = nodeData.result !== undefined;
  const hasError = nodeData.executionState === 'error';

  // Determine border color based on state
  let borderClass = 'border-blue-400';
  let headerBgClass = 'bg-blue-500';
  if (selected) {
    borderClass = 'border-blue-600 ring-2 ring-blue-300';
  }
  if (hasError) {
    borderClass = selected ? 'border-red-600 ring-2 ring-red-300' : 'border-red-400';
    headerBgClass = 'bg-red-500';
  } else if (hasResult && nodeData.result?.type !== 'error') {
    borderClass = selected ? 'border-emerald-600 ring-2 ring-emerald-300' : 'border-emerald-400';
    headerBgClass = 'bg-emerald-500';
  }

  const handleColorClass = getHandleColorClass(hasError, hasResult && nodeData.result?.type !== 'error');

  return (
    <div className={`relative min-w-[280px] rounded-lg border-2 bg-white shadow-md transition-all ${borderClass}`}>
      {/* Input handle on the left */}
      <Handle type="target" position={Position.Left} className={`!h-3 !w-3 !border-2 ${handleColorClass}`} />

      {/* Header */}
      <div className={`flex items-center gap-2 rounded-t-md px-3 py-2 text-white ${headerBgClass}`}>
        <CodeIcon size="sm" />
        <span className="font-semibold">{nodeData.label}</span>
        {isRunning && (
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 animate-spin rounded-full border-2 border-white border-t-transparent" />
            <span className="text-xs opacity-90">Running...</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={handleRerun}
            disabled={isRunning}
            className="rounded p-1 transition-colors hover:bg-white/20 disabled:opacity-50"
            title="Re-run code"
          >
            <RefreshIcon className="h-3.5 w-3.5" />
          </button>
          <span className="rounded bg-white/20 px-1.5 py-0.5 text-xs">
            {nodeData.language === 'python' ? 'Python' : 'JS'}
          </span>
        </div>
      </div>

      {/* Description or Code preview - double-click to toggle */}
      <div
        className="cursor-pointer border-b border-slate-200 bg-slate-50 px-3 py-2"
        onDoubleClick={handleDoubleClick}
        title={showCode ? 'Double-click to show description' : 'Double-click to show code'}
      >
        {showCode ? (
          <pre className="overflow-hidden font-mono text-xs text-slate-700">{getCodePreview()}</pre>
        ) : nodeData.description ? (
          <p className="text-sm leading-relaxed text-slate-700">{nodeData.description}</p>
        ) : (
          <pre className="overflow-hidden font-mono text-xs text-slate-700">{getCodePreview()}</pre>
        )}
      </div>

      {/* Execution state and result */}
      <div className="px-3 py-2">
        {hasResult && nodeData.result && <ResultDisplay result={nodeData.result} />}
        {!hasResult && !isRunning && <div className="text-xs italic text-slate-400">Not yet executed</div>}
        {nodeData.result?.stdout && (
          <div className="mt-2 rounded border border-slate-200 bg-slate-50 p-2">
            <div className="text-xs font-medium text-slate-500">Console</div>
            <pre className="mt-1 font-mono text-xs text-slate-600">{nodeData.result.stdout}</pre>
          </div>
        )}
      </div>

      {/* Output handle on the right */}
      <Handle type="source" position={Position.Right} className={`!h-3 !w-3 !border-2 ${handleColorClass}`} />
    </div>
  );
}

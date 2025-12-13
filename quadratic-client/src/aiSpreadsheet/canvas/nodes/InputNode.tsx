import type { AiSpreadsheetNodeData } from '@/aiSpreadsheet/types';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { DatabaseIcon, FileIcon, SearchIcon, CodeIcon } from '@/shared/components/Icons';
import { useCallback, useEffect, useRef, useState } from 'react';

export function InputNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as AiSpreadsheetNodeData;
  const { setNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const getIcon = () => {
    switch (nodeData.nodeType) {
      case 'connection':
        return <DatabaseIcon className="h-3 w-3" />;
      case 'file':
        return <FileIcon className="h-3 w-3" />;
      case 'webSearch':
        return <SearchIcon className="h-3 w-3" />;
      case 'html':
        return <CodeIcon className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getCellValue = () => {
    switch (nodeData.nodeType) {
      case 'connection':
        return nodeData.query || 'SQL Query';
      case 'file':
        return nodeData.fileName || 'file.csv';
      case 'webSearch':
        return nodeData.query || 'Search...';
      case 'html':
        return 'HTML';
      case 'cell':
        return nodeData.value || '';
      default:
        return '';
    }
  };

  const icon = getIcon();
  const value = getCellValue();

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      setEditValue(value);
      setIsEditing(true);
    },
    [value]
  );

  const handleSave = useCallback(() => {
    setIsEditing(false);
    // Update the node data based on node type
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === id) {
          // Determine which property to update based on node type
          let updateKey = 'value';
          if (nodeData.nodeType === 'connection' || nodeData.nodeType === 'webSearch') {
            updateKey = 'query';
          } else if (nodeData.nodeType === 'file') {
            updateKey = 'fileName';
          }
          return {
            ...node,
            data: { ...node.data, [updateKey]: editValue },
          };
        }
        return node;
      })
    );
  }, [id, nodeData.nodeType, editValue, setNodes]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        handleSave();
      } else if (e.key === 'Escape') {
        setIsEditing(false);
      }
    },
    [handleSave]
  );

  const headerClasses = selected
    ? 'border-amber-400 bg-amber-100 text-amber-800'
    : 'border-slate-300 bg-slate-100 text-slate-600';
  const cellClasses = selected ? 'border-amber-400 ring-2 ring-amber-200' : 'border-slate-300';
  const handleClasses = selected ? '!border-amber-500 !bg-amber-400' : '!border-slate-400 !bg-slate-300';
  const displayValue = value.length > 20 ? value.substring(0, 20) + '...' : value;

  return (
    <div className={`group min-w-[140px] transition-all ${selected ? 'scale-105' : ''}`}>
      {/* Cell name header - looks like spreadsheet column/row header */}
      <div
        className={`flex items-center gap-1.5 border-b px-2 py-1 text-[10px] font-medium uppercase tracking-wide ${headerClasses}`}
        style={{ borderTopLeftRadius: '4px', borderTopRightRadius: '4px' }}
      >
        {icon}
        <span className="truncate">{nodeData.label}</span>
      </div>

      {/* Cell value area - looks like a spreadsheet cell */}
      {/* nodrag nowheel nopan classes prevent React Flow from capturing events */}
      <div
        className={`nodrag nowheel nopan border-x border-b bg-white px-2 py-2 font-mono text-sm ${cellClasses} ${!isEditing ? 'cursor-text' : ''}`}
        style={{ borderBottomLeftRadius: '4px', borderBottomRightRadius: '4px', minHeight: '32px' }}
        onDoubleClick={handleDoubleClick}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editValue}
            onChange={(e) => {
              e.stopPropagation();
              setEditValue(e.target.value);
            }}
            onBlur={handleSave}
            onKeyDown={handleKeyDown}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="nodrag nowheel nopan w-full bg-transparent font-mono text-sm text-slate-800 outline-none"
            style={{ minWidth: '100px' }}
          />
        ) : (
          <span className="text-slate-800">{displayValue}</span>
        )}
      </div>

      {/* Output handle on the right */}
      <Handle
        type="source"
        position={Position.Right}
        className={`!h-2.5 !w-2.5 !rounded-full !border-2 transition-colors ${handleClasses}`}
      />
    </div>
  );
}

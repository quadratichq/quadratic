import type { BaseInputNodeData } from '@/canvas/types';
import { canvasAtom } from '@/canvas/atoms/canvasAtom';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { DatabaseIcon, FileIcon, SearchIcon, CodeIcon } from '@/shared/components/Icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSetRecoilState } from 'recoil';

// Type guard for input nodes with name field
type InputNodeData = BaseInputNodeData & {
  value?: string;
  query?: string;
  fileName?: string;
};

export function InputNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as InputNodeData;
  const { setNodes } = useReactFlow();
  const setRecoilState = useSetRecoilState(canvasAtom);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Check if value is numeric for right-alignment
  const isNumeric = (val: string) => {
    if (!val) return false;
    const num = parseFloat(val);
    return !isNaN(num) && isFinite(num);
  };

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
    // Determine which property to update based on node type
    let updateKey = 'value';
    if (nodeData.nodeType === 'connection' || nodeData.nodeType === 'webSearch') {
      updateKey = 'query';
    } else if (nodeData.nodeType === 'file') {
      updateKey = 'fileName';
    }

    // Update React Flow local state
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: { ...node.data, [updateKey]: editValue },
          };
        }
        return node;
      })
    );

    // Also update Recoil state to trigger execution engine
    setRecoilState((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) => {
        if (node.id === id) {
          return {
            ...node,
            data: { ...node.data, [updateKey]: editValue },
          };
        }
        return node;
      }),
    }));
  }, [id, nodeData.nodeType, editValue, setNodes, setRecoilState]);

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
    <div className={`group relative min-w-[160px] transition-all ${selected ? 'scale-105' : ''}`}>
      {/* Cell name header */}
      <div
        className={`flex items-center gap-1.5 border-b px-2 py-1 ${headerClasses}`}
        style={{ borderTopLeftRadius: '4px', borderTopRightRadius: '4px' }}
      >
        {icon}
        <span className="truncate text-[10px] font-medium uppercase tracking-wide">{nodeData.label}</span>
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
            className={`nodrag nowheel nopan w-full bg-transparent font-mono text-sm text-slate-800 outline-none ${isNumeric(editValue) ? 'text-right' : ''}`}
            style={{ minWidth: '100px' }}
          />
        ) : (
          <span className={`block text-slate-800 ${isNumeric(value) ? 'text-right' : ''}`}>{displayValue}</span>
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

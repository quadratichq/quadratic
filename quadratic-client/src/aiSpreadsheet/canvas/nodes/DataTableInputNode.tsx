import type { DataTableNodeData } from '@/aiSpreadsheet/types';
import { aiSpreadsheetAtom } from '@/aiSpreadsheet/atoms/aiSpreadsheetAtom';
import { Handle, Position, useReactFlow, type NodeProps } from '@xyflow/react';
import { TableIcon } from '@/shared/components/Icons';
import { useCallback, useMemo, useState } from 'react';
import { useSetRecoilState } from 'recoil';

export function DataTableInputNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as DataTableNodeData;
  const { setNodes } = useReactFlow();
  const setRecoilState = useSetRecoilState(aiSpreadsheetAtom);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState('');

  // Check if value is numeric for right-alignment
  const isNumeric = (val: string) => {
    if (!val) return false;
    const num = parseFloat(val);
    return !isNaN(num) && isFinite(num);
  };

  const columns = nodeData.columns || [];
  const rows = useMemo(() => nodeData.rows || [], [nodeData.rows]);

  const handleCellDoubleClick = useCallback(
    (e: React.MouseEvent, rowIndex: number, colIndex: number) => {
      e.stopPropagation();
      e.preventDefault();
      setEditValue(rows[rowIndex]?.[colIndex] || '');
      setEditingCell({ row: rowIndex, col: colIndex });
    },
    [rows]
  );

  const handleSave = useCallback(() => {
    if (!editingCell) return;
    const { row, col } = editingCell;

    const updateRows = (existingRows: string[][] | undefined) => {
      const newRows = [...(existingRows || [])];
      if (!newRows[row]) newRows[row] = [];
      newRows[row] = [...newRows[row]];
      newRows[row][col] = editValue;
      return newRows;
    };

    // Update React Flow local state
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === id) {
          const newRows = updateRows(node.data.rows as string[][] | undefined);
          return { ...node, data: { ...node.data, rows: newRows } };
        }
        return node;
      })
    );

    // Also update Recoil state to trigger execution engine
    setRecoilState((prev) => ({
      ...prev,
      nodes: prev.nodes.map((node) => {
        if (node.id === id) {
          const tableData = node.data as DataTableNodeData;
          const newRows = updateRows(tableData.rows);
          return { ...node, data: { ...node.data, rows: newRows } };
        }
        return node;
      }),
    }));

    setEditingCell(null);
  }, [id, editingCell, editValue, setNodes, setRecoilState]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Enter') {
        handleSave();
      } else if (e.key === 'Escape') {
        setEditingCell(null);
      }
    },
    [handleSave]
  );

  const headerClasses = selected
    ? 'border-amber-400 bg-amber-100 text-amber-800'
    : 'border-slate-300 bg-slate-100 text-slate-600';
  const borderClasses = selected ? 'border-amber-400 ring-2 ring-amber-200' : 'border-slate-300';
  const handleClasses = selected ? '!border-amber-500 !bg-amber-400' : '!border-slate-400 !bg-slate-300';

  return (
    <div className={`group relative min-w-[200px] transition-all ${selected ? 'scale-[1.02]' : ''}`}>
      {/* Header - shows label and dimensions */}
      <div
        className={`flex items-center gap-1.5 border-b px-2 py-1 ${headerClasses}`}
        style={{ borderTopLeftRadius: '4px', borderTopRightRadius: '4px' }}
      >
        <TableIcon className="h-3 w-3" />
        <span className="truncate text-[10px] font-medium uppercase tracking-wide">{nodeData.label}</span>
        <span className="text-[9px] opacity-60">
          {rows.length} × {columns.length}
        </span>
      </div>

      {/* Table */}
      <div
        className={`nodrag nowheel nopan overflow-auto border-x border-b bg-white ${borderClasses}`}
        style={{ borderBottomLeftRadius: '4px', borderBottomRightRadius: '4px', maxHeight: '200px' }}
      >
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th
                  key={i}
                  className="border-b border-r border-slate-200 bg-slate-50 px-2 py-1 text-left font-medium text-slate-600"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {columns.map((_, colIndex) => (
                  <td
                    key={colIndex}
                    className="border-b border-r border-slate-100 px-2 py-1 font-mono text-slate-800 last:border-r-0"
                    onDoubleClick={(e) => handleCellDoubleClick(e, rowIndex, colIndex)}
                  >
                    {editingCell?.row === rowIndex && editingCell?.col === colIndex ? (
                      <input
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
                        autoFocus
                        className={`nodrag nowheel nopan w-full bg-amber-50 px-1 outline-none ring-1 ring-amber-400 ${isNumeric(editValue) ? 'text-right' : ''}`}
                      />
                    ) : (
                      <span className={`cursor-text ${isNumeric(row[colIndex] || '') ? 'block text-right' : ''}`}>
                        {row[colIndex] || ''}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length || 1} className="px-2 py-3 text-center italic text-slate-400">
                  No data
                </td>
              </tr>
            )}
          </tbody>
        </table>
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

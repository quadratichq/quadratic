import { sheets } from '@/grid/controller/Sheets';
import { Coordinate } from '@/gridGL/types/size';
import { useEffect, useState } from 'react';
import { MultiplayerCellEdit } from './MultiplayerCellEdit';

export interface MultiplayerCell {
  sessionId: string;
  sheetId: string;
  cell: Coordinate;
  text?: string;
  bold: boolean;
  italic: boolean;
  cursor: number;
  playerColor: string;
}

export const MultiplayerCellEdits = () => {
  const [multiplayerCellInput, setMultiplayerCellInput] = useState<MultiplayerCell[]>([]);
  useEffect(() => {
    const updateMultiplayerCellEdit = (e: any) => {
      const multiplayerCell = e.detail as MultiplayerCell;
      setMultiplayerCellInput((prev) => {
        const found = prev.findIndex((prev) => prev.sessionId === multiplayerCell.sessionId);
        if (multiplayerCell && found === -1) {
          return [...prev, multiplayerCell];
        }
        return prev.map((cell, index) => {
          if (index === found) return multiplayerCell;
          return cell;
        });
      });
    };
    window.addEventListener('multiplayer-cell-edit', updateMultiplayerCellEdit);
    return () => window.removeEventListener('multiplayer-cell-edit', updateMultiplayerCellEdit);
  }, []);

  // force rerender when sheet changes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, setTrigger] = useState(0);
  useEffect(() => {
    const updateTrigger = () => setTrigger((prev) => prev + 1);
    window.addEventListener('sheet-change', updateTrigger);
    return () => window.removeEventListener('sheet-change', updateTrigger);
  });

  return (
    <div style={{ pointerEvents: 'none' }}>
      {multiplayerCellInput
        .filter((cell) => cell.sheetId === sheets.sheet.id)
        .map((cell) => (
          <MultiplayerCellEdit key={cell.sessionId} multiplayerCellInput={cell} />
        ))}
    </div>
  );
};

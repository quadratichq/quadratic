import { events } from '@/events/events';
import { sheets } from '@/grid/controller/Sheets';
import { SheetPosTS } from '@/gridGL/types/size';
import { CellEdit, MultiplayerUser } from '@/web-workers/multiplayerWebWorker/multiplayerTypes';
import { useEffect, useState } from 'react';
import { MultiplayerCellEdit } from './MultiplayerCellEdit';

export interface MultiplayerCell {
  sheetId: string;
  sessionId: string;
  playerColor: string;
  cellEdit: CellEdit;
  location: SheetPosTS;
}

export const MultiplayerCellEdits = () => {
  const [multiplayerCellInput, setMultiplayerCellInput] = useState<MultiplayerCell[]>([]);
  useEffect(() => {
    const updateMultiplayerCellEdit = (cellEdit: CellEdit, player: MultiplayerUser) => {
      setMultiplayerCellInput((prev) => {
        // this shouldn't happen
        if (player.x === undefined || player.y === undefined) return prev;

        const updatedCellEdit: MultiplayerCell = {
          sessionId: player.session_id,
          sheetId: player.sheet_id,
          cellEdit,
          location: { x: player.x, y: player.y, sheetId: player.sheet_id },
          playerColor: player.colorString,
        };
        const found = prev.findIndex((prev) => prev.sessionId === player.session_id);
        if (cellEdit && found === -1) {
          return [...prev, updatedCellEdit];
        }
        return prev.map((cell, index) => {
          if (index === found) return updatedCellEdit;
          return cell;
        });
      });
    };
    events.on('multiplayerCellEdit', updateMultiplayerCellEdit);
    return () => {
      events.off('multiplayerCellEdit', updateMultiplayerCellEdit);
    };
  }, []);

  // force rerender when sheet changes
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, setTrigger] = useState(0);
  useEffect(() => {
    const updateTrigger = () => setTrigger((prev) => prev + 1);
    events.on('changeSheet', updateTrigger);
    return () => {
      events.off('changeSheet', updateTrigger);
    };
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

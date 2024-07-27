import { useEffect, useState } from 'react';

import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { MultiplayerCellEdit } from '@/app/gridGL/HTMLGrid/multiplayerInput/MultiplayerCellEdit';
import type { SheetPosTS } from '@/app/gridGL/types/size';
import type { CellEdit, MultiplayerUser } from '@/app/web-workers/multiplayerWebWorker/multiplayerTypes';

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
        if (player.x === undefined || player.y === undefined || !player.parsedSelection) return prev;
        const updatedCellEdit: MultiplayerCell = {
          sessionId: player.session_id,
          sheetId: player.sheet_id,
          cellEdit,
          location: {
            x: player.parsedSelection.cursorPosition.x,
            y: player.parsedSelection.cursorPosition.y,
            sheetId: player.sheet_id,
          },
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

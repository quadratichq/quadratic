import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { content } from '@/app/gridGL/pixiApp/Content';
import type { CodeRun } from '@/app/web-workers/CodeRun';
import type { MultiplayerUser } from '@/app/web-workers/multiplayerWebWorker/multiplayerTypes';
import { SpinnerIcon } from '@/shared/components/Icons';
import { cn } from '@/shared/shadcn/utils';
import { useEffect, useState } from 'react';
import './CodeRunning.css';

interface Code {
  sheetId: string;
  sessionId?: string;
  left: string;
  top: string;
  color: string;
  alpha: number;
}

const CIRCULAR_PROGRESS_SIZE = 14;
const WAITING_EXECUTION_ALPHA = 0.5;

export const CodeRunning = () => {
  const [playerCode, setPlayerCode] = useState<Code[]>([]);

  // update player's code runs
  useEffect(() => {
    const updateRunningState = (current?: CodeRun, awaitingExecution?: CodeRun[]) => {
      const code: Code[] = [];
      if (current) {
        // Hide the spinner if the table has show_name (table heading) - the logo will spin instead
        const table = content.cellsSheets
          .getById(current.sheetPos.sheetId)
          ?.tables.getTable(current.sheetPos.x, current.sheetPos.y);
        if (!table || !table.codeCell.show_name) {
          // we move the code run indicator to the start of the data if table ui is showing
          let y = current.sheetPos.y;
          if (table && table.codeCell.show_name) {
            y = table.codeCell.y + (table.codeCell.show_columns ? 2 : 1);
          }
          const rectangle = sheets.sheet.getCellOffsets(current.sheetPos.x, y);
          code.push({
            sheetId: current.sheetPos.sheetId,
            left: `${rectangle.x + rectangle.width / 2 - CIRCULAR_PROGRESS_SIZE / 2}px`,
            top: `${rectangle.y + rectangle.height / 2 - CIRCULAR_PROGRESS_SIZE / 2}px`,
            color: 'black',
            alpha: 1,
          });
        }
      }
      awaitingExecution?.forEach((cell) => {
        // Hide the spinner if the table has show_name (table heading) - the logo will spin instead
        const table = content.cellsSheets
          .getById(cell.sheetPos.sheetId)
          ?.tables.getTable(cell.sheetPos.x, cell.sheetPos.y);
        if (!table || !table.codeCell.show_name) {
          const rectangle = sheets.sheet.getCellOffsets(cell.sheetPos.x, cell.sheetPos.y);
          code.push({
            sheetId: cell.sheetPos.sheetId,
            left: `${rectangle.x + rectangle.width / 2 - CIRCULAR_PROGRESS_SIZE / 2}px`,
            top: `${rectangle.y + rectangle.height / 2 - CIRCULAR_PROGRESS_SIZE / 2}px`,
            color: 'black',
            alpha: WAITING_EXECUTION_ALPHA,
          });
        }
      });
      setPlayerCode(code);
    };
    events.on('codeRunningState', updateRunningState);

    return () => {
      events.off('codeRunningState', updateRunningState);
    };
  }, []);

  // update multiplayer's code runs
  const [multiplayerCode, setMultiplayerCode] = useState<Code[]>([]);
  useEffect(() => {
    const updateMultiplayerUsers = (multiplayerUsers: MultiplayerUser[]) => {
      if (multiplayerUsers?.length === 0) {
        // Clear all multiplayer code if no users
        setMultiplayerCode([]);
        return;
      }
      const sheet = sheets.sheet;
      const code: Code[] = [];
      multiplayerUsers.forEach((user) => {
        // Only process users that have code running
        if (user.parsedCodeRunning && user.parsedCodeRunning.length > 0) {
          user.parsedCodeRunning.forEach((cell, index) => {
            if (cell.sheetId === sheet.id) {
              // Hide the spinner if the table has show_name (table heading) - the logo will spin instead
              const table = content.cellsSheets.getById(cell.sheetId)?.tables.getTable(cell.x, cell.y);
              if (!table || !table.codeCell.show_name) {
                const rectangle = sheet.getCellOffsets(cell.x, cell.y);
                code.push({
                  sheetId: cell.sheetId,
                  sessionId: user.session_id,
                  left: `${rectangle.x + rectangle.width / 2 - CIRCULAR_PROGRESS_SIZE / 2}px`,
                  top: `${rectangle.y + rectangle.height / 2 - CIRCULAR_PROGRESS_SIZE / 2}px`,
                  color: user.colorString,
                  alpha: index === 0 ? 1 : WAITING_EXECUTION_ALPHA,
                });
              }
            }
          });
        }
      });
      setMultiplayerCode(code);
    };
    events.on('multiplayerUpdate', updateMultiplayerUsers);

    const updateMultiplayerCodeRunning = (multiplayerUser: MultiplayerUser) => {
      // Always remove all existing code runs for this user first
      setMultiplayerCode((prev) => {
        const filtered = prev.filter((code) => code.sessionId !== multiplayerUser.session_id);

        // If user has no code running, return filtered array (all code removed)
        if (!multiplayerUser.parsedCodeRunning || multiplayerUser.parsedCodeRunning.length === 0) {
          return filtered;
        }

        // Otherwise, add new code runs for this user
        const sheet = sheets.sheet;
        const code: Code[] = [];
        multiplayerUser.parsedCodeRunning.forEach((cell, index) => {
          if (cell.sheetId === sheet.id) {
            // Hide the spinner if the table has show_name (table heading) - the logo will spin instead
            const table = content.cellsSheets.getById(cell.sheetId)?.tables.getTable(cell.x, cell.y);
            if (!table || !table.codeCell.show_name) {
              const rectangle = sheet.getCellOffsets(cell.x, cell.y);
              code.push({
                sheetId: cell.sheetId,
                sessionId: multiplayerUser.session_id,
                left: `${rectangle.x + rectangle.width / 2 - CIRCULAR_PROGRESS_SIZE / 2}px`,
                top: `${rectangle.y + rectangle.height / 2 - CIRCULAR_PROGRESS_SIZE / 2}px`,
                color: multiplayerUser.colorString,
                alpha: index === 0 ? 1 : WAITING_EXECUTION_ALPHA,
              });
            }
          }
        });

        return [...filtered, ...code];
      });
    };
    events.on('multiplayerCodeRunning', updateMultiplayerCodeRunning);

    return () => {
      events.off('multiplayerUpdate', updateMultiplayerUsers);
      events.off('multiplayerCodeRunning', updateMultiplayerCodeRunning);
    };
  }, [playerCode?.length]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_, setTrigger] = useState(0);
  useEffect(() => {
    const updateSheet = () => setTrigger((prev) => prev + 1);
    events.on('changeSheet', updateSheet);
    return () => {
      events.off('changeSheet', updateSheet);
    };
  }, []);

  return (
    <div className="code-running-container">
      {[...playerCode, ...multiplayerCode]
        .filter((code) => {
          return code.sheetId === sheets.current;
        })
        .map((code, index) => {
          return (
            <span
              key={`${code.sheetId}-${code.left}-${code.top}-${index}`}
              className="-translate-x-[2px] -translate-y-[4px] scale-75"
              style={{ position: 'absolute', left: code.left, top: code.top }}
            >
              <SpinnerIcon
                className={cn(code.color === 'black' && 'text-primary')}
                style={code.color !== 'black' ? { color: code.color } : {}}
              />
            </span>
          );
        })}
    </div>
  );
};

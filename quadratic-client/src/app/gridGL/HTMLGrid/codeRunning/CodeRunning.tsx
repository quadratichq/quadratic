import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import type { CodeRun } from '@/app/web-workers/CodeRun';
import type { LanguageState } from '@/app/web-workers/languageTypes';
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
    const updateRunningState = (_state: LanguageState, current?: CodeRun, awaitingExecution?: CodeRun[]) => {
      const code: Code[] = [];
      if (current) {
        // we move the code run indicator to the start of the data if table ui is showing
        // todo: in case of the table, we should replace the code language indicator with this indicator
        const table = pixiApp.cellsSheets
          .getById(current.sheetPos.sheetId)
          ?.tables.getTable(current.sheetPos.x, current.sheetPos.y);
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
      awaitingExecution?.forEach((cell) => {
        const rectangle = sheets.sheet.getCellOffsets(cell.sheetPos.x, cell.sheetPos.y);
        code.push({
          sheetId: cell.sheetPos.sheetId,
          left: `${rectangle.x + rectangle.width / 2 - CIRCULAR_PROGRESS_SIZE / 2}px`,
          top: `${rectangle.y + rectangle.height / 2 - CIRCULAR_PROGRESS_SIZE / 2}px`,
          color: 'black',
          alpha: WAITING_EXECUTION_ALPHA,
        });
      });
      setPlayerCode(code);
    };
    events.on('pythonState', updateRunningState);
    events.on('javascriptState', updateRunningState);
    events.on('connectionState', updateRunningState);

    return () => {
      events.off('pythonState', updateRunningState);
      events.off('javascriptState', updateRunningState);
      events.off('connectionState', updateRunningState);
    };
  }, []);

  // update multiplayer's code runs
  const [multiplayerCode, setMultiplayerCode] = useState<Code[]>([]);
  useEffect(() => {
    const updateMultiplayerUsers = (multiplayerUsers: MultiplayerUser[]) => {
      if (multiplayerUsers?.length === 0) return;
      const sheet = sheets.sheet;
      const code: Code[] = [];
      multiplayerUsers.forEach((user) => {
        user.parsedCodeRunning.forEach((cell, index) => {
          if (cell.sheetId === sheet.id) {
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
        });
      });
      setMultiplayerCode(code);
    };
    events.on('multiplayerUpdate', updateMultiplayerUsers);

    const updateMultiplayerCodeRunning = (multiplayerUser: MultiplayerUser) => {
      // remove all code runs from user if they are not running any code
      if (multiplayerUser.parsedCodeRunning.length === 0) {
        setMultiplayerCode((prev) => prev.filter((code) => code.sessionId !== multiplayerUser.session_id));
      } else {
        const sheet = sheets.sheet;
        const code: Code[] = [];
        multiplayerUser.parsedCodeRunning.forEach((cell, index) => {
          if (cell.sheetId === sheet.id) {
            const rectangle = sheet.getCellOffsets(cell.x, cell.y);
            code.push({
              sheetId: cell.sheetId,
              left: `${rectangle.x + rectangle.width / 2 - CIRCULAR_PROGRESS_SIZE / 2}px`,
              top: `${rectangle.y + rectangle.height / 2 - CIRCULAR_PROGRESS_SIZE / 2}px`,
              color: multiplayerUser.colorString,
              alpha: index === 0 ? 1 : WAITING_EXECUTION_ALPHA,
            });
          }
        });
        setMultiplayerCode((prev) => [
          ...prev.filter((code) => code.sessionId !== multiplayerUser.session_id),
          ...code,
        ]);
      }
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

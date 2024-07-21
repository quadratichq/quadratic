import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import type { CodeRun } from '@/app/web-workers/CodeRun';
import { LanguageState } from '@/app/web-workers/languageTypes';
import { MultiplayerUser } from '@/app/web-workers/multiplayerWebWorker/multiplayerTypes';
import { CircularProgress } from '@mui/material';
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
        const rectangle = sheets.sheet.getCellOffsets(current.sheetPos.x, current.sheetPos.y);
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
      events.on('multiplayerUpdate', updateMultiplayerUsers);
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
          return code.sheetId === sheets.sheet.id;
        })
        .map((code, index) => (
          <CircularProgress
            color={code.color === 'black' ? 'primary' : undefined}
            size={`${CIRCULAR_PROGRESS_SIZE}px`}
            key={index}
            sx={{ position: 'absolute', left: code.left, top: code, color: code.color }}
          />
        ))}
    </div>
  );
};

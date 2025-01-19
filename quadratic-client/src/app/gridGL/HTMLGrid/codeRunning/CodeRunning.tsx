import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { JsCodeRun } from '@/app/quadratic-core-types';
import type { CodeRun } from '@/app/web-workers/CodeRun';
import { LanguageState } from '@/app/web-workers/languageTypes';
import { MultiplayerUser } from '@/app/web-workers/multiplayerWebWorker/multiplayerTypes';
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
    const updateRunningState = (_state: LanguageState, current?: CodeRun[], awaitingExecution?: CodeRun[]) => {
      const code: Code[] = [];
      current?.forEach((cell) => {
        const rectangle = sheets.sheet.getCellOffsets(cell.sheetPos.x, cell.sheetPos.y);
        code.push({
          sheetId: cell.sheetPos.sheetId,
          left: `${rectangle.x + rectangle.width / 2 - CIRCULAR_PROGRESS_SIZE / 2}px`,
          top: `${rectangle.y + rectangle.height / 2 - CIRCULAR_PROGRESS_SIZE / 2}px`,
          color: 'black',
          alpha: 1,
        });
      });
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

    const updateSingleRunningState = (state: LanguageState, current?: CodeRun, awaitingExecution?: CodeRun[]) => {
      updateRunningState(state, current ? [current] : undefined, awaitingExecution);
    };

    const updateAIResearcherRunningState = (current?: JsCodeRun[], awaitingExecution?: JsCodeRun[]) => {
      updateRunningState('ready', current, awaitingExecution);
    };

    events.on('pythonState', updateSingleRunningState);
    events.on('javascriptState', updateSingleRunningState);
    events.on('connectionState', updateSingleRunningState);
    events.on('aiResearcherState', updateAIResearcherRunningState);

    return () => {
      events.off('pythonState', updateSingleRunningState);
      events.off('javascriptState', updateSingleRunningState);
      events.off('connectionState', updateSingleRunningState);
      events.off('aiResearcherState', updateAIResearcherRunningState);
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
          return code.sheetId === sheets.sheet.id;
        })
        .map((code, index) => {
          return (
            <span
              key={`${code.sheetId}-${code.left}-${code.top}-${code.alpha}`}
              className="-translate-x-[2px] -translate-y-[4px] scale-75"
              style={{ position: 'absolute', left: code.left, top: code.top }}
            >
              <SpinnerIcon
                className={cn(code.color === 'black' && 'text-primary')}
                style={{ color: code.color, opacity: code.alpha }}
              />
            </span>
          );
        })}
    </div>
  );
};

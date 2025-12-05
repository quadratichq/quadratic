import { codeEditorCodeCellAtom } from '@/app/atoms/codeEditorAtom';
import { events } from '@/app/events/events';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import type { CodeCellLanguage } from '@/app/quadratic-core-types';
import { javascriptWebWorker } from '@/app/web-workers/javascriptWebWorker/javascriptWebWorker';
import { pythonWebWorker } from '@/app/web-workers/pythonWebWorker/pythonWebWorker';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import type { CodeRun } from '@/app/web-workers/CodeRun';
import { useEffect, useState } from 'react';
import { useRecoilCallback } from 'recoil';

export const useCancelRun = () => {
  const [currentCodeRun, setCurrentCodeRun] = useState<CodeRun | undefined>();

  useEffect(() => {
    const updateCodeRunningState = (current?: CodeRun) => {
      setCurrentCodeRun(current);
    };
    events.on('codeRunningState', updateCodeRunningState);
    return () => {
      events.off('codeRunningState', updateCodeRunningState);
    };
  }, []);

  const cancelRun = useRecoilCallback(
    ({ snapshot }) =>
      async () => {
        const codeCell = await snapshot.getPromise(codeEditorCodeCellAtom);
        const mode = getLanguage(codeCell.language);

        // Check if there's a current code run for this cell
        const isRunning =
          currentCodeRun &&
          currentCodeRun.sheetPos.x === codeCell.pos.x &&
          currentCodeRun.sheetPos.y === codeCell.pos.y &&
          currentCodeRun.sheetPos.sheetId === codeCell.sheetId;

        if (!isRunning) {
          return; // Nothing to cancel
        }

        if (mode === 'Python') {
          pythonWebWorker.cancelExecution();
        } else if (mode === 'Javascript') {
          javascriptWebWorker.cancelExecution();
        } else if (mode === 'Connection') {
          const languageToCancel: CodeCellLanguage = { Connection: {} as any };
          quadraticCore.sendCancelExecution(languageToCancel);
        }
      },
    [currentCodeRun]
  );

  return { cancelRun };
};

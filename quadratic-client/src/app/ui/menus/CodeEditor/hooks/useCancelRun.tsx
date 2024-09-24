import { codeEditorLanguageAtom } from '@/app/atoms/codeEditorAtom';
import { useConnectionState } from '@/app/atoms/useConnectionState';
import { useJavascriptState } from '@/app/atoms/useJavascriptState';
import { usePythonState } from '@/app/atoms/usePythonState';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { CodeCellLanguage } from '@/app/quadratic-core-types';
import { javascriptWebWorker } from '@/app/web-workers/javascriptWebWorker/javascriptWebWorker';
import { pythonWebWorker } from '@/app/web-workers/pythonWebWorker/pythonWebWorker';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { useCallback, useMemo } from 'react';
import { useRecoilValue } from 'recoil';

export const useCancelRun = () => {
  const language = useRecoilValue(codeEditorLanguageAtom);
  const mode = useMemo(() => getLanguage(language), [language]);

  const { pythonState } = usePythonState();
  const javascriptState = useJavascriptState();
  const connectionState = useConnectionState();

  const cancelRun = useCallback(() => {
    if (mode === 'Python') {
      if (pythonState === 'running') {
        pythonWebWorker.cancelExecution();
      }
    } else if (mode === 'Javascript') {
      if (javascriptState === 'running') {
        javascriptWebWorker.cancelExecution();
      }
    } else if (mode === 'Connection') {
      if (connectionState === 'running') {
        const language: CodeCellLanguage = { Connection: {} as any };
        quadraticCore.sendCancelExecution(language);
      }
    }
  }, [connectionState, javascriptState, mode, pythonState]);

  return { cancelRun };
};

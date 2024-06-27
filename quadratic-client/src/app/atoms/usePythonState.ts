import { events } from '@/app/events/events';
import { LanguageState } from '@/app/web-workers/languageTypes';
import { pythonWebWorker } from '@/app/web-workers/pythonWebWorker/pythonWebWorker';
import { useEffect, useState } from 'react';

export const usePythonState = (): { pythonState: LanguageState; version?: string } => {
  const [pythonState, setPythonState] = useState<LanguageState>(pythonWebWorker.state);
  const [version, setVersion] = useState<string | undefined>(undefined);

  useEffect(() => {
    const updatePythonVersion = (version: string) => setVersion(version);
    const updatePythonState = (state: LanguageState) => {
      setPythonState(state);
    };
    events.on('pythonInit', updatePythonVersion);
    events.on('pythonState', updatePythonState);
    return () => {
      events.off('pythonInit', updatePythonVersion);
      events.off('pythonState', updatePythonState);
    };
  }, []);

  return {
    pythonState,
    version,
  };
};

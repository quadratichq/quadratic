import { events } from '@/app/events/events';
import { PythonStateType } from '@/app/web-workers/pythonWebWorker/pythonClientMessages';
import { pythonWebWorker } from '@/app/web-workers/pythonWebWorker/pythonWebWorker';
import { useEffect, useState } from 'react';

export const usePythonState = (): { pythonState: PythonStateType; version?: string } => {
  const [pythonState, setPythonState] = useState<PythonStateType>(pythonWebWorker.state);
  const [version, setVersion] = useState<string | undefined>(undefined);

  useEffect(() => {
    const updatePythonVersion = (version: string) => setVersion(version);
    const updatePythonState = (state: PythonStateType) => {
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

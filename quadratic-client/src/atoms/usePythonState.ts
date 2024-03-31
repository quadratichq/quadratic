import { events } from '@/events/events';
import { PythonStateType } from '@/web-workers/pythonWebWorker/pythonClientMessages';
import { pythonWebWorker } from '@/web-workers/pythonWebWorker/pythonWebWorker';
import { useEffect, useState } from 'react';

export const usePythonState = (): { pythonState: PythonStateType; version?: string } => {
  const [pythonState, setPythonState] = useState<PythonStateType>(pythonWebWorker.state);
  const [version, setVersion] = useState<string | undefined>(undefined);

  useEffect(() => {
    const updatePythonState = (state: PythonStateType, version?: string) => {
      setPythonState(state);
      if (version) {
        setVersion(version);
      }
    };
    events.on('pythonState', updatePythonState);
    return () => {
      events.off('pythonState', updatePythonState);
    };
  }, []);

  return {
    pythonState,
    version,
  };
};

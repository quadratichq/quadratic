import { useEffect, useState } from 'react';

import { events } from '@/app/events/events';
import type { LanguageState } from '@/app/web-workers/languageTypes';

export const useConnectionState = (): LanguageState => {
  const [state, setState] = useState<LanguageState>('ready');

  useEffect(() => {
    const updateConnectionState = (state: LanguageState) => setState(state);

    events.on('connectionState', updateConnectionState);
    return () => {
      events.off('connectionState', updateConnectionState);
    };
  }, []);

  return state;
};

import { useEffect, useState } from 'react';

import { events } from '@/app/events/events';
import { javascriptWebWorker } from '@/app/web-workers/javascriptWebWorker/javascriptWebWorker';
import type { LanguageState } from '@/app/web-workers/languageTypes';

export const useJavascriptState = (): LanguageState => {
  const [state, setState] = useState<LanguageState>(javascriptWebWorker.state);

  useEffect(() => {
    const updateJavascriptState = (state: LanguageState) => setState(state);
    events.on('javascriptState', updateJavascriptState);
    return () => {
      events.off('javascriptState', updateJavascriptState);
    };
  }, []);

  return state;
};

import { events } from '@/app/events/events';
import { javascriptWebWorker } from '@/app/web-workers/javascriptWebWorker/javascriptWebWorker';
import { LanguageState } from '@/app/web-workers/languageTypes';
import { useEffect, useState } from 'react';

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

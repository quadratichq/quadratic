//! React helper to get a reactive version of the localforage stored debug flags.

import { debugFlags } from '@/app/debugFlags/debugFlags';
import type { DebugFlag } from '@/app/debugFlags/debugFlagsDefinitions';
import { events } from '@/app/events/events';
import { useEffect, useMemo, useState } from 'react';

interface DebugFlags {
  getFlag: (key: DebugFlag) => boolean;
  debugAvailable: boolean;
}

export const useDebugFlags = (): { debug: boolean; debugFlags: DebugFlags } => {
  const [debugFlagsState, setDebugFlagsState] = useState<DebugFlags>({
    getFlag: debugFlags.getFlag,
    debugAvailable: debugFlags.debugAvailable,
  });

  useEffect(() => {
    const updateFlags = () => {
      setDebugFlagsState({
        getFlag: debugFlags.getFlag,
        debugAvailable: debugFlags.debugAvailable,
      });
    };
    events.on('debugFlags', updateFlags);
    return () => {
      events.off('debugFlags', updateFlags);
    };
  }, []);

  const debug = useMemo(() => debugFlagsState.getFlag('debug'), [debugFlagsState]);

  return { debug, debugFlags: debugFlagsState };
};

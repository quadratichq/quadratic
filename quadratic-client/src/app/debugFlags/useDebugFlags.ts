//! React helper to get a reactive version of the localforage stored debug flags.

import { debugFlags } from '@/app/debugFlags/debugFlags';
import type { DebugFlag } from '@/app/debugFlags/debugFlagsDefinitions';
import { events } from '@/app/events/events';
import { useEffect, useState } from 'react';

interface UseDebugFlags {
  getFlag: (key: DebugFlag) => boolean;
  _trigger: number;
  debugAvailable: boolean;
}

export const useDebugFlags = (): UseDebugFlags => {
  const [_trigger, setTrigger] = useState(0);
  useEffect(() => {
    const updateFlags = () => {
      setTrigger((prev) => prev + 1);
    };
    events.on('debugFlags', updateFlags);

    return () => {
      events.off('debugFlags', updateFlags);
    };
  }, []);
  return {
    _trigger,
    getFlag: debugFlags.getFlag,
    debugAvailable: debugFlags.debugAvailable,
  };
};

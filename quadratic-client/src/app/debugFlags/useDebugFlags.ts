//! React helper to get a reactive version of the localforage stored debug flags.

import { debugFlags } from '@/app/debugFlags/debugFlags';
import { debugFlagDefaults, type DebugFlagOptions } from '@/app/debugFlags/debugFlagsDefinitions';
import { events } from '@/app/events/events';
import { useEffect, useState } from 'react';

export const useDebugFlags = (): DebugFlagOptions => {
  const [flags, setFlags] = useState<DebugFlagOptions>(debugFlags.flags ?? debugFlagDefaults);
  useEffect(() => {
    const updateFlags = () => {
      if (debugFlags.flags) {
        setFlags(debugFlags.flags);
      }
    };
    events.on('debugFlags', updateFlags);

    return () => {
      events.off('debugFlags', updateFlags);
    };
  });
  return flags;
};

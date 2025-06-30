import {
  debugFlagDefaults,
  debugFlagDescriptions,
  type DebugFlag,
  type DebugFlagOptions,
} from '@/app/debugFlags/debugFlagsDefinitions';
import { events } from '@/app/events/events';
import localforage from 'localforage';

const CHECK_CHANGE_INTERVAL_MS = 1000;
const KEY = 'debugFlags';

class DebugFlags {
  private intervalId?: number;
  debugAvailable: boolean;
  flags?: DebugFlagOptions;

  constructor() {
    // set this in .env (if set to false then all debug flags are turned off)
    const url = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
    this.debugAvailable = url.has('debug') || import.meta.env.VITE_DEBUG === '1' ? true : false;
    if (!this.debugAvailable) {
      this.flags = debugFlagDefaults;
      return;
    }
    this.loadFlags();

    // the as unknown is a hack to fix the type error
    this.intervalId = setInterval(this.loadFlags, CHECK_CHANGE_INTERVAL_MS) as unknown as number;
  }

  destroy() {
    if (this.intervalId) {
      window.clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  private loadFlags = async () => {
    try {
      const flagsStringified = (await localforage.getItem(KEY)) as string;
      const flags = flagsStringified ? JSON.parse(flagsStringified) : debugFlagDefaults;
      if (flags) {
        // add default values if not set in localforage
        this.flags = {
          ...debugFlagDefaults,
          ...flags,
        };
      }
    } catch (e) {
      // on error, reset to defaults
      this.flags = debugFlagDefaults;
    }

    const url = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
    for (const key in debugFlagDescriptions) {
      if (url.has(key)) {
        this.setFlag(key as DebugFlag, true);
      }
    }
  };

  /// Returns the value of the debug flag for the given key. Note: if the flags
  /// are not initialized, it returns false.
  getFlag = (key: DebugFlag): boolean => {
    if (!this.flags || !this.debugAvailable || !this.flags.debug) return false;
    return this.flags[key];
  };

  /// Sets the value of the debug flag for the given key. Note: if the flags
  /// are not initialized, it does nothing.
  setFlag = (key: DebugFlag, value: boolean) => {
    if (!this.flags) return;
    this.flags[key] = value;
    localforage.setItem(KEY, JSON.stringify(this.flags));
    events.emit('debugFlags');
  };
}

export const debugFlags = new DebugFlags();

export const debugFlagWait = async (key: DebugFlag) => {
  await waitForDebugFlags();
  return debugFlag(key);
};

export const debugFlag = (key: DebugFlag) => {
  return debugFlags.getFlag(key);
};

export const setDebugFlag = (key: DebugFlag, value: boolean) => {
  debugFlags.setFlag(key, value);
};

/// Returns a promise that resolves when the debug flags are initialized
export const waitForDebugFlags = async (): Promise<void> => {
  // Otherwise, wait for flags to be initialized
  return new Promise((resolve) => {
    const checkFlags = () => {
      if (debugFlags.flags) {
        resolve();
      } else {
        events.once('debugFlags', checkFlags);
      }
    };
    checkFlags();
  });
};

import { debugFlagDefaults, type DebugFlag, type DebugFlagOptions } from '@/app/debugFlags/debugFlagsDefinitions';
import { events } from '@/app/events/events';
import localforage from 'localforage';

const CHECK_CHANGE_INTERVAL = 1000;
const KEY = 'debugFlags';

class DebugFlags {
  flags?: DebugFlagOptions;
  private intervalId?: number;

  constructor() {
    // set this in .env (if set to false then all debug flags are turned off)
    const url = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search);
    const debugAvailable = url.has('debug') || import.meta.env.VITE_DEBUG === '1' ? true : false;
    if (!debugAvailable) {
      this.flags = debugFlagDefaults;
      return;
    }
    this.loadFlags();

    // the as unknown is a hack to fix the type error
    this.intervalId = setInterval(this.loadFlags, CHECK_CHANGE_INTERVAL) as unknown as number;
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
  };

  /// Returns the value of the debug flag for the given key. Note: if the flags
  /// are not initialized, it returns false.
  getFlag(key: DebugFlag): boolean {
    if (!this.flags) return false;
    return this.flags.debug && this.flags[key];
  }

  /// Sets the value of the debug flag for the given key. Note: if the flags
  /// are not initialized, it does nothing.
  setFlag(key: DebugFlag, value: boolean) {
    if (!this.flags) return;
    this.flags[key] = value;
    localforage.setItem(KEY, JSON.stringify(this.flags));
    events.emit('debugFlags');
  }
}

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

export const debugFlags = new DebugFlags();

/// Returns a promise that resolves when the debug flags are initialized
export const waitForDebugFlags = async (): Promise<void> => {
  // If flags are already initialized, return immediately
  if (debugFlags.flags) {
    return;
  }

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

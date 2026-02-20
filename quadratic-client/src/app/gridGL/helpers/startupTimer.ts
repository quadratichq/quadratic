//! Tracks the startup time of the app

import { debugFlag, debugFlags } from '@/app/debugFlags/debugFlags';
import { events } from '@/app/events/events';

// Timer configuration with levels (0 = top level, higher numbers = nested)
const timerInfo = {
  firstRender: { startTime: 0, endTime: 0 },
  'core.loadFile': { startTime: 0, endTime: 0 },
  'core.loadFile.fetchGridFile': { startTime: 0, endTime: 0 },
  'core.loadFile.loadCore': { startTime: 0, endTime: 0 },
  'core.loadFile.newFromFile': { startTime: 0, endTime: 0 },
  'file.loader': { startTime: 0, endTime: 0 },
  'file.loader.files.get': { startTime: 0, endTime: 0 },
  'file.loader.embeds.get': { startTime: 0, endTime: 0 },
  'file.loader.initCoreClient': { startTime: 0, endTime: 0 },
  'file.loader.loadPixi': { startTime: 0, endTime: 0 },
  'file.loader.quadraticCore.load': { startTime: 0, endTime: 0 },
  pixiApp: { startTime: 0, endTime: 0 },
  multiplayerSync: { startTime: 0, endTime: 0 },
  offlineSync: { startTime: 0, endTime: 0 },
};

export type TimerNames = keyof typeof timerInfo | 'fileSize';

class StartupTimer {
  private sent = false;
  private fileSize: number = 0;

  constructor() {
    events.on('startupTimer', this.handleStartupTimer);
  }

  private handleStartupTimer = (name: TimerNames, data: { start?: number; end?: number }) => {
    if (name === 'fileSize') {
      this.fileSize = data.start ?? 0;
      return;
    }

    if (data.start) {
      this.start(name, data.start);
    }

    if (data.end) {
      this.end(name, data.end);
    }
  };

  start(name: TimerNames, startTime = performance.now()): void {
    if (name === 'fileSize') throw new Error('fileSize is not a valid timer name');
    if (timerInfo[name].startTime && debugFlags.debugAvailable) {
      console.error(`startupTimer.start called twice for ${name}`);
      return;
    }
    timerInfo[name].startTime = startTime;
  }

  end(name: TimerNames, endTime = performance.now()): void {
    if (name === 'fileSize') throw new Error('fileSize is not a valid timer name');
    const startTime = timerInfo[name].startTime;
    if (!startTime) {
      if (debugFlags.debugAvailable) {
        console.error(`Expected startupTimer.start('${name}') to be called before startupTimer.end('${name}')`);
      }
      return;
    }
    timerInfo[name].endTime = endTime;
  }

  show(): Record<string, number> | undefined {
    if (this.sent) return undefined;
    const result: Record<string, number> = {
      fileSize: this.fileSize,
    };
    const output = Object.entries(timerInfo)
      .map(([name, { endTime, startTime }]) => {
        result[name] = endTime - startTime;
        return `${name}: ${Math.round(endTime - startTime)}ms`;
      })
      .join('\n');

    if (debugFlag('debugStartupTime')) {
      const title = `Startup Timers (${(this.fileSize / (1024 * 1024)).toFixed(2)} MB)`;
      console.log(`${title}\n${'-'.repeat(title.length)}\n${output}`);
    }
    this.sent = true;
    return result;
  }
}

export const startupTimer = new StartupTimer();

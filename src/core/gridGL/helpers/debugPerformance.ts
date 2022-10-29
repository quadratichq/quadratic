import { debugTimeCheck } from '../../../debugFlags';

const MINIMUM_MS_TO_DISPLAY = 10;

let lastTime = 0;

export function timeReset(): void {
  lastTime = performance.now();
}

export function timeCheck(name: string, minimum = MINIMUM_MS_TO_DISPLAY): void {
  if (!debugTimeCheck) return;
  const now = performance.now();
  if (now - lastTime > minimum) {
    console.log(`${name}: ${Math.round(now - lastTime)}ms`);
  }
  lastTime = now;
}

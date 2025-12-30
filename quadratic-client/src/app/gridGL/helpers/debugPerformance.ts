import { debugFlag } from '@/app/debugFlags/debugFlags';

const MINIMUM_MS_TO_DISPLAY = 10;

let lastTime = 0;

export function debugTimeReset(): void {
  lastTime = performance.now();
}

export function debugTimeCheck(name: string, minimum = MINIMUM_MS_TO_DISPLAY): void {
  if (!debugFlag('debugShowTime')) return;
  const now = performance.now();
  if (now - lastTime > minimum) {
    console.log(`[Time Check] ${name}: ${Math.round(now - lastTime)}ms`);
  }
  lastTime = now;
}

/** Update the TS/Pixi renderer light (red = rendering, green = idle) */
export function debugRendererLight(on: boolean): void {
  if (!debugFlag('debugShowFPS')) return;
  const span = document.querySelector('.debug-show-renderer') as HTMLSpanElement;
  if (span) {
    span.style.backgroundColor = on ? '#aa0000' : '#00aa00';
  }
}

/** Update the Rust renderer light (red = rendering, green = idle) */
export function debugRustRendererLight(on: boolean): void {
  if (!debugFlag('debugShowFPS')) return;
  const span = document.querySelector('.debug-show-rust-renderer') as HTMLSpanElement;
  if (span) {
    span.style.backgroundColor = on ? '#aa0000' : '#00aa00';
  }
}

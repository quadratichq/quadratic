import { debugFlag } from '@/app/debugFlags/debugFlags';

const MINIMUM_MS_TO_DISPLAY = 10;

let lastTime = 0;

export type DebugTimes = Record<string, number>;

export function debugTimeStart(name: string, times: DebugTimes): void {
  times[name] = performance.now();
}

export function debugTimeEnd(name: string, times: DebugTimes): void {
  const start = times[name];
  if (!start) {
    console.error('Expected debugTimeStart to be called before debugTimeEnd');
  } else {
    times[name] = performance.now() - start;
  }
}

export function debugShowTimes(name: string, times: Record<string, number>): void {
  if (debugFlag('debugStartupTime')) {
    console.log(
      `${name}\n${'*'.repeat(name.length)}\n${Object.entries(times)
        .map(([key, value]) => `${key}: ${Math.round(value)}ms`)
        .join('\n')}`
    );
  }
}

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

export function debugRendererLight(on: boolean): void {
  if (!debugFlag('debugShowFPS')) return;
  const span = document.querySelector('.debug-show-renderer') as HTMLSpanElement;
  if (span) {
    span.style.backgroundColor = on ? '#aa0000' : '#00aa00';
  }
}

// let count = 0;
// let visibleCount = 0;
// function countChildren(parent: Container): void {
//   count++;
//   if (parent.visible) {
//     visibleCount++;
//   }
//   parent.children.forEach((child) => {
//     if (child instanceof Container) {
//       countChildren(child);
//     }
//   });
// }

// export function debugShowChildren(parent: Container, name?: string): void {
//   if (!debugFlag('debugShowCountRenderedObjects')) return;
//   count = 0;
//   visibleCount = 0;
//   countChildren(parent);
//   console.log(`[Rendered] ${name ? `[${name}] ` : ''}${count} objects | ${visibleCount} visible`);
// }

import { debugShowCountRenderedObjects, debugShowFPS, debugShowTime } from '@/app/debugFlags';
import { CellsTextHash } from '@/app/gridGL/cells/cellsLabel/CellsTextHash';
import { CellsSheet } from '@/app/gridGL/cells/CellsSheet';
import { Container } from 'pixi.js';

const MINIMUM_MS_TO_DISPLAY = 10;

let lastTime = 0;

export function debugTimeReset(): void {
  lastTime = performance.now();
}

export function debugTimeCheck(name: string, minimum = MINIMUM_MS_TO_DISPLAY): void {
  if (!debugShowTime) return;
  const now = performance.now();
  if (now - lastTime > minimum) {
    console.log(`[Time Check] ${name}: ${Math.round(now - lastTime)}ms`);
  }
  lastTime = now;
}

export function debugRendererLight(on: boolean): void {
  if (!debugShowFPS) return;
  const span = document.querySelector('.debug-show-renderer') as HTMLSpanElement;
  if (span) {
    span.style.backgroundColor = on ? '#aa0000' : '#00aa00';
  }
}

let count = 0;
let visibleCount = 0;
let cellsSheet = 0;
let labelMeshEntry = 0;
function countChildren(parent: Container): void {
  count++;
  if (parent.visible) {
    visibleCount++;
  }
  if (parent.visible && parent instanceof CellsTextHash) {
    labelMeshEntry++;
  }
  if (parent.visible && parent instanceof CellsSheet) {
    cellsSheet++;
  }
  if (parent.visible) {
    parent.children.forEach((child) => {
      if (child instanceof Container) {
        countChildren(child);
      }
    });
  }
}

export function debugShowChildren(parent: Container, name?: string): void {
  if (!debugShowCountRenderedObjects) return;
  count = 0;
  visibleCount = 0;
  labelMeshEntry = 0;
  cellsSheet = 0;
  countChildren(parent);
  console.log(
    `[Rendered] ${name ? `[${name}] ` : ''}${count} objects | ${visibleCount} visible | ${labelMeshEntry} labelMeshEntry | ${cellsSheet} cellsSheet`
  );
}

export function debugShowCachedCounts(): void {
  // if (!debugShowCachedSpriteCounts) return;
  // app.cells.debugShowCachedCounts();
}

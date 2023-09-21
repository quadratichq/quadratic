import { sheets } from '../../grid/controller/Sheets';
import { Cell } from '../../schemas';
import { pixiApp } from '../pixiApp/PixiApp';
import { Coordinate } from '../types/size';

export function selectAllCells(column?: number, row?: number): void {
  const sheet = sheets.sheet;
  let bounds: Coordinate[] | undefined;
  if (row !== undefined) {
    bounds = sheet.getGridRowMinMax(row, true);
  } else if (column !== undefined) {
    bounds = sheet.getGridColumnMinMax(column, true);
  } else {
    bounds = sheet.getMinMax(true);
  }
  if (!bounds) return;
  const cursorPosition = { x: bounds[0].x, y: bounds[0].y };
  if (bounds !== undefined) {
    sheet.cursor.changePosition({
      multiCursor: {
        originPosition: bounds[0],
        terminalPosition: bounds[1],
      },
      cursorPosition,
    });
    pixiApp.viewport.dirty = true;
  }
}

export function selectColumns(options: { start: number; end: number }): void {
  const { sheet } = sheets;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let x = options.start; x <= options.end; x++) {
    const bounds = sheet.getGridColumnMinMax(x, true);
    if (bounds) {
      minX = Math.min(minX, bounds[0].x);
      maxX = Math.max(maxX, bounds[1].x);
      minY = Math.min(minY, bounds[0].y);
      maxY = Math.max(maxY, bounds[1].y);
    }
  }
  if (minX !== Infinity && minY !== Infinity) {
    sheet.cursor.changePosition({
      multiCursor: {
        originPosition: { x: minX, y: minY },
        terminalPosition: { x: maxX, y: maxY },
      },
    });
    pixiApp.viewport.dirty = true;
  }
}

export async function selectRows(options: { start: number; end: number }): Promise<void> {
  const { sheet } = sheets;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let y = options.start; y <= options.end; y++) {
    const bounds = sheet.getGridRowMinMax(y, true);
    if (bounds) {
      minX = Math.min(minX, bounds[0].x);
      maxX = Math.max(maxX, bounds[bounds.length - 1].x);
      minY = Math.min(minY, bounds[0].y);
      maxY = Math.max(maxY, bounds[bounds.length - 1].y);
    }
  }
  if (minX !== Infinity && minY !== Infinity) {
    sheet.cursor.changePosition({
      multiCursor: {
        originPosition: { x: minX, y: minY },
        terminalPosition: { x: maxX, y: maxY },
      },
    });
    pixiApp.viewport.dirty = true;
  }
}

export function cellHasContent(cell?: Cell): boolean {
  if (!cell) return false;
  return !!cell.value || cell.type !== 'TEXT';
}

//! Determines whether a pointer cell move is invalid. This is used to determine
//! whether to show a red border on the moving cells.

import { sheets } from '@/app/grid/controller/Sheets';
import { content } from '@/app/gridGL/pixiApp/Content';
import { Rectangle } from 'pixi.js';

interface TableBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  hasNameRow: boolean;
  isCodeTable: boolean; // true for code tables (Python, JS, etc.), false for data/import tables
  isSingleCell: boolean; // single-cell code cells can be overwritten
}

// Returns whether two rectangles overlap
function rectanglesOverlap(
  x1: number,
  y1: number,
  w1: number,
  h1: number,
  x2: number,
  y2: number,
  w2: number,
  h2: number
): boolean {
  return x1 < x2 + w2 && x1 + w1 > x2 && y1 < y2 + h2 && y1 + h1 > y2;
}

// Gets all tables within a rectangle, returning their bounds
function getTablesInRect(rect: Rectangle): TableBounds[] {
  const tables = content.cellsSheet.tables;
  const result: TableBounds[] = [];

  // Get tables (DataTables with UI)
  const dataTables = tables.getTablesInRect(rect);
  for (const table of dataTables) {
    result.push({
      x: table.codeCell.x,
      y: table.codeCell.y,
      width: table.codeCell.w,
      height: table.codeCell.h,
      hasNameRow: table.codeCell.show_name,
      isCodeTable: table.codeCell.language !== 'Import',
      isSingleCell: false,
    });
  }

  // Get single cell code cells (CellValue::Code) - these can be overwritten by anything
  const singleCellTables = tables.getSingleCellTablesInRectangle(rect);
  for (const codeCell of singleCellTables) {
    result.push({
      x: codeCell.x,
      y: codeCell.y,
      width: 1,
      height: 1,
      hasNameRow: false,
      isCodeTable: false,
      isSingleCell: true,
    });
  }

  return result;
}

// Checks if any part of the destination rect would land on any table (code or data).
// Single-cell tables can be overwritten; all other tables are invalid drop targets.
function wouldOverlapTable(
  destX: number,
  destY: number,
  width: number,
  height: number,
  sourceTables: TableBounds[]
): boolean {
  const destRect = new Rectangle(destX, destY, width, height);
  const destTables = getTablesInRect(destRect);

  for (const destTable of destTables) {
    const isSourceTable = sourceTables.some((src) => src.x === destTable.x && src.y === destTable.y);
    if (isSourceTable) continue;
    if (destTable.isSingleCell) continue;

    if (rectanglesOverlap(destX, destY, width, height, destTable.x, destTable.y, destTable.width, destTable.height)) {
      return true;
    }
  }

  return false;
}

// Checks if any source table would overlap with a destination table
function tablesWouldOverlap(
  sourceTables: TableBounds[],
  destX: number,
  destY: number,
  sourceX: number,
  sourceY: number,
  width: number,
  height: number
): boolean {
  const deltaX = destX - sourceX;
  const deltaY = destY - sourceY;

  // Get the destination rectangle
  const destRect = new Rectangle(destX, destY, width, height);
  const destTables = getTablesInRect(destRect);

  // Filter out destination tables that are:
  // 1. Source tables (they're moving with us)
  // 2. Single-cell tables (they can be overwritten)
  const staticDestTables = destTables.filter(
    (dt) => !dt.isSingleCell && !sourceTables.some((st) => st.x === dt.x && st.y === dt.y)
  );

  // For each source table, check if its new position would overlap with any static dest table
  for (const srcTable of sourceTables) {
    const newX = srcTable.x + deltaX;
    const newY = srcTable.y + deltaY;

    for (const destTable of staticDestTables) {
      // Check if the moved source table overlaps with a destination table
      if (
        rectanglesOverlap(
          newX,
          newY,
          srcTable.width,
          srcTable.height,
          destTable.x,
          destTable.y,
          destTable.width,
          destTable.height
        )
      ) {
        return true;
      }
    }
  }

  return false;
}

// Check if the destination is over a table header (invalid drop zone)
export function checkMoveDestinationInvalid(
  destX: number,
  destY: number,
  width: number,
  height: number,
  colRows: 'columns' | 'rows' | undefined,
  original: Rectangle | undefined
): boolean {
  // Determine the source rectangle
  let sourceX: number;
  let sourceY: number;
  let sourceWidth: number;
  let sourceHeight: number;

  if (colRows === 'columns') {
    // Get the original columns from the cursor selection
    const cols = sheets.sheet.cursor.getContiguousColumns();
    if (!cols || cols.length === 0) return false;
    const bounds = sheets.sheet.bounds;
    const maxRow = bounds.type === 'nonEmpty' ? Number(bounds.max.y) : 1;
    sourceX = cols[0];
    sourceY = 1;
    sourceWidth = cols.length;
    sourceHeight = maxRow;
  } else if (colRows === 'rows') {
    // Get the original rows from the cursor selection
    const rows = sheets.sheet.cursor.getContiguousRows();
    if (!rows || rows.length === 0) return false;
    const bounds = sheets.sheet.bounds;
    const maxCol = bounds.type === 'nonEmpty' ? Number(bounds.max.x) : 1;
    sourceX = 1;
    sourceY = rows[0];
    sourceWidth = maxCol;
    sourceHeight = rows.length;
  } else if (original) {
    sourceX = original.left;
    sourceY = original.top;
    sourceWidth = original.width;
    sourceHeight = original.height;
  } else {
    // Regular cell move: get source from the cursor
    const cursorRect = sheets.sheet.cursor.getSingleRectangleOrCursor();
    if (cursorRect) {
      sourceX = cursorRect.left;
      sourceY = cursorRect.top;
      sourceWidth = cursorRect.width;
      sourceHeight = cursorRect.height;
    } else {
      // Fallback: assume source is at same position as dest with given dimensions
      sourceX = destX;
      sourceY = destY;
      sourceWidth = width;
      sourceHeight = height;
    }
  }

  const sourceRect = new Rectangle(sourceX, sourceY, sourceWidth, sourceHeight);

  // Get tables in the source selection
  const sourceTables = getTablesInRect(sourceRect);

  // Check if any source table would overlap with a destination table
  if (sourceTables.length > 0) {
    if (tablesWouldOverlap(sourceTables, destX, destY, sourceX, sourceY, sourceWidth, sourceHeight)) {
      return true;
    }
  }

  // Do not allow dropping on any table (code or data)
  if (wouldOverlapTable(destX, destY, width, height, sourceTables)) {
    return true;
  }

  return false;
}

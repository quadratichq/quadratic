//! keyboardPosition() handles the movement of the cursor using the arrow keys,
//! including shift, meta, and ctrl keys.

import { Action } from '@/app/actions/actions';
import { sheets } from '@/app/grid/controller/Sheets';
import { htmlCellsHandler } from '@/app/gridGL/HTMLGrid/htmlCells/htmlCellsHandler';
import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { moveViewport } from '@/app/gridGL/interaction/viewportHelper';
import { pixiApp } from '@/app/gridGL/pixiApp/PixiApp';
import { pixiAppSettings } from '@/app/gridGL/pixiApp/PixiAppSettings';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';
import { JumpDirection } from '@/app/quadratic-core-types';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Rectangle } from 'pixi.js';

function setCursorPosition(x: number, y: number) {
  const newPos = { x, y };
  sheets.sheet.cursor.changePosition({
    multiCursor: null,
    columnRow: null,
    cursorPosition: newPos,
    keyboardMovePosition: newPos,
    ensureVisible: newPos,
  });
}

// todo: The QuadraticCore checks should be a single call within Rust instead of
// having TS handle the logic (this will reduce the number of calls into
// quadraticCore)

// handle cases for meta/ctrl keys with algorithm:
// - if on an empty cell then select to the first cell with a value
// - if on a filled cell then select to the cell before the next empty cell
// - if on a filled cell but the next cell is empty then select to the first cell with a value
// - if there are no more cells then select the next cell over (excel selects to the end of the sheet; we don’t have an end (yet) so right now I select one cell over)
//   the above checks are always made relative to the original cursor position (the highlighted cell)
async function jumpCursor(direction: JumpDirection, select: boolean) {
  const cursor = sheets.sheet.cursor;
  const sheetId = sheets.sheet.id;

  // holds either the existing multiCursor or creates a new one based on cursor position
  const multiCursor = cursor.multiCursor ?? [new Rectangle(cursor.cursorPosition.x, cursor.cursorPosition.y, 1, 1)];

  // the last multiCursor entry, which is what we change with the keyboard
  const lastMultiCursor = multiCursor[multiCursor.length - 1];
  const keyboardX = cursor.keyboardMovePosition.x;
  const keyboardY = cursor.keyboardMovePosition.y;

  const position = await quadraticCore.jumpCursor(sheetId, { x: keyboardX, y: keyboardY }, direction);

  // something went wrong
  if (!position) return;

  if (select) {
    lastMultiCursor.x = Math.min(cursor.cursorPosition.x, position.x);
    lastMultiCursor.y = Math.min(cursor.cursorPosition.y, position.y);
    lastMultiCursor.height = Math.abs(cursor.cursorPosition.y - position.y) + 1;
    cursor.changePosition({
      multiCursor,
      keyboardMovePosition: { x: position.x, y: position.y },
      ensureVisible: { x: lastMultiCursor.x, y: lastMultiCursor.y },
    });
  } else {
    setCursorPosition(position.x, position.y);
  }

  /*

  if (deltaX === 1) {
    let x = keyboardX;
    const y = cursor.keyboardMovePosition.y;

    // adjust the jump position if it is inside an image or html cell
    const image = pixiApp.cellsSheet().cellsImages.findCodeCell(x, y);
    if (image) {
      x = image.gridBounds.x + image.gridBounds.width - 1;
    } else {
      const html = htmlCellsHandler.findCodeCell(x, y);
      if (html) {
        x = html.gridBounds.x + html.gridBounds.width;
      }
    }

    // always use the original cursor position to search
    const yCheck = cursor.cursorPosition.y;
    // handle case of cell with content
    let nextCol: number | undefined = undefined;
    if (await quadraticCore.cellHasContent(sheetId, x, yCheck)) {
      // if next cell is empty, find the next cell with content
      if (!(await quadraticCore.cellHasContent(sheetId, x + 1, yCheck))) {
        nextCol = await quadraticCore.findNextColumn({
          sheetId,
          columnStart: x + 2,
          row: yCheck,
          reverse: false,
          withContent: true,
        });
      }
      // if next cell is not empty, find the next empty cell
      else {
        nextCol =
          ((await quadraticCore.findNextColumn({
            sheetId,
            columnStart: x + 2,
            row: yCheck,
            reverse: false,
            withContent: false,
          })) ?? x + 2) - 1;
      }
    }
    // otherwise find the next cell with content
    else {
      nextCol = await quadraticCore.findNextColumn({
        sheetId,
        columnStart: x + 1,
        row: yCheck,
        reverse: false,
        withContent: true,
      });
    }
    if (nextCol === undefined) {
      nextCol = x < 0 ? 0 : x + 1;
    }

    x = nextCol;
    if (keyboardX < -1) {
      x = Math.min(x, -1);
    }
    if (x === keyboardX) x++;
    if (select) {
      lastMultiCursor.x = Math.min(cursor.cursorPosition.x, x);
      lastMultiCursor.width = Math.abs(cursor.cursorPosition.x - x) + 1;
      cursor.changePosition({
        multiCursor,
        keyboardMovePosition: { x, y },
        ensureVisible: { x: lastMultiCursor.right, y },
      });
    } else {
      setCursorPosition(x, y);
    }
  } else if (deltaX === -1) {
    let x = keyboardX;
    const y = cursor.keyboardMovePosition.y;

    // adjust the jump position if it is inside an image or html cell
    const image = pixiApp.cellsSheet().cellsImages.findCodeCell(x, y);
    if (image) {
      x = image.gridBounds.x - 1;
    } else {
      const html = htmlCellsHandler.findCodeCell(x, y);
      if (html) {
        x = html.gridBounds.x - 1;
      }
    }

    // always use the original cursor position to search
    const yCheck = cursor.cursorPosition.y;
    // handle case of cell with content
    let nextCol: number | undefined = undefined;
    if (await quadraticCore.cellHasContent(sheetId, x, yCheck)) {
      // if next cell is empty, find the next cell with content
      if (!(await quadraticCore.cellHasContent(sheetId, x - 1, yCheck))) {
        nextCol = await quadraticCore.findNextColumn({
          sheetId,
          columnStart: x - 2,
          row: yCheck,
          reverse: true,
          withContent: true,
        });
      }
      // if next cell is not empty, find the next empty cell
      else {
        nextCol =
          ((await quadraticCore.findNextColumn({
            sheetId,
            columnStart: x - 2,
            row: yCheck,
            reverse: true,
            withContent: false,
          })) ?? x - 2) + 1;
      }
    }
    // otherwise find the next cell with content
    else {
      nextCol = await quadraticCore.findNextColumn({
        sheetId,
        columnStart: x - 1,
        row: yCheck,
        reverse: true,
        withContent: true,
      });
    }
    if (nextCol === undefined) {
      nextCol = x > 0 ? 0 : x - 1;
    }
    x = nextCol;
    if (keyboardX > 0) {
      x = Math.max(x, 0);
    }
    if (x === keyboardX) x--;
    if (select) {
      lastMultiCursor.x = Math.min(cursor.cursorPosition.x, x);
      lastMultiCursor.width = Math.abs(cursor.cursorPosition.x - x) + 1;
      cursor.changePosition({
        multiCursor,
        keyboardMovePosition: { x, y },
        ensureVisible: { x: lastMultiCursor.x, y },
      });
    } else {
      setCursorPosition(x, y);
    }
  } else if (deltaY === 1) {
    let y = keyboardY;
    const x = cursor.keyboardMovePosition.x;
    // always use the original cursor position to search
    const xCheck = cursor.cursorPosition.x;
    // handle case of cell with content
    let nextRow: number | undefined = undefined;
    if (await quadraticCore.cellHasContent(sheetId, xCheck, y)) {
      // if next cell is empty, find the next cell with content
      if (!(await quadraticCore.cellHasContent(sheetId, xCheck, y + 1))) {
        nextRow = await quadraticCore.findNextRow({
          sheetId,
          column: xCheck,
          rowStart: y + 2,
          reverse: false,
          withContent: true,
        });
      }
      // if next cell is not empty, find the next empty cell
      else {
        nextRow =
          ((await quadraticCore.findNextRow({
            sheetId,
            column: xCheck,
            rowStart: y + 2,
            reverse: false,
            withContent: false,
          })) ?? y + 2) - 1;
      }
    }
    // otherwise find the next cell with content
    else {
      nextRow = await quadraticCore.findNextRow({
        sheetId,
        column: xCheck,
        rowStart: y + 1,
        reverse: false,
        withContent: true,
      });
    }
    if (nextRow === undefined) {
      nextRow = y < 0 ? 0 : y + 1;
    }
    y = nextRow;
    if (keyboardY < -1) {
      y = Math.min(y, -1);
    }
    if (y === keyboardY) y++;
    if (select) {
      lastMultiCursor.y = Math.min(cursor.cursorPosition.y, y);
      lastMultiCursor.height = Math.abs(cursor.cursorPosition.y - y) + 1;
      cursor.changePosition({
        multiCursor,
        keyboardMovePosition: { x, y },
        ensureVisible: { x, y: lastMultiCursor.bottom },
      });
    } else {
      setCursorPosition(x, y);
    }
  } else if (deltaY === -1) {
    let y = keyboardY;
    const x = cursor.keyboardMovePosition.x;
    // always use the original cursor position to search
    const xCheck = cursor.cursorPosition.x;
    // handle case of cell with content
    let nextRow: number | undefined = undefined;
    if (await quadraticCore.cellHasContent(sheetId, xCheck, y)) {
      // if next cell is empty, find the next cell with content
      if (!(await quadraticCore.cellHasContent(sheetId, xCheck, y - 1))) {
        nextRow = await quadraticCore.findNextRow({
          sheetId,
          column: xCheck,
          rowStart: y - 2,
          reverse: true,
          withContent: true,
        });
      }
      // if next cell is not empty, find the next empty cell
      else {
        nextRow =
          ((await quadraticCore.findNextRow({
            sheetId,
            column: xCheck,
            rowStart: y - 2,
            reverse: true,
            withContent: false,
          })) ?? y - 2) + 1;
      }
    }
    // otherwise find the next cell with content
    else {
      nextRow = await quadraticCore.findNextRow({
        sheetId,
        column: xCheck,
        rowStart: y - 1,
        reverse: true,
        withContent: true,
      });
    }
    if (nextRow === undefined) {
      nextRow = y > 0 ? 0 : y - 1;
    }
    y = nextRow;
    if (keyboardY > 0) {
      y = Math.max(y, 0);
    }
    if (y === keyboardY) y--;

*/
}

// use arrow to select when shift key is pressed
function expandSelection(deltaX: number, deltaY: number) {
  const cursor = sheets.sheet.cursor;

  const downPosition = cursor.cursorPosition;
  const movePosition = cursor.keyboardMovePosition;

  // holds either the existing multiCursor or creates a new one based on cursor position
  const multiCursor = cursor.multiCursor ?? [new Rectangle(cursor.cursorPosition.x, cursor.cursorPosition.y, 1, 1)];

  // the last multiCursor entry, which is what we change with the keyboard
  const lastMultiCursor = multiCursor[multiCursor.length - 1];

  const newMovePosition = { x: movePosition.x + deltaX, y: movePosition.y + deltaY };
  lastMultiCursor.x = downPosition.x < newMovePosition.x ? downPosition.x : newMovePosition.x;
  lastMultiCursor.y = downPosition.y < newMovePosition.y ? downPosition.y : newMovePosition.y;
  lastMultiCursor.width = Math.abs(newMovePosition.x - downPosition.x) + 1;
  lastMultiCursor.height = Math.abs(newMovePosition.y - downPosition.y) + 1;
  cursor.changePosition({
    columnRow: null,
    multiCursor,
    keyboardMovePosition: newMovePosition,
    ensureVisible: { x: newMovePosition.x, y: newMovePosition.y },
  });
  if (!inlineEditorHandler.cursorIsMoving) {
    pixiAppSettings.changeInput(false);
  }
}

function moveCursor(deltaX: number, deltaY: number) {
  const cursor = sheets.sheet.cursor;
  const newPos = { x: cursor.cursorPosition.x + deltaX, y: cursor.cursorPosition.y + deltaY };

  // need to adjust the cursor position if it is inside an image cell
  const image = pixiApp.cellsSheet().cellsImages.findCodeCell(newPos.x, newPos.y);
  if (image) {
    if (deltaX === 1) {
      if (newPos.x !== image.gridBounds.x) {
        newPos.x = image.gridBounds.x + image.gridBounds.width;
      }
    } else if (deltaX === -1) {
      if (newPos.x !== image.gridBounds.x + image.gridBounds.width - 1) {
        newPos.x = image.gridBounds.x - 1;
      }
    }
    if (deltaY === 1) {
      if (newPos.y !== image.gridBounds.y) {
        newPos.y = image.gridBounds.y + image.gridBounds.height;
      }
    } else if (deltaY === -1) {
      if (newPos.y !== image.gridBounds.y + image.gridBounds.height - 1) {
        newPos.y = image.gridBounds.y - 1;
      }
    }
  }

  // if the cursor is inside an html cell, move the cursor to the top left of the cell
  const html = htmlCellsHandler.findCodeCell(newPos.x, newPos.y);
  if (html) {
    if (deltaX === 1) {
      if (newPos.x !== html.gridBounds.x) {
        newPos.x = html.gridBounds.x + html.gridBounds.width + 1;
      }
    } else if (deltaX === -1) {
      if (newPos.x !== html.gridBounds.x + html.gridBounds.width) {
        newPos.x = html.gridBounds.x - 1;
      }
    }
    if (deltaY === 1) {
      if (newPos.y !== html.gridBounds.y) {
        newPos.y = html.gridBounds.y + html.gridBounds.height + 1;
      }
    } else if (deltaY === -1) {
      if (newPos.y !== html.gridBounds.y + html.gridBounds.height) {
        newPos.y = html.gridBounds.y - 1;
      }
    }
  }
  cursor.changePosition({
    columnRow: null,
    multiCursor: null,
    keyboardMovePosition: newPos,
    cursorPosition: newPos,
  });
}

export function keyboardPosition(event: KeyboardEvent): boolean {
  // Move cursor up
  if (matchShortcut(Action.MoveCursorUp, event)) {
    moveCursor(0, -1);
    return true;
  }

  // Move cursor to the top of the content block of cursor cell
  if (matchShortcut(Action.JumpCursorContentTop, event)) {
    jumpCursor('Up', false);
    return true;
  }

  // Expand selection up
  if (matchShortcut(Action.ExpandSelectionUp, event)) {
    expandSelection(0, -1);
    return true;
  }

  // Expand selection to the top of the content block of cursor cell
  if (matchShortcut(Action.ExpandSelectionContentTop, event)) {
    jumpCursor('Down', true);
    return true;
  }

  // Move cursor down
  if (matchShortcut(Action.MoveCursorDown, event)) {
    moveCursor(0, 1);
    return true;
  }

  // Move cursor to the bottom of the content block of cursor cell
  if (matchShortcut(Action.JumpCursorContentBottom, event)) {
    jumpCursor('Down', false);
    return true;
  }

  // Expand selection down
  if (matchShortcut(Action.ExpandSelectionDown, event)) {
    expandSelection(0, 1);
    return true;
  }

  // Expand selection to the bottom of the content block of cursor cell
  if (matchShortcut(Action.ExpandSelectionContentBottom, event)) {
    jumpCursor('Down', true);
    return true;
  }

  // Move cursor left
  if (matchShortcut(Action.MoveCursorLeft, event)) {
    moveCursor(-1, 0);
    return true;
  }

  // Move cursor to the left of the content block of cursor cell
  if (matchShortcut(Action.JumpCursorContentLeft, event)) {
    jumpCursor('Left', false);
    return true;
  }

  // Expand selection left
  if (matchShortcut(Action.ExpandSelectionLeft, event)) {
    expandSelection(-1, 0);
    return true;
  }

  // Expand selection to the left of the content block of cursor cell
  if (matchShortcut(Action.ExpandSelectionContentLeft, event)) {
    jumpCursor('Left', true);
    return true;
  }

  // Move cursor right
  if (matchShortcut(Action.MoveCursorRight, event)) {
    moveCursor(1, 0);
    return true;
  }

  // Move cursor to the right of the content block of cursor cell
  if (matchShortcut(Action.JumpCursorContentRight, event)) {
    jumpCursor('Right', false);
    return true;
  }

  // Expand selection right
  if (matchShortcut(Action.ExpandSelectionRight, event)) {
    expandSelection(1, 0);
    return true;
  }

  // Expand selection to the right of the content block of cursor cell
  if (matchShortcut(Action.ExpandSelectionContentRight, event)) {
    jumpCursor('Right', true);
    return true;
  }

  // Move cursor to A0, reset viewport position with A0 at top left
  if (matchShortcut(Action.GotoA0, event)) {
    setCursorPosition(0, 0);
    moveViewport({ topLeft: { x: 0, y: 0 }, force: true });
    return true;
  }

  // Move cursor to the bottom right of the sheet content
  if (matchShortcut(Action.GotoBottomRight, event)) {
    const sheet = sheets.sheet;
    const bounds = sheet.getBounds(true);
    if (bounds) {
      setCursorPosition(bounds.right, bounds.bottom);
    } else {
      setCursorPosition(1, 1);
    }
    return true;
  }

  // Move cursor to the start of the row content
  if (matchShortcut(Action.GotoRowStart, event)) {
    setCursorPosition(1, sheets.sheet.cursor.cursorPosition.y);
    return true;
  }

  // Move cursor to the end of the row content
  if (matchShortcut(Action.GotoRowEnd, event)) {
    const sheet = sheets.sheet;
    const bounds = sheet.getBounds(true);
    setCursorPosition(bounds?.right ?? 1, sheets.sheet.cursor.cursorPosition.y);
    return true;
  }

  // Move viewport up
  if (matchShortcut(Action.PageUp, event)) {
    moveViewport({ pageUp: true });
    return true;
  }

  // Move viewport down
  if (matchShortcut(Action.PageDown, event)) {
    moveViewport({ pageDown: true });
    return true;
  }

  return false;
}

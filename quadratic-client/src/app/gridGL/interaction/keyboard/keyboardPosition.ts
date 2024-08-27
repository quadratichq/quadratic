//! keyboardPosition() handles the movement of the cursor using the arrow keys,
//! including shift, meta, and ctrl keys.

import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { moveViewport } from '@/app/gridGL/interaction/viewportHelper';
import { matchShortcut } from '@/app/helpers/keyboardShortcuts.js';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Rectangle } from 'pixi.js';
import { sheets } from '../../../grid/controller/Sheets';
import { pixiAppSettings } from '../../pixiApp/PixiAppSettings';
import { intersects } from '../../helpers/intersects';

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

// handle cases for meta/ctrl keys with algorithm:
// - if on an empty cell then select to the first cell with a value
// - if on a filled cell then select to the cell before the next empty cell
// - if on a filled cell but the next cell is empty then select to the first cell with a value
// - if there are no more cells then select the next cell over or if there is a sheetSize boundary, select to the boundary
//   the above checks are always made relative to the original cursor position (the highlighted cell)
// all moves are clamped by the sheetInfo.sheetSize
async function jumpCursor(deltaX: number, deltaY: number, select: boolean) {
  const cursor = sheets.sheet.cursor;
  const sheetId = sheets.sheet.id;

  // holds either the existing multiCursor or creates a new one based on cursor position
  const multiCursor = cursor.multiCursor ?? [new Rectangle(cursor.cursorPosition.x, cursor.cursorPosition.y, 1, 1)];

  // the last multiCursor entry, which is what we change with the keyboard
  const lastMultiCursor = multiCursor[multiCursor.length - 1];
  const keyboardX = cursor.keyboardMovePosition.x;
  const keyboardY = cursor.keyboardMovePosition.y;

  const sheetSize = sheets.sheet.getCellSheetSize();

  if (deltaX === 1) {
    let x = keyboardX;

    // make sure we don't go beyond the bounds (unless we are already beyond the
    // bounds, in which case we allow the cursor to move anywhere)
    if (!isOutOfBounds()) {
      if (x === sheetSize.right) return;
      if (x > sheetSize.right) {
        cursor.changePosition({
          cursorPosition: { x: sheetSize.right, y: keyboardY },
          ensureVisible: true,
        });
        return;
      } else if (x < 0) {
        cursor.changePosition({
          cursorPosition: { x: 0, y: keyboardY },
          ensureVisible: true,
        });
        return;
      }
    }

    const y = cursor.keyboardMovePosition.y;
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

    // make sure we don't go beyond the bounds (unless we are already beyond the
    // bounds, in which case we allow the cursor to move anywhere)
    if (!isOutOfBounds()) {
      if (x === 0) return;
      if (x < 0) {
        cursor.changePosition({
          cursorPosition: { x: 0, y: keyboardY },
          ensureVisible: true,
        });
        return;
      } else if (x > sheetSize.right) {
        cursor.changePosition({
          cursorPosition: { x: sheetSize.right, y: keyboardY },
          ensureVisible: true,
        });
        return;
      }
    }

    const y = cursor.keyboardMovePosition.y;
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

    // make sure we don't go beyond the bounds (unless we are already beyond the
    // bounds, in which case we allow the cursor to move anywhere)
    if (!isOutOfBounds()) {
      if (y === sheetSize.bottom) return;
      if (y > sheetSize.bottom) {
        cursor.changePosition({
          cursorPosition: { x: keyboardX, y: sheetSize.bottom },
          ensureVisible: true,
        });
        return;
      } else if (y < 0) {
        cursor.changePosition({
          cursorPosition: { x: keyboardX, y: 0 },
          ensureVisible: true,
        });
        return;
      }
    }

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

    // make sure we don't go beyond the bounds (unless we are already beyond the
    // bounds, in which case we allow the cursor to move anywhere)
    if (!isOutOfBounds()) {
      if (y === 0) return;
      if (y < 0) {
        cursor.changePosition({
          cursorPosition: { x: keyboardX, y: 0 },
          ensureVisible: true,
        });
        return;
      } else if (y > sheetSize.bottom) {
        cursor.changePosition({
          cursorPosition: { x: keyboardX, y: sheetSize.bottom },
          ensureVisible: true,
        });
        return;
      }
    }

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
    if (select) {
      lastMultiCursor.y = Math.min(cursor.cursorPosition.y, y);
      lastMultiCursor.height = Math.abs(cursor.cursorPosition.y - y) + 1;
      cursor.changePosition({
        multiCursor,
        keyboardMovePosition: { x, y },
        ensureVisible: { x, y: lastMultiCursor.y },
      });
    } else {
      setCursorPosition(x, y);
    }
  }
}

/// whether the cursor is out of bounds
function isOutOfBounds() {
  const cursor = sheets.sheet.cursor;

  // we also need to check if any multiCursor are out of bounds
  if (cursor.multiCursor) {
    for (const multiCursor of cursor.multiCursor) {
      if (!intersects.rectangleRectangle(multiCursor, sheets.sheet.getCellSheetSize())) {
        return true;
      }
    }
  }
  const cursorPosition = cursor.cursorPosition;
  const sheetSize = sheets.sheet.getCellSheetSize();
  return (
    cursorPosition.x < 0 ||
    cursorPosition.x > sheetSize.right ||
    cursorPosition.y < 0 ||
    cursorPosition.y > sheetSize.bottom
  );
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

  // if out of bounds, allow expansion of selection anywhere; otherwise clamp to sheetSize
  const sheetSize = sheets.sheet.getCellSheetSize();
  if (
    !isOutOfBounds() &&
    (movePosition.x + deltaX < 0 ||
      movePosition.x + deltaY > sheetSize.right ||
      movePosition.y + deltaY < 0 ||
      movePosition.y + deltaY > sheetSize.bottom)
  ) {
    return;
  }
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
  if (isOutOfBounds() || intersects.rectanglePoint(sheets.sheet.getCellSheetSize(), newPos)) {
    cursor.changePosition({
      columnRow: null,
      multiCursor: null,
      keyboardMovePosition: newPos,
      cursorPosition: newPos,
    });
  }

  // handle when cursor is out of bounds
  else {
    if (deltaX && cursor.cursorPosition.x + deltaX < 0) {
      cursor.changePosition({
        cursorPosition: { x: 0, y: cursor.cursorPosition.y },
        ensureVisible: true,
      });
    } else if (deltaX && cursor.cursorPosition.x + deltaX > sheets.sheet.getCellSheetSize().right) {
      cursor.changePosition({
        cursorPosition: { x: sheets.sheet.getCellSheetSize().right, y: cursor.cursorPosition.y },
        ensureVisible: true,
      });
    }
    if (deltaY && cursor.cursorPosition.y + deltaY < 0) {
      cursor.changePosition({
        cursorPosition: { x: cursor.cursorPosition.x, y: 0 },
        ensureVisible: true,
      });
    } else if (deltaY && cursor.cursorPosition.y + deltaY > sheets.sheet.getCellSheetSize().bottom) {
      cursor.changePosition({
        cursorPosition: { x: cursor.cursorPosition.x, y: sheets.sheet.getCellSheetSize().bottom },
        ensureVisible: true,
      });
    }
  }
}

export function keyboardPosition(event: KeyboardEvent): boolean {
  // Move cursor up
  if (matchShortcut('move_cursor_up', event)) {
    moveCursor(0, -1);
    return true;
  }

  // Move cursor to the top of the content block of cursor cell
  if (matchShortcut('jump_cursor_content_top', event)) {
    jumpCursor(0, -1, false);
    return true;
  }

  // Expand selection up
  if (matchShortcut('expand_selection_up', event)) {
    expandSelection(0, -1);
    return true;
  }

  // Expand selection to the top of the content block of cursor cell
  if (matchShortcut('expand_selection_content_top', event)) {
    jumpCursor(0, -1, true);
    return true;
  }

  // Move cursor down
  if (matchShortcut('move_cursor_down', event)) {
    moveCursor(0, 1);
    return true;
  }

  // Move cursor to the bottom of the content block of cursor cell
  if (matchShortcut('jump_cursor_content_bottom', event)) {
    jumpCursor(0, 1, false);
    return true;
  }

  // Expand selection down
  if (matchShortcut('expand_selection_down', event)) {
    expandSelection(0, 1);
    return true;
  }

  // Expand selection to the bottom of the content block of cursor cell
  if (matchShortcut('expand_selection_content_bottom', event)) {
    jumpCursor(0, 1, true);
    return true;
  }

  // Move cursor left
  if (matchShortcut('move_cursor_left', event)) {
    moveCursor(-1, 0);
    return true;
  }

  // Move cursor to the left of the content block of cursor cell
  if (matchShortcut('jump_cursor_content_left', event)) {
    jumpCursor(-1, 0, false);
    return true;
  }

  // Expand selection left
  if (matchShortcut('expand_selection_left', event)) {
    expandSelection(-1, 0);
    return true;
  }

  // Expand selection to the left of the content block of cursor cell
  if (matchShortcut('expand_selection_content_left', event)) {
    jumpCursor(-1, 0, true);
    return true;
  }

  // Move cursor right
  if (matchShortcut('move_cursor_right', event)) {
    moveCursor(1, 0);
    return true;
  }

  // Move cursor to the right of the content block of cursor cell
  if (matchShortcut('jump_cursor_content_right', event)) {
    jumpCursor(1, 0, false);
    return true;
  }

  // Expand selection right
  if (matchShortcut('expand_selection_right', event)) {
    expandSelection(1, 0);
    return true;
  }

  // Expand selection to the right of the content block of cursor cell
  if (matchShortcut('expand_selection_content_right', event)) {
    jumpCursor(1, 0, true);
    return true;
  }

  // Move cursor to A0, reset viewport position with A0 at top left
  if (matchShortcut('goto_A0', event)) {
    setCursorPosition(0, 0);
    moveViewport({ topLeft: { x: 0, y: 0 }, force: true });
    return true;
  }

  // Move cursor to the bottom right of the sheet content
  if (matchShortcut('goto_bottom_right', event)) {
    const sheet = sheets.sheet;
    const bounds = sheet.getBounds(true);
    if (bounds) {
      const y = bounds.bottom;
      quadraticCore
        .findNextColumn({
          sheetId: sheet.id,
          columnStart: bounds.right,
          row: y,
          reverse: true,
          withContent: true,
        })
        .then((x) => {
          x = x ?? bounds.right;
          setCursorPosition(x, y);
        });
    }
    return true;
  }

  // Move cursor to the start of the row content
  if (matchShortcut('goto_row_start', event)) {
    const sheet = sheets.sheet;
    const bounds = sheet.getBounds(true);
    if (bounds) {
      const y = sheet.cursor.cursorPosition.y;
      quadraticCore
        .findNextColumn({
          sheetId: sheet.id,
          columnStart: bounds.left,
          row: y,
          reverse: false,
          withContent: true,
        })
        .then((x) => {
          x = x ?? bounds.left;
          quadraticCore.cellHasContent(sheet.id, x, y).then((hasContent) => {
            if (hasContent) {
              setCursorPosition(x, y);
            }
          });
        });
    }
    return true;
  }

  // Move cursor to the end of the row content
  if (matchShortcut('goto_row_end', event)) {
    const sheet = sheets.sheet;
    const bounds = sheet.getBounds(true);
    if (bounds) {
      const y = sheet.cursor.cursorPosition.y;
      quadraticCore
        .findNextColumn({
          sheetId: sheet.id,
          columnStart: bounds.right,
          row: y,
          reverse: true,
          withContent: true,
        })
        .then((x) => {
          x = x ?? bounds.right;
          quadraticCore.cellHasContent(sheet.id, x, y).then((hasContent) => {
            if (hasContent) {
              setCursorPosition(x, y);
            }
          });
        });
    }
    return true;
  }

  // Move viewport up
  if (matchShortcut('page_up', event)) {
    moveViewport({ pageUp: true });
    return true;
  }

  // Move viewport down
  if (matchShortcut('page_down', event)) {
    moveViewport({ pageDown: true });
    return true;
  }

  return false;
}

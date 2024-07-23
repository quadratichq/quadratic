//! keyboardPosition() handles the movement of the cursor using the arrow keys,
//! including shift, meta, and ctrl keys.

import { inlineEditorHandler } from '@/app/gridGL/HTMLGrid/inlineEditor/inlineEditorHandler';
import { moveViewport } from '@/app/gridGL/interaction/viewportHelper';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';
import { Rectangle } from 'pixi.js';
import { sheets } from '../../../grid/controller/Sheets';
import { pixiAppSettings } from '../../pixiApp/PixiAppSettings';

function setCursorPosition(x: number, y: number) {
  const newPos = { x, y };
  sheets.sheet.cursor.changePosition({
    cursorPosition: newPos,
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
async function handleMetaCtrl(event: KeyboardEvent, deltaX: number, deltaY: number) {
  const cursor = sheets.sheet.cursor;
  const sheetId = sheets.sheet.id;

  // holds either the existing multiCursor or creates a new one based on cursor position
  const multiCursor = cursor.multiCursor ?? [new Rectangle(cursor.cursorPosition.x, cursor.cursorPosition.y, 1, 1)];

  // the last multiCursor entry, which is what we change with the keyboard
  const lastMultiCursor = multiCursor[multiCursor.length - 1];
  const keyboardX = cursor.keyboardMovePosition.x;
  const keyboardY = cursor.keyboardMovePosition.y;

  if (deltaX === 1) {
    let x = keyboardX;
    const y = cursor.keyboardMovePosition.y;
    // always use the original cursor position to search
    const yCheck = cursor.cursorPosition.y;
    // handle case of cell with content
    if (await quadraticCore.cellHasContent(sheetId, x, yCheck)) {
      // if next cell is empty, find the next cell with content
      if (!(await quadraticCore.cellHasContent(sheetId, x + 1, yCheck))) {
        x = await quadraticCore.findNextColumn({
          sheetId,
          columnStart: x + 1,
          row: yCheck,
          reverse: false,
          withContent: true,
        });
      }
      // if next cell is not empty, find the next empty cell
      else {
        x =
          (await quadraticCore.findNextColumn({
            sheetId,
            columnStart: x + 1,
            row: yCheck,
            reverse: false,
            withContent: false,
          })) - 1;
      }
    }
    // otherwise find the next cell with content
    else {
      x = await quadraticCore.findNextColumn({
        sheetId,
        columnStart: x + 1,
        row: yCheck,
        reverse: false,
        withContent: true,
      });
      if (x === keyboardX) x++;
    }
    if (event.shiftKey) {
      lastMultiCursor.x = cursor.cursorPosition.x;
      lastMultiCursor.width = x - cursor.cursorPosition.x + 1;
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

    // always use the original cursor position to search
    const yCheck = cursor.cursorPosition.y;

    // handle case of cell with content
    if (await quadraticCore.cellHasContent(sheetId, x, yCheck)) {
      // if next cell is empty, find the next cell with content
      if (!(await quadraticCore.cellHasContent(sheetId, x - 1, yCheck))) {
        x = await quadraticCore.findNextColumn({
          sheetId,
          columnStart: x - 1,
          row: yCheck,
          reverse: true,
          withContent: true,
        });
      }

      // if next cell is not empty, find the next empty cell
      else {
        x =
          (await quadraticCore.findNextColumn({
            sheetId,
            columnStart: x - 1,
            row: yCheck,
            reverse: true,
            withContent: false,
          })) + 1;
      }
    }

    // otherwise find the next cell with content
    else {
      x = await quadraticCore.findNextColumn({
        sheetId,
        columnStart: x - 1,
        row: yCheck,
        reverse: true,
        withContent: true,
      });
    }
    if (event.shiftKey) {
      lastMultiCursor.x = x;
      lastMultiCursor.width = cursor.cursorPosition.x - x + 1;
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
    if (await quadraticCore.cellHasContent(sheetId, xCheck, y)) {
      // if next cell is empty, find the next cell with content
      if (!(await quadraticCore.cellHasContent(sheetId, xCheck, y + 1))) {
        y = await quadraticCore.findNextRow({
          sheetId,
          column: xCheck,
          rowStart: y + 1,
          reverse: false,
          withContent: true,
        });
      }
      // if next cell is not empty, find the next empty cell
      else {
        y =
          (await quadraticCore.findNextRow({
            sheetId,
            column: xCheck,
            rowStart: y + 1,
            reverse: false,
            withContent: false,
          })) - 1;
      }
    }
    // otherwise find the next cell with content
    else {
      y = await quadraticCore.findNextRow({
        sheetId,
        column: xCheck,
        rowStart: y + 1,
        reverse: false,
        withContent: true,
      });
      if (y === keyboardY) y++;
    }
    if (event.shiftKey) {
      lastMultiCursor.y = cursor.cursorPosition.y;
      lastMultiCursor.height = y - cursor.cursorPosition.y + 1;
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
    if (await quadraticCore.cellHasContent(sheetId, xCheck, y)) {
      // if next cell is empty, find the next cell with content
      if (!(await quadraticCore.cellHasContent(sheetId, xCheck, y - 1))) {
        y = await quadraticCore.findNextRow({
          sheetId,
          column: xCheck,
          rowStart: y - 1,
          reverse: true,
          withContent: true,
        });
      }
      // if next cell is not empty, find the next empty cell
      else {
        y =
          (await quadraticCore.findNextRow({
            sheetId,
            column: xCheck,
            rowStart: y - 1,
            reverse: true,
            withContent: false,
          })) + 1;
      }
    }
    // otherwise find the next cell with content
    else {
      y = await quadraticCore.findNextRow({
        sheetId,
        column: xCheck,
        rowStart: y - 1,
        reverse: true,
        withContent: true,
      });
    }
    if (event.shiftKey) {
      lastMultiCursor.y = y;
      lastMultiCursor.height = cursor.cursorPosition.y - y + 1;
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

// use arrow to select when shift key is pressed
function handleShiftKey(deltaX: number, deltaY: number) {
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

const handleHomeKey = async (event: KeyboardEvent) => {
  const sheet = sheets.sheet;
  if (event.metaKey || event.ctrlKey) {
    setCursorPosition(0, 0);
    moveViewport({ topLeft: { x: 0, y: 0 }, force: true });
  } else {
    const bounds = sheet.getBounds(true);
    if (!bounds) return;

    const y = sheet.cursor.cursorPosition.y;
    const x = await quadraticCore.findNextColumn({
      sheetId: sheet.id,
      columnStart: bounds.left,
      row: y,
      reverse: false,
      withContent: true,
    });

    const hasContent = await quadraticCore.cellHasContent(sheet.id, x, y);
    if (hasContent) {
      setCursorPosition(x, y);
    }
  }
};

const handleEndKey = async (event: KeyboardEvent) => {
  const sheet = sheets.sheet;
  const bounds = sheet.getBounds(true);
  if (!bounds) return;

  if (event.metaKey || event.ctrlKey) {
    const y = bounds.bottom;
    const x = await quadraticCore.findNextColumn({
      sheetId: sheet.id,
      columnStart: bounds.right,
      row: y,
      reverse: true,
      withContent: true,
    });
    setCursorPosition(x, y);
  } else {
    const y = sheet.cursor.cursorPosition.y;
    const x = await quadraticCore.findNextColumn({
      sheetId: sheet.id,
      columnStart: bounds.right,
      row: y,
      reverse: true,
      withContent: true,
    });

    const hasContent = await quadraticCore.cellHasContent(sheet.id, x, y);
    if (hasContent) {
      setCursorPosition(x, y);
    }
  }
};

function handleNormal(deltaX: number, deltaY: number) {
  const cursor = sheets.sheet.cursor;
  const newPos = { x: cursor.cursorPosition.x + deltaX, y: cursor.cursorPosition.y + deltaY };
  cursor.changePosition({
    columnRow: null,
    multiCursor: null,
    keyboardMovePosition: newPos,
    cursorPosition: newPos,
  });
}

async function moveCursor(event: KeyboardEvent, deltaX: number, deltaY: number) {
  // needed since we call await to get ranges, and without this, the browser
  // will navigate while async is pending
  event.preventDefault();

  if (event.metaKey || event.ctrlKey) {
    await handleMetaCtrl(event, deltaX, deltaY);
  } else if (event.shiftKey) {
    handleShiftKey(deltaX, deltaY);
  } else {
    handleNormal(deltaX, deltaY);
  }
}

export async function keyboardPosition(event: KeyboardEvent): Promise<boolean> {
  switch (event.key) {
    case 'ArrowUp':
      await moveCursor(event, 0, -1);
      return true;
    case 'ArrowRight':
      await moveCursor(event, 1, 0);
      return true;
    case 'ArrowLeft':
      await moveCursor(event, -1, 0);
      return true;
    case 'ArrowDown':
      await moveCursor(event, 0, 1);
      return true;
    case 'Home':
      handleHomeKey(event);
      return true;
    case 'End':
      handleEndKey(event);
      return true;
    case 'PageUp':
      moveViewport({ pageUp: true });
      return true;
    case 'PageDown':
      moveViewport({ pageDown: true });
      return true;
  }
  return false;
}

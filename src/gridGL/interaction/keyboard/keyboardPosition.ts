import { grid } from '../../../grid/controller/Grid';
import { sheets } from '../../../grid/controller/Sheets';
import { pixiAppSettings } from '../../pixiApp/PixiAppSettings';

export function keyboardPosition(event: React.KeyboardEvent<HTMLElement>): boolean {
  const sheet = sheets.sheet;
  const cursor = sheet.cursor;

  const setCursorPosition = (x: number, y: number): void => {
    const newPos = { x, y };
    cursor.changePosition({
      cursorPosition: newPos,
    });
  };

  const moveCursor = (deltaX: number, deltaY: number) => {
    // movePosition is either originPosition or terminalPosition (whichever !== cursorPosition)
    const downPosition = cursor.cursorPosition;
    const movePosition = cursor.keyboardMovePosition;
    const sheetId = sheets.sheet.id;

    // handle cases for meta/ctrl keys with algorithm:
    // - if on an empty cell then select to the first cell with a value
    // - if on a filled cell then select to the cell before the next empty cell
    // - if on a filled cell but the next cell is empty then select to the first cell with a value
    // - if there are no more cells then select the next cell over (excel selects to the end of the sheet; we don’t have an end (yet) so right now I select one cell over)
    //   the above checks are always made relative to the original cursor position (the highlighted cell)
    if (event.metaKey || event.ctrlKey) {
      if (deltaX === 1) {
        const originX = cursor.originPosition.x;
        const termX = cursor.terminalPosition.x;
        const originY = cursor.originPosition.y;
        const termY = cursor.terminalPosition.y;
        const keyboardX = cursor.keyboardMovePosition.x;
        let x = keyboardX;
        const leftOfCursor = keyboardX < cursor.cursorPosition.x;
        const y = cursor.keyboardMovePosition.y;
        // always use the original cursor position to search
        const yCheck = cursor.cursorPosition.y;
        // handle case of cell with content
        if (grid.cellHasContent(sheetId, x, yCheck)) {
          // if next cell is empty, find the next cell with content
          if (!grid.cellHasContent(sheetId, x + 1, yCheck)) {
            x = grid.findNextColumn({
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
              grid.findNextColumn({
                sheetId,
                columnStart: x + 1,
                row: yCheck,
                reverse: false,
                withContent: false,
              }) - 1;
          }
        }
        // otherwise find the next cell with content
        else {
          x = grid.findNextColumn({ sheetId, columnStart: x + 1, row: yCheck, reverse: false, withContent: true });
          if (x === keyboardX) x++;
        }
        if (event.shiftKey) {
          cursor.changePosition({
            multiCursor: {
              originPosition: { x: leftOfCursor ? Math.min(x, termX) : originX, y: originY },
              terminalPosition: { x: leftOfCursor ? Math.max(x, termX) : x, y: termY },
            },
            keyboardMovePosition: { x, y },
          });
        } else {
          setCursorPosition(x, y);
        }
      } else if (deltaX === -1) {
        const originX = cursor.originPosition.x;
        const termX = cursor.terminalPosition.x;
        const keyboardX = cursor.keyboardMovePosition.x;
        let x = keyboardX;
        const rightOfCursor = keyboardX > cursor.cursorPosition.x;
        const y = cursor.keyboardMovePosition.y;
        // always use the original cursor position to search
        const yCheck = cursor.cursorPosition.y;
        // handle case of cell with content
        if (grid.cellHasContent(sheetId, x, yCheck)) {
          // if next cell is empty, find the next cell with content
          if (!grid.cellHasContent(sheetId, x - 1, yCheck)) {
            x = grid.findNextColumn({ sheetId, columnStart: x - 1, row: yCheck, reverse: true, withContent: true });
          }
          // if next cell is not empty, find the next empty cell
          else {
            x =
              grid.findNextColumn({ sheetId, columnStart: x - 1, row: yCheck, reverse: true, withContent: false }) + 1;
          }
        }
        // otherwise find the next cell with content
        else {
          x = grid.findNextColumn({ sheetId, columnStart: x - 1, row: yCheck, reverse: true, withContent: true });
        }
        if (event.shiftKey) {
          const originY = cursor.originPosition.y;
          const termY = cursor.terminalPosition.y;
          cursor.changePosition({
            multiCursor: {
              originPosition: { x: rightOfCursor ? Math.min(x, originX) : x, y: originY },
              terminalPosition: { x: rightOfCursor ? Math.max(x, originX) : termX, y: termY },
            },
            keyboardMovePosition: { x, y },
          });
        } else {
          setCursorPosition(x, y);
        }
      } else if (deltaY === 1) {
        const originY = cursor.originPosition.y;
        const termY = cursor.terminalPosition.y;
        const keyboardY = cursor.keyboardMovePosition.y;
        let y = keyboardY;
        const topOfCursor = keyboardY < cursor.cursorPosition.y;
        const x = cursor.keyboardMovePosition.x;
        // always use the original cursor position to search
        const xCheck = cursor.cursorPosition.x;
        // handle case of cell with content
        if (grid.cellHasContent(sheetId, xCheck, y)) {
          // if next cell is empty, find the next cell with content
          if (!grid.cellHasContent(sheetId, xCheck, y + 1)) {
            y = grid.findNextRow({ sheetId, column: xCheck, rowStart: y + 1, reverse: false, withContent: true });
          }
          // if next cell is not empty, find the next empty cell
          else {
            y = grid.findNextRow({ sheetId, column: xCheck, rowStart: y + 1, reverse: false, withContent: false }) - 1;
          }
        }
        // otherwise find the next cell with content
        else {
          y = grid.findNextRow({ sheetId, column: xCheck, rowStart: y + 1, reverse: false, withContent: true });
          if (y === keyboardY) y++;
        }
        if (event.shiftKey) {
          const originX = cursor.originPosition.x;
          const termX = cursor.terminalPosition.x;
          cursor.changePosition({
            multiCursor: {
              originPosition: { x: originX, y: topOfCursor ? Math.min(y, termY) : originY },
              terminalPosition: { x: termX, y: topOfCursor ? Math.max(y, termY) : y },
            },
            keyboardMovePosition: { x, y },
          });
        } else {
          setCursorPosition(x, y);
        }
      } else if (deltaY === -1) {
        const originY = cursor.originPosition.y;
        const termY = cursor.terminalPosition.y;
        const keyboardY = cursor.keyboardMovePosition.y;
        let y = keyboardY;
        const bottomOfCursor = keyboardY > cursor.cursorPosition.y;
        const x = cursor.keyboardMovePosition.x;
        // always use the original cursor position to search
        const xCheck = cursor.cursorPosition.x;
        // handle case of cell with content
        if (grid.cellHasContent(sheetId, xCheck, y)) {
          // if next cell is empty, find the next cell with content
          if (!grid.cellHasContent(sheetId, xCheck, y - 1)) {
            y = grid.findNextRow({ sheetId, column: xCheck, rowStart: y - 1, reverse: true, withContent: true });
          }
          // if next cell is not empty, find the next empty cell
          else {
            y = grid.findNextRow({ sheetId, column: xCheck, rowStart: y - 1, reverse: true, withContent: false }) + 1;
          }
        }
        // otherwise find the next cell with content
        else {
          y = grid.findNextRow({ sheetId, column: xCheck, rowStart: y - 1, reverse: true, withContent: true });
        }
        if (event.shiftKey) {
          const originX = cursor.multiCursor ? cursor.multiCursor.originPosition.x : cursor.cursorPosition.x;
          const termX = cursor.multiCursor ? cursor.multiCursor.terminalPosition.x : cursor.cursorPosition.x;
          cursor.changePosition({
            multiCursor: {
              originPosition: { x: originX, y: bottomOfCursor ? Math.min(y, originY) : y },
              terminalPosition: { x: termX, y: bottomOfCursor ? Math.max(y, originY) : termY },
            },
            keyboardMovePosition: { x, y },
          });
        } else {
          setCursorPosition(x, y);
        }
      }
    }
    // use arrow to select when shift key is pressed
    else if (event.shiftKey) {
      // we are moving an existing multiCursor
      if (cursor.multiCursor && downPosition && movePosition) {
        const newMovePosition = { x: movePosition.x + deltaX, y: movePosition.y + deltaY };
        const originX = downPosition.x < newMovePosition.x ? downPosition.x : newMovePosition.x;
        const originY = downPosition.y < newMovePosition.y ? downPosition.y : newMovePosition.y;
        const termX = downPosition.x > newMovePosition.x ? downPosition.x : newMovePosition.x;
        const termY = downPosition.y > newMovePosition.y ? downPosition.y : newMovePosition.y;
        cursor.changePosition({
          multiCursor: {
            originPosition: { x: originX, y: originY },
            terminalPosition: { x: termX, y: termY },
          },
          keyboardMovePosition: newMovePosition,
        });
        pixiAppSettings.changeInput(false);
      }
      // we are creating a new multiCursor
      else {
        const downPosition = cursor.cursorPosition;
        const newMovePosition = { x: downPosition.x + deltaX, y: downPosition.y + deltaY };
        const originX = downPosition.x < newMovePosition.x ? downPosition.x : newMovePosition.x;
        const originY = downPosition.y < newMovePosition.y ? downPosition.y : newMovePosition.y;
        const termX = downPosition.x > newMovePosition.x ? downPosition.x : newMovePosition.x;
        const termY = downPosition.y > newMovePosition.y ? downPosition.y : newMovePosition.y;
        cursor.changePosition({
          multiCursor: {
            originPosition: { x: originX, y: originY },
            terminalPosition: { x: termX, y: termY },
          },
          keyboardMovePosition: newMovePosition,
        });
        pixiAppSettings.changeInput(false);
      }
    }
    // move arrow normally
    else {
      const newPos = { x: cursor.cursorPosition.x + deltaX, y: cursor.cursorPosition.y + deltaY };
      cursor.changePosition({
        keyboardMovePosition: newPos,
        cursorPosition: newPos,
      });
    }
    event.preventDefault();
  };

  if (event.key === 'ArrowUp') {
    moveCursor(0, -1);
    return true;
  }

  if (event.key === 'ArrowRight') {
    moveCursor(1, 0);
    return true;
  }

  if (event.key === 'ArrowLeft') {
    moveCursor(-1, 0);
    return true;
  }

  if (event.key === 'ArrowDown') {
    moveCursor(0, 1);
    return true;
  }
  return false;
}

import { EditorInteractionState } from '@/app/atoms/editorInteractionStateAtom';
import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { getA1Notation } from '@/app/gridGL/UI/gridHeadings/getA1Notation';
import { getLanguage } from '@/app/helpers/codeCellLanguage';

export const insertCellRef = (editorInteractionState: EditorInteractionState, relative?: boolean) => {
  const { selectedCell, selectedCellSheet, mode } = editorInteractionState;
  const language = getLanguage(mode);
  let ref = '';
  let sheet = '';
  const cursor = sheets.sheet.cursor;
  if (selectedCellSheet !== sheets.sheet.id) {
    sheet = sheets.sheet.name;
  }
  if (language === 'Formula') {
    if (cursor.multiCursor) {
      let sheet = '';
      if (selectedCellSheet !== sheets.sheet.id) {
        sheet = `'${sheets.sheet.name}'!`;
      }
      let coords = '';
      cursor.multiCursor.forEach((c, i) => {
        const start = getA1Notation(c.left, c.top);
        const end = getA1Notation(c.right - 1, c.bottom - 1);
        coords += `${start}:${end}${i !== cursor.multiCursor!.length - 1 ? ',' : ''}`;
      });
      ref = `${sheet}${coords}`;
    } else {
      const location = cursor.cursorPosition;
      const a1Notation = getA1Notation(location.x, location.y);
      if (sheet) {
        ref = `'${sheet}'!${a1Notation}`;
      } else {
        ref = a1Notation;
      }
    }
  } else if (language === 'Python') {
    if (cursor.multiCursor) {
      if (cursor.multiCursor.length > 1) {
        console.warn(
          'We do not yet support multiple multiCursors for inserting cell references. The button should be disabled'
        );
      }
      const multiCursor = cursor.multiCursor[0];
      const start = { x: multiCursor.left, y: multiCursor.top };
      const end = { x: multiCursor.right - 1, y: multiCursor.bottom - 1 };
      if (sheet) {
        ref = `cells((${start.x}, ${start.y}), (${end.x}, ${end.y}), '${sheet}', first_row_header = False)`;
      } else {
        if (relative) {
          ref = `rel_cells((${start.x - selectedCell.x}, ${start.y - selectedCell.y}), (${end.x - selectedCell.x}, ${
            end.y - selectedCell.y
          }))`;
        } else {
          ref = `cells((${start.x}, ${start.y}), (${end.x}, ${end.y}), first_row_header = False)`;
        }
      }
    } else {
      const location = cursor.cursorPosition;
      if (sheet) {
        ref = `cell(${location.x}, ${location.y}, '${sheet}')`;
      } else {
        if (relative) {
          ref = `rel_cell(${location.x - selectedCell.x}, ${location.y - selectedCell.y})`;
        } else {
          ref = `cell(${location.x}, ${location.y})`;
        }
      }
    }
  } else if ((language as any) === 'Javascript') {
    // any needed until Javascript is properly defined in Javascript branch
    if (cursor.multiCursor) {
      if (cursor.multiCursor.length > 1) {
        console.warn(
          'We do not yet support multiple multiCursors for inserting cell references. The button should be disabled'
        );
      }
      const multiCursor = cursor.multiCursor[0];
      const start = { x: multiCursor.left, y: multiCursor.top };
      const end = { x: multiCursor.right - 1, y: multiCursor.bottom - 1 };
      if (sheet) {
        ref = `await cells(${start.x}, ${start.y}, ${end.x}, ${end.y}, '${sheet}')`;
      } else {
        if (relative) {
          ref = `await relCells(${start.x - selectedCell.x}, ${start.y - selectedCell.y}, ${end.x - selectedCell.x}, ${
            end.y - selectedCell.y
          })`;
        } else {
          ref = `await cells(${start.x}, ${start.y}, ${end.x}, ${end.y})`;
        }
      }
    } else {
      const location = cursor.cursorPosition;
      if (sheet) {
        ref = `await cell(${location.x}, ${location.y}, '${sheet}')`;
      } else {
        if (relative) {
          ref = `await relCell(${location.x - selectedCell.x}, ${location.y - selectedCell.y})`;
        } else {
          ref = `await cell(${location.x}, ${location.y})`;
        }
      }
    }
  }
  events.emit('insertCodeEditorText', ref);
};

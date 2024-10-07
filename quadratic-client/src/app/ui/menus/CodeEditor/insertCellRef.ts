import { events } from '@/app/events/events';
import { sheets } from '@/app/grid/controller/Sheets';
import { Coordinate } from '@/app/gridGL/types/size';
import { getA1Notation } from '@/app/gridGL/UI/gridHeadings/getA1Notation';
import { getLanguage } from '@/app/helpers/codeCellLanguage';
import { CodeCellLanguage } from '@/app/quadratic-core-types';
import { posToA1, posToA1Absolute } from '@/app/quadratic-rust-client/quadratic_rust_client';

export const insertCellRef = (
  selectedCell: Coordinate,
  selectedCellSheet: string,
  mode?: CodeCellLanguage,
  relative?: boolean
) => {
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
  } else if (language === 'Javascript') {
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
        ref = `cells(${start.x}, ${start.y}, ${end.x}, ${end.y}, '${sheet}')`;
      } else {
        if (relative) {
          ref = `relCells(${start.x - selectedCell.x}, ${start.y - selectedCell.y}, ${end.x - selectedCell.x}, ${
            end.y - selectedCell.y
          })`;
        } else {
          ref = `cells(${start.x}, ${start.y}, ${end.x}, ${end.y})`;
        }
      }
    } else {
      const location = cursor.cursorPosition;
      if (sheet) {
        ref = `cell(${location.x}, ${location.y}, '${sheet}')`;
      } else {
        if (relative) {
          ref = `relCell(${location.x - selectedCell.x}, ${location.y - selectedCell.y})`;
        } else {
          ref = `cell(${location.x}, ${location.y})`;
        }
      }
    }
  } else if (language === 'Connection') {
    debugger;
    const location = cursor.cursorPosition;
    let sheetRef = sheet ? (sheet.includes(' ') || sheet.includes('!') ? `'${sheet}'!` : `${sheet}!`) : '';
    if (relative) {
      ref = `{{${sheetRef}${posToA1(location.x, location.y)}}}`;
    } else {
      ref = `{{${sheetRef}${posToA1Absolute(location.x, location.y)}}}`;
    }
  }
  events.emit('insertCodeEditorText', ref);
};

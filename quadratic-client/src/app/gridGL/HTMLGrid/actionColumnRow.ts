// todo: this will be moved to the action folder when merged with Jim's PR

import { sheets } from '@/app/grid/controller/Sheets';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

export const deleteColumnRow = (column?: number, row?: number) => {
  if (column !== undefined) {
    quadraticCore.deleteColumn(sheets.sheet.id, column, sheets.getCursorPosition());
  } else if (row !== undefined) {
    quadraticCore.deleteRow(sheets.sheet.id, row, sheets.getCursorPosition());
  }
};

export const insertColumnRow = (column: number | undefined, row: number | undefined, offset: number) => {
  if (column !== undefined) {
    quadraticCore.insertColumn(sheets.sheet.id, column + offset, sheets.getCursorPosition());
  } else if (row !== undefined) {
    quadraticCore.insertRow(sheets.sheet.id, row + offset, sheets.getCursorPosition());
  }
};

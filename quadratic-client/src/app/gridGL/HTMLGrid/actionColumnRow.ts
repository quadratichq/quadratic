// todo: this will be moved to the action folder when merged with Jim's PR

import { sheets } from '@/app/grid/controller/Sheets';
import { quadraticCore } from '@/app/web-workers/quadraticCore/quadraticCore';

export const deleteColumnRow = (column?: number, row?: number) => {
  if (column !== undefined) {
    quadraticCore.deleteColumn(sheets.sheet.id, column, sheets.getCursorPosition());
  }
};

import { Sheet } from '../../sheet/Sheet';
import { Statement } from '../statement';
import { SetCellRunner } from './setCellRunner';
import { AddCellDependenciesRunner, RemoveCellDependenciesRunner } from './setCellDependenciesRunner';
import { SetCellFormatRunner } from './setCellFormatRunner';
import { PixiApp } from '../../../gridGL/pixiApp/PixiApp';
import { SetHeadingSizeRunner } from './setHeadingSizeRunner';
import { SetBorderRunner } from './setBorderRunner';
import { SetSheetRunner } from './setSheetRunner';

export const StatementRunner = (sheet: Sheet, statement: Statement, app?: PixiApp): Statement => {
  if (statement.type === 'SET_CELL') {
    return SetCellRunner(sheet, statement, app);
  } else if (statement.type === 'ADD_CELL_DEPENDENCY') {
    return AddCellDependenciesRunner(sheet, statement);
  } else if (statement.type === 'REMOVE_CELL_DEPENDENCY') {
    return RemoveCellDependenciesRunner(sheet, statement);
  } else if (statement.type === 'SET_CELL_FORMAT') {
    return SetCellFormatRunner(sheet, statement, app);
  } else if (statement.type === 'SET_HEADING_SIZE') {
    return SetHeadingSizeRunner(sheet, statement, app);
  } else if (statement.type === 'SET_BORDER') {
    return SetBorderRunner(sheet, statement, app);
  } else if (['SET_SHEET', 'SET_SHEET_ORDER'].includes(statement.type)) {
    if (!app) throw new Error('StatementRunner for Sheets needs app to complete');
    return SetSheetRunner(statement, app);
  } else {
    throw new Error('Statement type not recognized.');
  }
};

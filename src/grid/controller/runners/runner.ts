import { Sheet } from '../../sheet/Sheet';
import { Statement } from '../statement';
import { SetCellRunner } from './setCellRunner';
import { AddCellDependenciesRunner, RemoveCellDependenciesRunner } from './setCellDependenciesRunner';
import { SetCellFormatRunner } from './setCellFormatRunner';
import { PixiApp } from '../../../gridGL/pixiApp/PixiApp';
import { SetHeadingSizeRunner } from './setHeadingSizeRunner';
import { SetBorderRunner } from './setBorderRunner';
import { sheetRunner } from './sheetRunner';

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
  } else if (statement.type.includes('SHEET')) {
    if (!app) throw new Error('StatementRunner for Sheets needs app to complete');
    return sheetRunner(statement, app);
  } else {
    throw new Error('Statement type not recognized.');
  }
};

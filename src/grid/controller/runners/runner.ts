import { Statement } from '../statement';
import { SetCellRunner } from './setCellRunner';
import { AddCellDependenciesRunner, RemoveCellDependenciesRunner } from './setCellDependenciesRunner';
import { SetCellFormatRunner } from './setCellFormatRunner';
import { SetHeadingSizeRunner } from './setHeadingSizeRunner';
import { SetBorderRunner } from './setBorderRunner';
import { sheetRunner } from './sheetRunner';
import { SheetController } from '../sheetController';

export const StatementRunner = (sheetController: SheetController, statement: Statement): Statement => {
  if (statement.type === 'SET_CELL') {
    return SetCellRunner(sheetController, statement);
  } else if (statement.type === 'ADD_CELL_DEPENDENCY') {
    return AddCellDependenciesRunner(sheetController, statement);
  } else if (statement.type === 'REMOVE_CELL_DEPENDENCY') {
    return RemoveCellDependenciesRunner(sheetController, statement);
  } else if (statement.type === 'SET_CELL_FORMAT') {
    return SetCellFormatRunner(sheetController, statement);
  } else if (statement.type === 'SET_HEADING_SIZE') {
    return SetHeadingSizeRunner(sheetController, statement);
  } else if (statement.type === 'SET_BORDER') {
    return SetBorderRunner(sheetController, statement);
  } else if (statement.type.includes('SHEET')) {
    return sheetRunner(sheetController, statement);
  } else {
    throw new Error('Statement type not recognized.');
  }
};

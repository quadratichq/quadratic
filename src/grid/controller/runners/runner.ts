import { debugShowTransactions } from '../../../debugFlags';
import { SheetController } from '../_sheetController';
import { Statement } from '../statement';
import { SetBordersRunner } from './setBordersRunner';
import { AddCellDependenciesRunner, RemoveCellDependenciesRunner } from './setCellDependenciesRunner';
import { SetCellFormatsRunner } from './setCellFormatsRunner';
import { SetCellsRunner } from './setCellsRunner';
import { SetHeadingSizeRunner } from './setHeadingSizeRunner';
import { sheetRunner } from './sheetRunner';

export const StatementRunner = (sheetController: SheetController, statement: Statement): Statement => {
  if (debugShowTransactions) {
    console.log(
      `[TRANSACTION] ${statement.type}${Array.isArray(statement.data) ? ` ${(statement.data as []).length} count` : ''}`
    );
  }
  if (statement.type === 'SET_CELLS') {
    return SetCellsRunner(sheetController, statement);
  } else if (statement.type === 'ADD_CELL_DEPENDENCY') {
    return AddCellDependenciesRunner(sheetController, statement);
  } else if (statement.type === 'REMOVE_CELL_DEPENDENCY') {
    return RemoveCellDependenciesRunner(sheetController, statement);
  } else if (statement.type === 'SET_CELL_FORMATS') {
    return SetCellFormatsRunner(sheetController, statement);
  } else if (statement.type === 'SET_HEADING_SIZE') {
    return SetHeadingSizeRunner(sheetController, statement);
  } else if (statement.type === 'SET_BORDERS') {
    return SetBordersRunner(sheetController, statement);
  } else if (statement.type.includes('SHEET')) {
    return sheetRunner(sheetController, statement);
  } else {
    throw new Error('Statement type not recognized.');
  }
};
